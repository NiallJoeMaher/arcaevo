/**
 * Blood-tier gate on POST /api/v1/gift/redeem. A gift activates an Essential
 * (blood) membership, so while blood tiers are off it must NOT activate — the
 * code stays unredeemed (still valid later), and the caller gets a clear 403.
 * This runs AFTER auth + the gift lookup, so it needs a signed-in member and a
 * real unredeemed gift in the (fake) store to reach the gate.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Doc = { _id: string; [k: string]: unknown };

class FakeCollection {
  docs: Doc[] = [];
  async createIndex() {
    return "idx";
  }
  async insertOne(doc: Doc) {
    this.docs.push({ ...doc });
    return { insertedId: doc._id };
  }
  async findOne(filter: Record<string, unknown>) {
    const f = this.docs.find((d) =>
      Object.entries(filter).every(([k, v]) => d[k] === v)
    );
    return f ? { ...f } : null;
  }
  async updateOne() {
    return { modifiedCount: 1 };
  }
  async findOneAndUpdate(
    filter: { _id: string },
    update: { $inc?: Record<string, number>; $setOnInsert?: Record<string, unknown> },
    opts: { upsert?: boolean }
  ) {
    let doc = this.docs.find((d) => d._id === filter._id);
    if (!doc) {
      if (!opts.upsert) return null;
      doc = { _id: filter._id, ...(update.$setOnInsert ?? {}) };
      this.docs.push(doc);
    }
    if (update.$inc)
      for (const [k, v] of Object.entries(update.$inc))
        doc[k] = ((doc[k] as number) ?? 0) + v;
    return { ...doc };
  }
}

const store: Record<string, FakeCollection> = {};
const col = (name: string): FakeCollection => (store[name] ??= new FakeCollection());

vi.mock("@/lib/db", () => ({
  PRIMARY_READ: { readPreference: "primary" },
  collections: {
    giftCodes: async () => col("giftCodes"),
    rateLimits: async () => col("rateLimits"),
    memberships: async () => col("memberships"),
    eligibilityConfig: async () => col("eligibilityConfig"),
    eligibilityRejections: async () => col("eligibilityRejections"),
  },
}));

vi.mock("@/lib/auth", () => ({
  requireMember: async () => ({
    member: { _id: "mem_1", email: "gift@arcaevo.test" },
    denied: null,
  }),
}));

import { POST as redeemPost } from "@/app/api/v1/gift/redeem/route";

beforeEach(() => {
  for (const k of Object.keys(store)) delete store[k];
  // A real, unredeemed Essential gift so the handler reaches the blood gate.
  col("giftCodes").docs.push({
    _id: "GIFT-TEST",
    tier: "essential",
    priceEur: 329,
    purchaserEmail: "buyer@arcaevo.test",
    redeemedBy: null,
    redeemedAt: null,
  });
});
afterEach(() => vi.unstubAllEnvs());

function redeemReq() {
  return new Request("http://localhost/api/v1/gift/redeem", {
    method: "POST",
    headers: { "Content-Type": "application/json", authorization: "Bearer x" },
    body: JSON.stringify({ code: "GIFT-TEST", eircode: "D08" }),
  });
}

describe("gift/redeem — blood-tier gate", () => {
  it("refuses to activate an Essential gift when blood tiers are off (403)", async () => {
    vi.stubEnv("BLOOD_TIERS_ENABLED", "");
    const res = await redeemPost(redeemReq());
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("blood_tiers_unavailable");
    // The gift is left UNredeemed so it stays valid once the tiers open.
    expect(col("giftCodes").docs[0]!.redeemedBy).toBeNull();
  });

  it("clears the gate when enabled — reaches the eligibility step, not the blood gate", async () => {
    vi.stubEnv("BLOOD_TIERS_ENABLED", "true");
    // A deliberately invalid Eircode makes the NEXT step (eligibility) return a
    // distinct error — proof the blood gate let the request through.
    const res = await redeemPost(
      new Request("http://localhost/api/v1/gift/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json", authorization: "Bearer x" },
        body: JSON.stringify({ code: "GIFT-TEST", eircode: "ZZ" }),
      })
    );
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe("invalid_eircode");
  });
});
