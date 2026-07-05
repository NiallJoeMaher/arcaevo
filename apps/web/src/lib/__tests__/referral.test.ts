/**
 * Referral engine — attribution + "give a month / get a month" crediting.
 *
 * Drives src/lib/referral.ts over an in-memory `@/lib/db` fake (same approach
 * as erasure.test.ts / webhook-invoice-idempotency.test.ts — no Mongo needed).
 * Covers the invariants the orchestrator asked for:
 *   - attribution on signup with `?ref=`
 *   - self-referral rejected (by userId AND by email)
 *   - unknown code ignored gracefully
 *   - credit applied ONCE on paid activation (both parties +1 month)
 *   - no double-credit on a webhook retry
 *   - NO credit on an unpaid/free (non-active) membership
 *   - referrer with no active membership → credit HELD, applied at their own
 *     activation
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

type Doc = { _id: string; [k: string]: unknown };
type Filter = Record<string, unknown>;
type Update = {
  $set?: Record<string, unknown>;
  $inc?: Record<string, number>;
  $setOnInsert?: Record<string, unknown>;
};

function matches(doc: Doc, filter: Filter): boolean {
  return Object.entries(filter).every(([k, v]) => {
    if (v && typeof v === "object" && "$gt" in (v as object)) {
      const cur = doc[k];
      return typeof cur === "number" && cur > (v as { $gt: number }).$gt;
    }
    if (v && typeof v === "object" && "$in" in (v as object)) {
      return (v as { $in: unknown[] }).$in.includes(doc[k]);
    }
    return doc[k] === v;
  });
}

function applyMutation(doc: Doc, update: Update) {
  if (update.$set) Object.assign(doc, update.$set);
  if (update.$inc) {
    for (const [k, n] of Object.entries(update.$inc)) {
      doc[k] = ((doc[k] as number | undefined) ?? 0) + n;
    }
  }
}

class FakeCollection {
  docs: Doc[] = [];
  async findOne(filter: Filter) {
    const f = this.docs.find((d) => matches(d, filter));
    return f ? { ...f } : null;
  }
  async insertOne(doc: Doc) {
    if (this.docs.some((d) => d._id === doc._id)) {
      throw new Error(`E11000 duplicate key: ${doc._id}`);
    }
    this.docs.push({ ...doc });
    return { insertedId: doc._id };
  }
  async updateOne(filter: Filter, update: Update, opts: { upsert?: boolean } = {}) {
    const doc = this.docs.find((d) => matches(d, filter));
    if (doc) {
      applyMutation(doc, { $set: update.$set, $inc: update.$inc });
      return { matchedCount: 1, modifiedCount: 1, upsertedCount: 0 };
    }
    if (opts.upsert) {
      const created: Doc = { _id: filter._id as string };
      applyMutation(created, {
        $set: { ...update.$setOnInsert, ...update.$set },
        $inc: update.$inc,
      });
      this.docs.push(created);
      return { matchedCount: 0, modifiedCount: 0, upsertedCount: 1 };
    }
    return { matchedCount: 0, modifiedCount: 0, upsertedCount: 0 };
  }
  /** returnDocument: "before" — returns the pre-image (driver v6 semantics). */
  async findOneAndUpdate(filter: Filter, update: Update) {
    const doc = this.docs.find((d) => matches(d, filter));
    if (!doc) return null;
    const before = { ...doc };
    applyMutation(doc, update);
    return before;
  }
}

const store: Record<string, FakeCollection> = {};
function col(name: string): FakeCollection {
  return (store[name] ??= new FakeCollection());
}

vi.mock("@/lib/db", () => ({
  PRIMARY_READ: { readPreference: "primary" },
  collections: {
    users: async () => col("users"),
    memberships: async () => col("memberships"),
    referralCodes: async () => col("referralCodes"),
    referrals: async () => col("referrals"),
  },
}));

import {
  recordAttribution,
  creditReferralOnActivation,
  ensureReferralCode,
} from "@/lib/referral";
import type { User } from "@/lib/models";

const REFERRER = "mem_referrer";
const REFERRED = "mem_referred";
const CODE = "AOIFE-K4";

function user(id: string, email: string, extra: Partial<User> = {}): User {
  return {
    _id: id,
    name: email.split("@")[0],
    email,
    joinedAt: new Date("2026-01-01"),
    isDemo: false,
    flag: "new",
    passwordHash: null,
    emailVerified: false,
    failedAttempts: 0,
    cooloffUntil: null,
    ...extra,
  } as User;
}

