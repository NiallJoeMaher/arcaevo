/**
 * Regression test for the CRITICAL webhook-idempotency bug: a retried/duplicate
 * Stripe `invoice.paid` event must NOT extend the membership period more than
 * once. Stripe delivers webhooks at-least-once, so the real handler now claims
 * each event id in an idempotency ledger and no-ops on repeats.
 *
 * This drives the REAL signature-verified handler (STRIPE_WEBHOOK_SECRET set)
 * over an in-memory `@/lib/db`, so no Mongo is touched — the whole existing
 * suite stays runnable without a database.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { signPayloadForTest } from "@/lib/stripe-signature";

const WEBHOOK_SECRET = "whsec_test_idempotency";

// --- tiny in-memory collections fake (only what the handler touches) --------
interface MembershipRow {
  _id: string;
  memberId: string;
  status: string;
  renewalDate: Date;
  stripeSubscriptionId: string | null;
  dunningStage?: string;
  dunningStartedAt?: Date | null;
}

const state: {
  memberships: MembershipRow[];
  processed: Map<string, { type: string; processedAt: Date }>;
} = { memberships: [], processed: new Map() };

function matchMembership(row: MembershipRow, q: Record<string, unknown>): boolean {
  for (const [k, v] of Object.entries(q)) {
    if (k === "status" && v && typeof v === "object" && "$in" in v) {
      if (!(v.$in as string[]).includes(row.status)) return false;
    } else if ((row as unknown as Record<string, unknown>)[k] !== v) {
      return false;
    }
  }
  return true;
}

const membershipsCol = {
  async findOne(q: Record<string, unknown>) {
    return state.memberships.find((r) => matchMembership(r, q)) ?? null;
  },
  async updateOne(q: Record<string, unknown>, update: { $set: Record<string, unknown> }) {
    const row = state.memberships.find((r) => matchMembership(r, q));
    if (row) Object.assign(row, update.$set);
    return { matchedCount: row ? 1 : 0 };
  },
};

const usersCol = {
  async findOne() {
    return null; // invoice.paid never sends a receipt → no user needed
  },
};

const processedCol = {
  async updateOne(
    q: { _id: string },
    update: { $setOnInsert: { type: string; processedAt: Date } },
    opts: { upsert?: boolean }
  ) {
    if (state.processed.has(q._id)) {
      return { upsertedCount: 0, matchedCount: 1 };
    }
    if (opts?.upsert) {
      state.processed.set(q._id, update.$setOnInsert);
      return { upsertedCount: 1, matchedCount: 0 };
    }
    return { upsertedCount: 0, matchedCount: 0 };
  },
};

vi.mock("@/lib/db", () => ({
  collections: {
    memberships: async () => membershipsCol,
    users: async () => usersCol,
    processedWebhookEvents: async () => processedCol,
  },
}));
vi.mock("@/lib/emails", () => ({ sendEmail: async () => undefined }));

import { POST } from "@/app/api/v1/webhooks/stripe/route";

function signedInvoicePaidRequest(eventId: string): Request {
  const body = JSON.stringify({
    id: eventId,
    type: "invoice.paid",
    data: {
      object: {
        subscription: "sub_test_1",
        metadata: { memberId: "mem_1" },
      },
    },
  });
  const ts = Math.floor(Date.now() / 1000);
  const signature = signPayloadForTest(body, WEBHOOK_SECRET, ts);
  return new Request("https://arcaevo.test/api/v1/webhooks/stripe", {
    method: "POST",
    headers: { "content-type": "application/json", "stripe-signature": signature },
    body,
  });
}

beforeEach(() => {
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", WEBHOOK_SECRET);
  state.memberships = [
    {
      _id: "sub_1",
      memberId: "mem_1",
      status: "active",
      renewalDate: new Date("2026-01-01T00:00:00.000Z"),
      stripeSubscriptionId: "sub_test_1",
      dunningStage: "none",
      dunningStartedAt: null,
    },
  ];
  state.processed = new Map();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("invoice.paid idempotency", () => {
  it("extends the membership period by exactly one year on first delivery", async () => {
    const res = await POST(signedInvoicePaidRequest("evt_renewal_1"));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json).toMatchObject({ ok: true, type: "invoice.paid" });
    expect(state.memberships[0].renewalDate.toISOString()).toBe(
      "2027-01-01T00:00:00.000Z"
    );
  });

  it("a DUPLICATE event id does not double-extend the period", async () => {
    await POST(signedInvoicePaidRequest("evt_renewal_1"));
    // Stripe re-delivers the SAME event id.
    const res2 = await POST(signedInvoicePaidRequest("evt_renewal_1"));
    const json2 = await res2.json();

    expect(res2.status).toBe(200); // acked so Stripe stops retrying
    expect(json2).toMatchObject({ deduped: true });
    // Still exactly +1 year — NOT +2.
    expect(state.memberships[0].renewalDate.toISOString()).toBe(
      "2027-01-01T00:00:00.000Z"
    );
  });

  it("a genuinely NEW event id (next billing cycle) still extends", async () => {
    await POST(signedInvoicePaidRequest("evt_renewal_1")); // → 2027
    const res = await POST(signedInvoicePaidRequest("evt_renewal_2")); // → 2028
    expect((await res.json()).deduped).toBeUndefined();
    expect(state.memberships[0].renewalDate.toISOString()).toBe(
      "2028-01-01T00:00:00.000Z"
    );
  });
});
