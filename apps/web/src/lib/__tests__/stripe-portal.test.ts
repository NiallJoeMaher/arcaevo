/**
 * Stripe Customer Portal — self-service billing (docs/STRIPE_SETUP.md §5,
 * MOCKED_APIS §2). Two layers:
 *  1. The MOCK vendor's createBillingPortalSession — deterministic fake URL,
 *     same fnv1a pattern as the mock checkout (no keys, no network).
 *  2. POST /api/v1/account/portal — member with a stripeCustomerId → { url };
 *     member without one → 409 (handled, never crashes). Consent guard +
 *     payments vendor are stubbed; their real behaviour has its own suites.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { paymentsVendor } from "@/lib/vendors/stripe.mock";

// --- 1. mock vendor method ----------------------------------------------------

describe("StripeMock.createBillingPortalSession", () => {
  it("returns a deterministic fake portal URL (bps_mock_ prefixed)", async () => {
    const a = await paymentsVendor.createBillingPortalSession(
      "cus_123",
      "https://arcaevo.com/account"
    );
    const b = await paymentsVendor.createBillingPortalSession(
      "cus_123",
      "https://arcaevo.com/account"
    );
    expect(a.url).toBe(b.url);
    expect(a.url).toMatch(
      /^https:\/\/billing\.stripe\.mock\/p\/session\/bps_mock_[0-9a-f]{8}$/
    );
  });

  it("varies the URL by customer id and return url", async () => {
    const base = await paymentsVendor.createBillingPortalSession(
      "cus_123",
      "https://arcaevo.com/account"
    );
    const otherCustomer = await paymentsVendor.createBillingPortalSession(
      "cus_456",
      "https://arcaevo.com/account"
    );
    const otherReturn = await paymentsVendor.createBillingPortalSession(
      "cus_123",
      "https://arcaevo.com/billing"
    );
    expect(base.url).not.toBe(otherCustomer.url);
    expect(base.url).not.toBe(otherReturn.url);
  });
});

// --- 2. the route -------------------------------------------------------------

const authState = vi.hoisted(() => ({
  member: null as { _id: string; stripeCustomerId?: string | null } | null,
}));

vi.mock("@/lib/consent-guard", () => ({
  requireConsentedMember: async () =>
    authState.member
      ? { member: authState.member, denied: null }
      : {
          member: null,
          denied: Response.json({ error: "consent_required" }, { status: 403 }),
        },
}));

const portalSpy = vi.hoisted(() => ({
  fn: vi.fn(async (_customerId: string, _returnUrl: string) => ({
    url: "https://billing.stripe.test/session/xyz",
  })),
}));

vi.mock("@/lib/vendors/stripe", () => ({
  getPaymentsVendor: () => ({ createBillingPortalSession: portalSpy.fn }),
}));

async function post() {
  const { POST } = await import("@/app/api/v1/account/portal/route");
  return POST(new Request("http://test/api/v1/account/portal", { method: "POST" }));
}

describe("POST /api/v1/account/portal", () => {
  afterEach(() => {
    authState.member = null;
    portalSpy.fn.mockClear();
  });

  it("has a stripeCustomerId → 200 { url } from a portal session", async () => {
    authState.member = { _id: "mem_0001", stripeCustomerId: "cus_live_1" };
    const res = await post();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.url).toBe("https://billing.stripe.test/session/xyz");
    // Called with the member's customer id + an /account return url.
    expect(portalSpy.fn).toHaveBeenCalledOnce();
    const [customerId, returnUrl] = portalSpy.fn.mock.calls[0];
    expect(customerId).toBe("cus_live_1");
    expect(returnUrl).toMatch(/\/account$/);
  });

  it("no stripeCustomerId → 409 handled, vendor never called", async () => {
    authState.member = { _id: "mem_0002", stripeCustomerId: null };
    const res = await post();
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe("no_stripe_customer");
    expect(portalSpy.fn).not.toHaveBeenCalled();
  });

  it("propagates the guard's denial when consent/auth fails", async () => {
    authState.member = null; // guard denies
    const res = await post();
    expect(res.status).toBe(403);
    expect(portalSpy.fn).not.toHaveBeenCalled();
  });

  it("vendor throwing (e.g. portal not configured live) → 502, not a crash", async () => {
    authState.member = { _id: "mem_0003", stripeCustomerId: "cus_live_3" };
    portalSpy.fn.mockRejectedValueOnce(
      new Error("Stripe POST /billing_portal/sessions failed: not configured")
    );
    const res = await post();
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).toBe("portal_unavailable");
  });
});
