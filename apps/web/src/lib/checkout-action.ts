/**
 * Post-`POST /api/v1/checkout` decision — pure so it's unit-testable without a
 * DOM. This is the fix for the payment-gating hole: in LIVE mode the browser
 * must hand off to Stripe's hosted Checkout (money is collected there and the
 * membership is activated ONLY by the real server-to-server webhook); it must
 * NEVER fire a browser webhook that would grant membership with €0 collected.
 * In MOCK mode (dev/e2e/docker) the existing browser mock-webhook flow is kept
 * exactly as-is.
 */
export interface CheckoutResponseData {
  checkout?: { url?: unknown } | null;
  member?: { id?: unknown } | null;
}

export type CheckoutAction =
  | { kind: "redirect"; url: string } // LIVE: go to hosted Stripe Checkout
  | { kind: "mock-webhook" } // MOCK: fire the browser webhook, then /welcome
  | { kind: "error" }; // LIVE but no hosted URL — fail closed

/**
 * Decide what the checkout client should do after a successful checkout POST.
 *
 * - LIVE (`paymentsLive`) with a hosted `url` → redirect (no browser webhook).
 * - LIVE without a usable `url` → error (never silently activate).
 * - MOCK → fire the browser mock webhook.
 */
export function resolveCheckoutAction(
  paymentsLive: boolean,
  data: CheckoutResponseData
): CheckoutAction {
  if (paymentsLive) {
    const url = data.checkout?.url;
    if (typeof url === "string" && url.length > 0) {
      return { kind: "redirect", url };
    }
    return { kind: "error" };
  }
  return { kind: "mock-webhook" };
}
