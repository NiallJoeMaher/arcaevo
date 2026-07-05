/**
 * Unit tests for the live-vs-mock checkout branch (src/lib/checkout-action.ts).
 *
 * Regression guard for the payment-gating hole: in LIVE mode the client must
 * redirect to the real hosted Stripe Checkout URL and must NOT fire a browser
 * webhook (which would grant membership with €0 collected). In MOCK mode the
 * existing browser mock-webhook flow is preserved unchanged for dev/e2e.
 */
import { describe, expect, it } from "vitest";
import { resolveCheckoutAction } from "@/lib/checkout-action";

describe("resolveCheckoutAction", () => {
  it("LIVE: redirects to the hosted Stripe Checkout url (no browser webhook)", () => {
    const action = resolveCheckoutAction(true, {
      checkout: { url: "https://checkout.stripe.com/c/pay/cs_test_123" },
      member: { id: "mem_1" },
    });
    expect(action).toEqual({
      kind: "redirect",
      url: "https://checkout.stripe.com/c/pay/cs_test_123",
    });
  });

  it("LIVE but no hosted url: fails closed (error, never activates)", () => {
    expect(resolveCheckoutAction(true, { checkout: null }).kind).toBe("error");
    expect(resolveCheckoutAction(true, { checkout: { url: "" } }).kind).toBe(
      "error"
    );
    expect(resolveCheckoutAction(true, {}).kind).toBe("error");
  });

  it("MOCK: uses the browser mock-webhook flow, even if a url is present", () => {
    // The mock vendor returns a non-hosted url; it must be ignored in mock mode.
    expect(
      resolveCheckoutAction(false, {
        checkout: { url: "https://example.test/mock-not-hosted" },
        member: { id: "mem_1" },
      })
    ).toEqual({ kind: "mock-webhook" });
    expect(resolveCheckoutAction(false, {}).kind).toBe("mock-webhook");
  });
});
