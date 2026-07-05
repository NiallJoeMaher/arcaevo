/**
 * Server-side enforcement of the BLOOD_TIERS_ENABLED gate (the real gate — not
 * just the pricing UI). A crafted request must not be able to buy/activate a
 * blood tier while the flag is off:
 *
 *  - POST /api/v1/checkout   rejects Essential/Performance, allows Fusion
 *  - POST /api/v1/orders     rejects every (blood) test order
 *  - POST /api/v1/gift       rejects gifting (Essential-only)
 *
 * With the flag ON, each gate opens and the request falls through to its normal
 * next step (eligibility / auth / creation) — proving the gate is the only thing
 * added. Prices are never touched by any of this.
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
}

const store: Record<string, FakeCollection> = {};
const col = (name: string): FakeCollection => (store[name] ??= new FakeCollection());

vi.mock("@/lib/db", () => ({
  PRIMARY_READ: { readPreference: "primary" },
  collections: {
    users: async () => col("users"),
    memberships: async () => col("memberships"),
    testOrders: async () => col("testOrders"),
    giftCodes: async () => col("giftCodes"),
    rateLimits: async () => col("rateLimits"),
    sessions: async () => col("sessions"),
  },
}));

// Guest checkout never gets a member; requireMember always denies (401). The
// orders/checkout gates sit before these are consulted, so the disabled path
// never reaches them — and the enabled path lands on a clean 401/422.
vi.mock("@/lib/auth", () => ({
  memberFromRequest: async () => null,
  requireMember: async () => ({
    member: null,
    denied: Response.json({ error: "unauthorized" }, { status: 401 }),
  }),
}));

vi.mock("@/lib/vendors/stripe", () => ({
  getPaymentsVendor: () => ({
    createCheckoutSession: async () => ({ url: "https://pay", sessionId: "cs_1", amountEur: 0 }),
  }),
}));

import { POST as checkoutPost } from "@/app/api/v1/checkout/route";
import { POST as ordersPost } from "@/app/api/v1/orders/route";
import { POST as giftPost } from "@/app/api/v1/gift/route";

function post(path: string, body: unknown): Request {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  for (const k of Object.keys(store)) delete store[k];
});
afterEach(() => vi.unstubAllEnvs());

describe("checkout — blood-tier gate", () => {
  it("rejects Essential when disabled (403 blood_tiers_unavailable)", async () => {
    vi.stubEnv("BLOOD_TIERS_ENABLED", "");
    const res = await checkoutPost(post("/api/v1/checkout", { tier: "essential", eircode: "D08" }));
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("blood_tiers_unavailable");
  });

  it("rejects Performance when disabled (can't be bypassed via a crafted request)", async () => {
    vi.stubEnv("BLOOD_TIERS_ENABLED", "");
    const res = await checkoutPost(post("/api/v1/checkout", { tier: "performance", eircode: "D08" }));
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("blood_tiers_unavailable");
  });

  it("ALLOWS Fusion when disabled (never gated) — falls through past the gate", async () => {
    vi.stubEnv("BLOOD_TIERS_ENABLED", "");
    // Fusion + guest + no email ⇒ 401 email_required: it cleared the blood gate.
    const res = await checkoutPost(post("/api/v1/checkout", { tier: "fusion" }));
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe("email_required");
  });

  it("opens Essential when enabled — reaches the eligibility step, not the gate", async () => {
    vi.stubEnv("BLOOD_TIERS_ENABLED", "true");
    // Enabled + no eircode ⇒ 422 eircode_required: the blood gate let it through.
    const res = await checkoutPost(post("/api/v1/checkout", { tier: "essential" }));
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe("eircode_required");
  });
});

describe("orders — blood-tier gate", () => {
  it("rejects any test order when disabled (403 blood_tiers_unavailable)", async () => {
    vi.stubEnv("BLOOD_TIERS_ENABLED", "");
    const res = await ordersPost(post("/api/v1/orders", { type: "kit", panel: "full" }));
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("blood_tiers_unavailable");
  });

  it("opens the route when enabled — reaches auth (401), not the gate", async () => {
    vi.stubEnv("BLOOD_TIERS_ENABLED", "true");
    const res = await ordersPost(post("/api/v1/orders", { type: "venous", panel: "venous80" }));
    expect(res.status).toBe(401); // requireConsentedMember denies (no session)
    expect((await res.json()).error).not.toBe("blood_tiers_unavailable");
  });
});

describe("gift purchase — blood-tier gate", () => {
  it("rejects buying an (Essential) gift when disabled", async () => {
    vi.stubEnv("BLOOD_TIERS_ENABLED", "");
    const res = await giftPost(
      post("/api/v1/gift", { purchaserEmail: "buyer@arcaevo.test", delivery: "email" })
    );
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("blood_tiers_unavailable");
  });

  it("allows buying a gift when enabled (201 with a code + unchanged €329 price)", async () => {
    vi.stubEnv("BLOOD_TIERS_ENABLED", "true");
    const res = await giftPost(
      post("/api/v1/gift", { purchaserEmail: "buyer@arcaevo.test", delivery: "email" })
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.code.startsWith("GIFT-")).toBe(true);
    expect(body.priceEur).toBe(329); // price is contractual — never changed by the gate
  });
});
