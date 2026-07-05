/**
 * Unit tests for src/lib/erasure.ts — GDPR Art.17 execution.
 *
 * @/lib/db is replaced with a minimal in-memory Mongo fake (same approach as
 * member-auth.test.ts) supporting the equality-filter deleteMany/updateOne/
 * find the erasure code uses. We assert:
 *  - a due job hard-deletes the member's PII/health data across ALL collections,
 *  - the consent audit trail is RETAINED,
 *  - the job is marked "done" and the run is idempotent,
 *  - a job still inside its 30-day grace window is NOT executed.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

type Doc = { _id: string; [k: string]: unknown };
type Filter = Record<string, unknown>;

function matches(doc: Doc, filter: Filter): boolean {
  return Object.entries(filter).every(([k, v]) => doc[k] === v);
}

class FakeCollection {
  docs: Doc[] = [];
  async insertOne(doc: Doc) {
    this.docs.push({ ...doc });
    return { insertedId: doc._id };
  }
  async insertMany(docs: Doc[]) {
    for (const d of docs) this.docs.push({ ...d });
    return { insertedCount: docs.length };
  }
  async findOne(filter: Filter) {
    const f = this.docs.find((d) => matches(d, filter));
    return f ? { ...f } : null;
  }
  find(filter: Filter = {}) {
    const results = this.docs.filter((d) => matches(d, filter));
    return { toArray: async () => results.map((d) => ({ ...d })) };
  }
  async countDocuments(filter: Filter = {}) {
    return this.docs.filter((d) => matches(d, filter)).length;
  }
  async deleteMany(filter: Filter) {
    const before = this.docs.length;
    this.docs = this.docs.filter((d) => !matches(d, filter));
    return { deletedCount: before - this.docs.length };
  }
  async updateOne(filter: Filter, update: { $set: Record<string, unknown> }) {
    const doc = this.docs.find((d) => matches(d, filter));
    if (doc) Object.assign(doc, update.$set);
    return { matchedCount: doc ? 1 : 0 };
  }
}

const store: Record<string, FakeCollection> = {};
function col(name: string): FakeCollection {
  return (store[name] ??= new FakeCollection());
}

vi.mock("@/lib/db", () => ({
  collections: {
    users: async () => col("users"),
    memberships: async () => col("memberships"),
    testOrders: async () => col("testOrders"),
    biomarkerReadings: async () => col("biomarkerReadings"),
    wearableSignals: async () => col("wearableSignals"),
    bloodworkUploads: async () => col("bloodworkUploads"),
    sessions: async () => col("sessions"),
    shareLinks: async () => col("shareLinks"),
    referralCodes: async () => col("referralCodes"),
    referrals: async () => col("referrals"),
    giftCodes: async () => col("giftCodes"),
    supportTickets: async () => col("supportTickets"),
    waitlist: async () => col("waitlist"),
    magicLinkTokens: async () => col("magicLinkTokens"),
    outbox: async () => col("outbox"),
    consents: async () => col("consents"),
    erasureJobs: async () => col("erasureJobs"),
  },
}));

import { eraseUserData, runDueErasures } from "@/lib/erasure";

const USER = "mem_0099";
const EMAIL = "closer@arcaevo.test";
const OTHER = "mem_0001";

function seed() {
  for (const k of Object.keys(store)) delete store[k];
  col("users").docs = [
    { _id: USER, email: EMAIL },
    { _id: OTHER, email: "keep@arcaevo.test" },
  ];
  col("memberships").docs = [
    { _id: "sub_a", memberId: USER },
    { _id: "sub_b", memberId: OTHER },
  ];
  col("testOrders").docs = [{ _id: "ord_a", memberId: USER }];
  col("biomarkerReadings").docs = [
    { _id: "r1", memberId: USER },
    { _id: "r2", memberId: USER },
    { _id: "r3", memberId: OTHER },
  ];
  col("wearableSignals").docs = [{ _id: "w1", memberId: USER }];
  col("bloodworkUploads").docs = [{ _id: "up1", memberId: USER }];
  col("sessions").docs = [
    { _id: "s1", userId: USER },
    { _id: "s2", userId: USER },
  ];
  col("shareLinks").docs = [{ _id: "sh1", userId: USER }];
  col("referralCodes").docs = [{ _id: "REF-1", userId: USER }];
  col("referrals").docs = [
    // the member was referred by OTHER …
    { _id: USER, referredUserId: USER, referrerUserId: OTHER, status: "credited" },
    // … and referred someone else in turn.
    { _id: "mem_0100", referredUserId: "mem_0100", referrerUserId: USER, status: "pending" },
    // an unrelated referral between two other members — must survive.
    { _id: OTHER, referredUserId: OTHER, referrerUserId: "mem_0002", status: "pending" },
  ];
  col("giftCodes").docs = [
    { _id: "GIFT-OWN", purchaserEmail: EMAIL, redeemedBy: null },
    { _id: "GIFT-RDM", purchaserEmail: "x@y.ie", redeemedBy: USER },
    { _id: "GIFT-OTHER", purchaserEmail: "z@y.ie", redeemedBy: OTHER },
  ];
  col("supportTickets").docs = [{ _id: "t1", memberId: USER }];
  col("waitlist").docs = [{ _id: "wait_a", email: EMAIL }];
  col("magicLinkTokens").docs = [{ _id: "mlt_a", email: EMAIL }];
  col("outbox").docs = [
    { _id: "e1", to: EMAIL },
    { _id: "e2", to: "keep@arcaevo.test" },
  ];
  // RETAINED — the audit trail.
  col("consents").docs = [
    { _id: "c1", userId: USER, purpose: "health_processing", granted: true },
    { _id: "c2", userId: USER, purpose: "health_processing", granted: false },
    { _id: "c3", userId: OTHER, purpose: "health_processing", granted: true },
  ];
}

beforeEach(seed);

describe("eraseUserData", () => {
  it("hard-deletes the member across every PII/health collection", async () => {
    const counts = await eraseUserData(USER, EMAIL);

    expect(col("users").docs.map((d) => d._id)).toEqual([OTHER]);
    expect(col("memberships").docs.map((d) => d._id)).toEqual(["sub_b"]);
    expect(col("testOrders").docs).toHaveLength(0);
    expect(col("biomarkerReadings").docs.map((d) => d._id)).toEqual(["r3"]);
    expect(col("wearableSignals").docs).toHaveLength(0);
    expect(col("bloodworkUploads").docs).toHaveLength(0);
    expect(col("sessions").docs).toHaveLength(0);
    expect(col("shareLinks").docs).toHaveLength(0);
    expect(col("referralCodes").docs).toHaveLength(0);
    // Referrals linking the member (either direction) are gone; the unrelated
    // one between two other members survives.
    expect(col("referrals").docs.map((d) => d._id)).toEqual([OTHER]);
    expect(counts.referrals).toBe(2);
    expect(col("supportTickets").docs).toHaveLength(0);
    expect(col("waitlist").docs).toHaveLength(0);
    expect(col("magicLinkTokens").docs).toHaveLength(0);
    expect(col("outbox").docs.map((d) => d._id)).toEqual(["e2"]);
    // gift codes: owned + redeemed erased, other member's kept.
    expect(col("giftCodes").docs.map((d) => d._id)).toEqual(["GIFT-OTHER"]);

    expect(counts.biomarkerReadings).toBe(2);
    expect(counts.sessions).toBe(2);
    expect(counts.giftCodes).toBe(2);
  });

  it("RETAINS the consent audit trail (DPC evidence of erasure)", async () => {
    await eraseUserData(USER, EMAIL);
    // The withdrawing member's consent docs survive untouched.
    expect(col("consents").docs.map((d) => d._id).sort()).toEqual(["c1", "c2", "c3"]);
  });
});

describe("runDueErasures", () => {
  it("executes a due job, marks it done, and is idempotent", async () => {
    col("erasureJobs").docs = [
      {
        _id: "erasure_0001",
        userId: USER,
        email: EMAIL,
        requestedAt: new Date("2026-06-01"),
        eraseAfter: new Date("2026-07-01"),
        status: "scheduled",
        completedAt: null,
      },
    ];
    const now = new Date("2026-07-02");
    const run = await runDueErasures(now);
    expect(run.executed).toHaveLength(1);
    expect(col("users").docs.map((d) => d._id)).toEqual([OTHER]);
    const job = col("erasureJobs").docs[0];
    expect(job.status).toBe("done");
    expect(job.completedAt).toEqual(now);

    // Second run: the job is "done" → nothing more happens.
    const again = await runDueErasures(new Date("2026-07-03"));
    expect(again.executed).toHaveLength(0);
  });

  it("does NOT erase a job still inside its 30-day grace window", async () => {
    col("erasureJobs").docs = [
      {
        _id: "erasure_0002",
        userId: USER,
        email: EMAIL,
        requestedAt: new Date("2026-07-01"),
        eraseAfter: new Date("2026-07-31"),
        status: "scheduled",
        completedAt: null,
      },
    ];
    const run = await runDueErasures(new Date("2026-07-10"));
    expect(run.executed).toHaveLength(0);
    expect(run.pending).toBe(1);
    // The member's data is intact.
    expect(col("users").docs.map((d) => d._id).sort()).toEqual([OTHER, USER]);
    expect(col("erasureJobs").docs[0].status).toBe("scheduled");
  });
});