function seed() {
  for (const k of Object.keys(store)) delete store[k];
  col("users").docs = [
    { ...(user(REFERRER, "referrer@arcaevo.test") as unknown as Doc) },
    { ...(user(REFERRED, "referred@arcaevo.test") as unknown as Doc) },
  ];
  col("referralCodes").docs = [
    { _id: CODE, userId: REFERRER, joinedCount: 0, freeMonthsApplied: 0, createdAt: new Date() },
  ];
  col("referrals").docs = [];
  col("memberships").docs = [];
}

beforeEach(seed);

describe("recordAttribution", () => {
  it("attributes a valid ?ref= to the referrer and writes a pending referral", async () => {
    const referred = user(REFERRED, "referred@arcaevo.test");
    const res = await recordAttribution({ referredUser: referred, code: "aoife-k4" });

    expect(res).toMatchObject({ status: "attributed", referrerUserId: REFERRER });
    // Denormalised attribution on the member.
    const u = await col("users").findOne({ _id: REFERRED });
    expect(u).toMatchObject({ referredBy: REFERRER, referredByCode: CODE });
    expect(u!.referredAt).toBeInstanceOf(Date);
    // A single pending referral, keyed by the referred userId.
    const referral = await col("referrals").findOne({ _id: REFERRED });
    expect(referral).toMatchObject({
      referrerUserId: REFERRER,
      referrerCode: CODE,
      referredUserId: REFERRED,
      status: "pending",
    });
  });

  it("rejects a SELF-referral by userId (using your own code)", async () => {
    const self = user(REFERRER, "referrer@arcaevo.test");
    const res = await recordAttribution({ referredUser: self, code: CODE });
    expect(res).toEqual({ status: "ignored", reason: "self_referral" });
    expect(col("referrals").docs).toHaveLength(0);
  });

  it("rejects a SELF-referral by matching email (different id, same inbox)", async () => {
    const sameEmail = user("mem_alias", "referrer@arcaevo.test");
    const res = await recordAttribution({ referredUser: sameEmail, code: CODE });
    expect(res).toEqual({ status: "ignored", reason: "self_referral" });
    expect(col("referrals").docs).toHaveLength(0);
  });

  it("ignores an UNKNOWN code gracefully (no crash, no write)", async () => {
    const referred = user(REFERRED, "referred@arcaevo.test");
    const res = await recordAttribution({ referredUser: referred, code: "TOTALLY-FAKE" });
    expect(res).toEqual({ status: "ignored", reason: "unknown_code" });
    expect(col("referrals").docs).toHaveLength(0);
    const u = await col("users").findOne({ _id: REFERRED });
    expect(u!.referredBy).toBeUndefined();
  });

  it("does not double-attribute the same referred member", async () => {
    const referred = user(REFERRED, "referred@arcaevo.test");
    await recordAttribution({ referredUser: referred, code: CODE });
    const second = await recordAttribution({ referredUser: referred, code: CODE });
    expect(second.status).toBe("ignored");
    expect(second.reason).toBe("already_attributed");
    expect(col("referrals").docs).toHaveLength(1);
  });
});

