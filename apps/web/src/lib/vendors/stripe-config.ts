/**
 * Stripe SKU catalogue — the single source of truth mapping Arcaevo products to
 * stable Billing Price `lookup_key`s. `scripts/stripe-setup.ts` creates a
 * Product + Price for each entry (idempotently, keyed by lookup_key); the LIVE
 * vendor (stripe.live.ts) resolves a lookup_key → price id at runtime.
 *
 * Prices are CONTRACTUAL (design_handoff / models.ts) — verbatim, do not change:
 *   Fusion €119 · Essential €329 · Performance €399 · quarterly upgrade +€130 ·
 *   add-ons €99 full / €69 recheck / €199 venous · €69 recheck kit.
 *
 * Memberships are SUBSCRIPTIONS (recurring/year); add-ons + recheck are one-off
 * payments. This module is dependency-free (importable anywhere, incl. scripts).
 */
import type { MembershipTier, TestPanel } from "@/lib/models";
import type { VendorCheckoutMode } from "@/lib/vendors/types";

export interface StripeSku {
  /** Stable lookup_key — never changes once live (used to resolve price ids). */
  lookupKey: string;
  /** Human product name shown on the Checkout page + Stripe Dashboard. */
  name: string;
  /** Price in whole EUR (×100 for Stripe's minor-unit `unit_amount`). */
  amountEur: number;
  /** subscription = recurring/year; payment = one-off. */
  mode: VendorCheckoutMode;
}

/** Every SKU we sell, keyed by a short internal name. */
export const STRIPE_SKUS = {
  fusion_annual: {
    lookupKey: "arcaevo_fusion_annual",
    name: "Arcaevo Fusion — annual membership",
    amountEur: 119,
    mode: "subscription",
  },
  essential_annual: {
    lookupKey: "arcaevo_essential_annual",
    name: "Arcaevo Essential — annual membership",
    amountEur: 329,
    mode: "subscription",
  },
  performance_annual: {
    lookupKey: "arcaevo_performance_annual",
    name: "Arcaevo Performance — annual membership",
    amountEur: 399,
    mode: "subscription",
  },
  quarterly_upgrade: {
    lookupKey: "arcaevo_quarterly_upgrade",
    name: "Quarterly cadence upgrade (Essential)",
    amountEur: 130,
    mode: "subscription",
  },
  addon_full_panel: {
    lookupKey: "arcaevo_addon_full_panel",
    name: "Add-on — full panel finger-prick test",
    amountEur: 99,
    mode: "payment",
  },
  addon_recheck: {
    lookupKey: "arcaevo_addon_recheck",
    name: "Add-on — recheck test",
    amountEur: 69,
    mode: "payment",
  },
  addon_venous: {
    lookupKey: "arcaevo_addon_venous",
    name: "Add-on — venous (80-marker) draw",
    amountEur: 199,
    mode: "payment",
  },
  recheck_kit: {
    lookupKey: "arcaevo_recheck_kit",
    name: "Recheck kit",
    amountEur: 69,
    mode: "payment",
  },
} as const satisfies Record<string, StripeSku>;

export type StripeSkuName = keyof typeof STRIPE_SKUS;

/** All SKUs as a flat list (used by the setup script). */
export const ALL_SKUS: StripeSku[] = Object.values(STRIPE_SKUS);

/** Annual membership subscription SKU for a tier. */
export function skuForTier(tier: MembershipTier): StripeSku {
  return STRIPE_SKUS[`${tier}_annual` as StripeSkuName];
}

/** One-off add-on SKU for a test panel. */
export function skuForPanel(panel: TestPanel): StripeSku {
  const byPanel: Record<TestPanel, StripeSku> = {
    full: STRIPE_SKUS.addon_full_panel,
    recheck: STRIPE_SKUS.addon_recheck,
    venous80: STRIPE_SKUS.addon_venous,
  };
  return byPanel[panel];
}

/**
 * Env var that can pin a resolved price id for a lookup_key, e.g.
 * `arcaevo_fusion_annual` → `STRIPE_PRICE_ARCAEVO_FUSION_ANNUAL`. When set, the
 * live vendor uses it directly and skips the API lookup (faster, deterministic).
 */
export function priceIdEnvVar(lookupKey: string): string {
  return `STRIPE_PRICE_${lookupKey.toUpperCase()}`;
}
