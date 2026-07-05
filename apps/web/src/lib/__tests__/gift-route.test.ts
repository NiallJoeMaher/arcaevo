/**
 * Regression tests for security audit W-3 — gift-code entropy + redeem
 * rate-limiting.
 *
 *  - The old code was an 8-char rendering of a 32-bit FNV-1a hash (≤ ~2^32
 *    space). The new one is 16 chars of a bias-free 32-char CSPRNG alphabet
 *    (80 bits) drawn from the same alphabet as the magic-link codes.
 *  - /gift/redeem now IP-rate-limits before any lookup, so an authenticated
 *    attacker can't grind the code space.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CODE_ALPHABET } from "@/lib/member-auth";

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
  async findOneAndUpdate(
    filter: { _id: string },
    update: {
      $inc?: Record<string, number>;
      $setOnInsert?: Record<string, unknown>;
    },
    opts: { upsert?: boolean; returnDocument?: "after" | "before" }
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
function col(name: string): FakeCollection {
  return (store[name] ??= new FakeCollection());
}

vi.mock("@/lib/db", () => ({
  PRIMARY_READ: { readPreference: "primary" },
  collections: {
    giftCodes: async () => col("giftCodes"),
    rateLimits: async () => col("rateLimits"),
    sessions: async () => col("sessions"),
    users: async () => col("users"),
    memberships: async () => col("memberships"),
  },
}));

vi.mock("@/lib/vendors/stripe", () => ({
  getPaymentsVendor: () => ({
    createCheckoutSession: async () => ({ url: "https://pay", id: "cs_1" }),
  }),
}));

import { POST as giftPost } from "@/app/api/v1/gift/route";
import { POST as redeemPost } from "@/app/api/v1/gift/redeem/route";

beforeEach(() => {
  for (const k of Object.keys(store)) delete store[k];
});

function giftReq() {
  return new Request("http://localhost/api/v1/gift", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ purchaserEmail: "buyer@arcaevo.test", delivery: "email" }),
  });
}

describe("W-3 — gift-code entropy", () => {
  it("mints a 16-char code from the unambiguous CSPRNG alphabet (no 0/O/1/I)", async () => {
    const res = await giftPost(giftReq());
    expect(res.status).toBe(201);
    const { code } = await res.json();

    expect(code.startsWith("GIFT-")).toBe(true);
    const chars = code.slice("GIFT-".length).replace(/-/g, "");
    expect(chars).toHaveLength(16); // was 8 — now 80 bits
    for (const ch of chars) expect(CODE_ALPHABET.includes(ch)).toBe(true);
    expect(/[01OI]/.test(chars)).toBe(false);
  });

  it("is collision-free across many mints (no purchaser-derived seed)", async () => {
    const codes = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const res = await giftPost(giftReq());
      codes.add((await res.json()).code);
    }
    expect(codes.size).toBe(200);
  });
});

describe("W-3 — /gift/redeem IP rate limit", () => {
  it("returns 429 once the per-IP ceiling is exceeded", async () => {
    const headers = {
      "Content-Type": "application/json",
      "x-forwarded-for": "203.0.113.7",
      // Bearer with no matching session → requireMember 401 (never 429) for the
      // allowed hits, proving the limiter — not auth — produces the 429.
      authorization: "Bearer not-a-real-session",
    };
    const body = JSON.stringify({ code: "GIFT-XXXX", eircode: "D08" });
    const make = () =>
      redeemPost(new Request("http://localhost/api/v1/gift/redeem", { method: "POST", headers, body }));

    // GIFT_REDEEM_RATE_LIMIT.limit = 10: hits 1..10 pass the limiter (→ 401),
    // the 11th is refused (→ 429).
    const statuses: number[] = [];
    for (let i = 0; i < 11; i++) statuses.push((await make()).status);

    expect(statuses[0]).toBe(401); // limiter let it through to auth
    expect(statuses[10]).toBe(429); // limiter refused the 11th
  });
});