describe("creditReferralOnActivation", () => {
  async function attributeAndActivate() {
    await recordAttribution({
      referredUser: user(REFERRED, "referred@arcaevo.test"),
      code: CODE,
    });
    // Both parties hold an active annual membership.
    col("memberships").docs = [
      { _id: "sub_referrer", memberId: REFERRER, status: "active", renewalDate: new Date("2027-01-01T00:00:00.000Z") },
      { _id: "sub_referred", memberId: REFERRED, status: "active", renewalDate: new Date("2027-06-01T00:00:00.000Z") },
    ];
  }

  it("credits BOTH sides +1 month exactly once on paid activation", async () => {
    await attributeAndActivate();
    const res = await creditReferralOnActivation(REFERRED);

    expect(res).toMatchObject({
      creditedReferral: true,
      referredMonths: 1,
      referrerMonths: 1,
      referrerHeld: false,
    });
    const referred = await col("memberships").findOne({ _id: "sub_referred" });
    const referrer = await col("memberships").findOne({ _id: "sub_referrer" });
    expect((referred!.renewalDate as Date).toISOString()).toBe("2027-07-01T00:00:00.000Z");
    expect((referrer!.renewalDate as Date).toISOString()).toBe("2027-02-01T00:00:00.000Z");

    const referral = await col("referrals").findOne({ _id: REFERRED });
    expect(referral!.status).toBe("credited");
    const code = await col("referralCodes").findOne({ _id: CODE });
    expect(code).toMatchObject({ joinedCount: 1, freeMonthsApplied: 1 });
  });

  it("does NOT double-credit on a webhook retry", async () => {
    await attributeAndActivate();
    await creditReferralOnActivation(REFERRED);
    const again = await creditReferralOnActivation(REFERRED);

    expect(again.creditedReferral).toBe(false);
    // Still exactly +1 month each — not +2.
    const referred = await col("memberships").findOne({ _id: "sub_referred" });
    const referrer = await col("memberships").findOne({ _id: "sub_referrer" });
    expect((referred!.renewalDate as Date).toISOString()).toBe("2027-07-01T00:00:00.000Z");
    expect((referrer!.renewalDate as Date).toISOString()).toBe("2027-02-01T00:00:00.000Z");
    const code = await col("referralCodes").findOne({ _id: CODE });
    expect(code).toMatchObject({ joinedCount: 1, freeMonthsApplied: 1 });
  });

  it("gives NO credit while the referred membership is unpaid/pending", async () => {
    await recordAttribution({
      referredUser: user(REFERRED, "referred@arcaevo.test"),
      code: CODE,
    });
    col("memberships").docs = [
      { _id: "sub_referrer", memberId: REFERRER, status: "active", renewalDate: new Date("2027-01-01T00:00:00.000Z") },
      // Referred member has only a PENDING (unpaid) membership.
      { _id: "sub_referred", memberId: REFERRED, status: "pending", renewalDate: new Date("2027-06-01T00:00:00.000Z") },
    ];
    const res = await creditReferralOnActivation(REFERRED);

    expect(res.creditedReferral).toBe(false);
    // Referral stays pending; nobody is credited yet.
    const referral = await col("referrals").findOne({ _id: REFERRED });
    expect(referral!.status).toBe("pending");
    const referrer = await col("memberships").findOne({ _id: "sub_referrer" });
    expect((referrer!.renewalDate as Date).toISOString()).toBe("2027-01-01T00:00:00.000Z");
  });

  it("HOLDS the referrer's month when they have no active membership, then applies it on their activation", async () => {
    await recordAttribution({
      referredUser: user(REFERRED, "referred@arcaevo.test"),
      code: CODE,
    });
    // Only the referred member is active; the referrer hasn't paid yet.
    col("memberships").docs = [
      { _id: "sub_referred", memberId: REFERRED, status: "active", renewalDate: new Date("2027-06-01T00:00:00.000Z") },
    ];
    const first = await creditReferralOnActivation(REFERRED);
    expect(first).toMatchObject({ creditedReferral: true, referredMonths: 1, referrerMonths: 0, referrerHeld: true });
    const heldReferrer = await col("users").findOne({ _id: REFERRER });
    expect(heldReferrer!.referralCreditMonths).toBe(1);
    const code = await col("referralCodes").findOne({ _id: CODE });
    // Month is still counted as granted (held), even before it's applied.
    expect(code).toMatchObject({ joinedCount: 1, freeMonthsApplied: 1 });

    // Later, the referrer activates their own membership → the held month lands.
    col("memberships").docs.push({
      _id: "sub_referrer",
      memberId: REFERRER,
      status: "active",
      renewalDate: new Date("2028-01-01T00:00:00.000Z"),
    });
    const consumed = await creditReferralOnActivation(REFERRER);
    expect(consumed.heldConsumed).toBe(1);
    const referrer = await col("memberships").findOne({ _id: "sub_referrer" });
    expect((referrer!.renewalDate as Date).toISOString()).toBe("2028-02-01T00:00:00.000Z");
    const clearedReferrer = await col("users").findOne({ _id: REFERRER });
    expect(clearedReferrer!.referralCreditMonths).toBe(0);
  });
});

describe("ensureReferralCode", () => {
  it("returns the member's existing code when one exists", async () => {
    const code = await ensureReferralCode(user(REFERRER, "referrer@arcaevo.test"));
    expect(code._id).toBe(CODE);
    expect(col("referralCodes").docs).toHaveLength(1);
  });

  it("lazily mints a NAME-based code for a member who has none", async () => {
    const fresh = user("mem_new", "orla@arcaevo.test", { name: "Orla Kelly" });
    const code = await ensureReferralCode(fresh);
    expect(code._id).toMatch(/^ORLA-[A-Z0-9]{2,4}$/);
    expect(code.userId).toBe("mem_new");
    expect(code.joinedCount).toBe(0);
  });
});
