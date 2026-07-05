/**
 * MongoDB read-after-write hardening — proves the correctness-critical reads
 * pin themselves to the PRIMARY replica.
 *
 * WHY: in production the Atlas cluster may serve reads from multi-region
 * SECONDARY replicas (if the connection string sets a secondary read
 * preference). A secondary can lag the primary by seconds, so a read issued
 * right after a write can land on a replica that hasn't received it and MISS
 * the just-written doc. The fix (src/lib/db.ts PRIMARY_READ) passes
 * `{ readPreference: "primary" }` on those specific findOne/find calls, which
 * overrides the client/URI default for that one operation.
 *
 * These tests replace `@/lib/db` with recording fake collections (keeping the
 * REAL PRIMARY_READ constant via importOriginal) and assert the option object
 * actually reaches the driver at each pinned call site. Bulk/list reads are
 * deliberately NOT asserted — they keep the URI's read preference on purpose.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PRIMARY_READ } from "@/lib/db";

type Doc = { _id: string; [k: string]: unknown };
type CallLog = { filter: unknown; options: unknown }[];

/**
 * A minimal recording collection. `findOne`/`find` capture the OPTIONS arg (the
 * 2nd positional) so a test can assert the read preference passed to the driver.
 * The returned doc(s) are configurable per collection so each flow can be driven
 * down its happy path.
 */
class RecordingCollection {
  findOneCalls: CallLog = [];
  findCalls: CallLog = [];
  private nextFindOne: Doc | null = null;
  private nextFindArray: Doc[] = [];

  setFindOne(doc: Doc | null) {
    this.nextFindOne = doc;
  }
  setFind(docs: Doc[]) {
    this.nextFindArray = docs;
  }

  async findOne(filter: unknown, options?: unknown) {
    this.findOneCalls.push({ filter, options });
    return this.nextFindOne ? { ...this.nextFindOne } : null;
  }
  find(filter: unknown, options?: unknown) {
    this.findCalls.push({ filter, options });
    const results = this.nextFindArray.map((d) => ({ ...d }));
    const cursor = {
      sort: () => cursor,
      limit: () => cursor,
      toArray: async () => results,
    };
    return cursor;
  }
  async updateOne() {
    return { matchedCount: 1, modifiedCount: 1, upsertedCount: 0 };
  }
  async insertOne(doc: Doc) {
    return { insertedId: doc._id };
  }
  // returnDocument semantics are irrelevant here — return null to short-circuit
  // the referral flow right after the pinned membership read.
  async findOneAndUpdate() {
    return null;
  }
}

const cols = {
  sessions: new RecordingCollection(),
  users: new RecordingCollection(),
  magicLinkTokens: new RecordingCollection(),
  memberships: new RecordingCollection(),
  referrals: new RecordingCollection(),
  referralCodes: new RecordingCollection(),
};

// Keep the REAL PRIMARY_READ constant; only swap `collections` for the fakes.
vi.mock("@/lib/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db")>();
  return {
    ...actual,
    collections: {
      sessions: async () => cols.sessions,
      users: async () => cols.users,
      magicLinkTokens: async () => cols.magicLinkTokens,
      memberships: async () => cols.memberships,
      referrals: async () => cols.referrals,
      referralCodes: async () => cols.referralCodes,
    },
  };
});

vi.mock("next/headers", () => ({
  cookies: async () => {
    throw new Error("cookie store must not be touched in unit tests");
  },
}));

import {
  consumeMagicLink,
  consumeMagicLinkByCode,
  memberFromSessionToken,
  normalizeCode,
  refreshSession,
  sha256Hex,
} from "@/lib/member-auth";
import { creditReferralOnActivation } from "@/lib/referral";

const RAW_TOKEN = "raw-token-abc";
const future = () => new Date(Date.now() + 60 * 60 * 1000);

beforeEach(() => {
  for (const c of Object.values(cols)) {
    c.findOneCalls = [];
    c.findCalls = [];
    c.setFindOne(null);
    c.setFind([]);
  }
});

describe("PRIMARY_READ constant", () => {
  it("pins a read to the primary replica", () => {
    expect(PRIMARY_READ).toEqual({ readPreference: "primary" });
  });
});

describe("auth session reads are pinned to primary", () => {
  it("memberFromSessionToken reads the session from primary", async () => {
    cols.sessions.setFindOne({
      _id: "sess_1",
      tokenHash: sha256Hex(RAW_TOKEN),
      userId: "mem_1",
      expiresAt: future(),
    });
    cols.users.setFindOne({ _id: "mem_1" });

    await memberFromSessionToken(RAW_TOKEN);

    expect(cols.sessions.findOneCalls).toHaveLength(1);
    expect(cols.sessions.findOneCalls[0]!.options).toEqual(PRIMARY_READ);
  });

  it("refreshSession reads the session from primary", async () => {
    cols.sessions.setFindOne({
      _id: "sess_1",
      tokenHash: sha256Hex(RAW_TOKEN),
      userId: "mem_1",
      expiresAt: future(),
    });
    cols.users.setFindOne({ _id: "mem_1" });

    await refreshSession(RAW_TOKEN);

    expect(cols.sessions.findOneCalls[0]!.options).toEqual(PRIMARY_READ);
  });
});

describe("magic-link reads are pinned to primary", () => {
  it("consumeMagicLink reads the token from primary", async () => {
    cols.magicLinkTokens.setFindOne({
      _id: "mlt_1",
      tokenHash: sha256Hex(RAW_TOKEN),
      email: "a@b.test",
      purpose: "signin",
      expiresAt: future(),
      usedAt: null,
    });

    await consumeMagicLink(RAW_TOKEN);

    expect(cols.magicLinkTokens.findOneCalls).toHaveLength(1);
    expect(cols.magicLinkTokens.findOneCalls[0]!.options).toEqual(PRIMARY_READ);
  });

  it("consumeMagicLinkByCode reads the latest token from primary", async () => {
    const code = "ABC234";
    cols.magicLinkTokens.setFind([
      {
        _id: "mlt_1",
        email: "a@b.test",
        purpose: "signin",
        expiresAt: future(),
        usedAt: null,
        codeHash: sha256Hex(normalizeCode(code)),
        codeAttempts: 0,
      },
    ]);

    await consumeMagicLinkByCode("a@b.test", code);

    expect(cols.magicLinkTokens.findCalls).toHaveLength(1);
    expect(cols.magicLinkTokens.findCalls[0]!.options).toEqual(PRIMARY_READ);
  });
});

describe("membership activation (money path) reads are pinned to primary", () => {
  it("creditReferralOnActivation reads the just-activated membership from primary", async () => {
    cols.memberships.setFindOne({
      _id: "sub_1",
      memberId: "mem_1",
      status: "active",
      renewalDate: new Date(),
    });
    // referrals.findOneAndUpdate returns null → the flow returns right after the
    // pinned guard read, which is exactly the call we assert.

    await creditReferralOnActivation("mem_1");

    const guardRead = cols.memberships.findOneCalls.find(
      (c) => (c.filter as { status?: string }).status === "active"
    );
    expect(guardRead).toBeDefined();
    expect(guardRead!.options).toEqual(PRIMARY_READ);
  });
});
