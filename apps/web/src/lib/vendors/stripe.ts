/**
 * Payments vendor selection — the single import point for routes.
 *
 * LIVE (real Stripe, TEST or live keys) is chosen when `STRIPE_SECRET_KEY` is a
 * plausible key AND we're not explicitly forced to the mock. Otherwise the MOCK
 * is used — which is what CI, e2e and `docker compose` do (no key configured),
 * so every existing test keeps passing unchanged.
 *
 * `STRIPE_FORCE_MOCK=true` pins the mock even when a key is present (handy for a
 * deploy that wants the deterministic mock, or to disable live billing fast).
 */
import { paymentsVendor as mockPaymentsVendor } from "@/lib/vendors/stripe.mock";
import { stripeLiveVendor } from "@/lib/vendors/stripe.live";
import type { PaymentsVendor } from "@/lib/vendors/types";

export type PaymentsVendorKind = "live" | "mock";

/** Which vendor the current environment selects (pure — safe to unit-test). */
export function selectedPaymentsVendorKind(): PaymentsVendorKind {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || !key.startsWith("sk_")) return "mock";
  if (process.env.STRIPE_FORCE_MOCK === "true") return "mock";
  return "live";
}

/** Resolve the active payments vendor at call time (env is read each call). */
export function getPaymentsVendor(): PaymentsVendor {
  return selectedPaymentsVendorKind() === "live"
    ? stripeLiveVendor
    : mockPaymentsVendor;
}
