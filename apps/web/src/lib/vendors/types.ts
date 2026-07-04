/**
 * Vendor interfaces. Every external integration hides behind one of these so
 * swapping a mock for the real client is a one-file change.
 * See docs/MOCKED_APIS.md for the productionisation checklist.
 */
import type { TestOrderStatus, TestPanel } from "@/lib/models";

// ---------------------------------------------------------------------------
// Blood testing (LetsGetChecked — MOCKED, shapes are OUR GUESSES)
// ---------------------------------------------------------------------------

export interface VendorKitOrder {
  vendorOrderId: string;
  status: TestOrderStatus;
}

export interface VendorBiomarkerResult {
  /** Our BiomarkerRule code (real LGC codes would need mapping). */
  code: string;
  value: number;
  unit: string;
}

export interface BloodTestVendor {
  /** Place a test order; returns the vendor's order id + initial status. */
  createKitOrder(memberId: string, panel: TestPanel): Promise<VendorKitOrder>;
  /** Current status; the MOCK advances its fake state machine on each call. */
  getOrderStatus(vendorOrderId: string): Promise<TestOrderStatus>;
  /** Biomarker values once results are ready (MOCK: seeded, deterministic). */
  getResults(vendorOrderId: string): Promise<VendorBiomarkerResult[]>;
}

// ---------------------------------------------------------------------------
// Payments (Stripe — MOCKED)
// ---------------------------------------------------------------------------

export interface VendorCheckoutSession {
  sessionId: string;
  /** MOCK: fake URL — nothing is hosted there. */
  url: string;
  amountEur: number;
}

export interface VendorSubscription {
  subscriptionId: string;
  status: "active" | "past_due" | "canceled";
  priceEur: number;
}

export interface VendorRefundResult {
  refunded: boolean;
  amountEur: number;
  reason: string;
}

/** Stripe Checkout mode: memberships are subscriptions, add-ons are one-off. */
export type VendorCheckoutMode = "subscription" | "payment";

export interface CreateCheckoutSessionParams {
  memberId: string;
  description: string;
  amountEur: number;
  // --- fields below are used ONLY by the LIVE vendor; the MOCK ignores them
  //     (so all existing callers/tests keep their 3-field behaviour) ----------
  /** subscription (annual tiers) | payment (add-ons/recheck). Live default: payment. */
  mode?: VendorCheckoutMode;
  /** Billing Price lookup_keys to bill (resolved to price ids at runtime). When
   *  omitted the live vendor falls back to an inline price for `amountEur`. */
  lookupKeys?: string[];
  /** Prefill / attach the customer email (guests). */
  email?: string | null;
  /** Extra metadata copied onto the session + (for subscriptions) the sub. */
  metadata?: Record<string, string>;
  /** Overrides for the post-checkout redirects. */
  successUrl?: string;
  cancelUrl?: string;
}

export interface PaymentsVendor {
  /** Create a checkout session for a membership or add-on purchase. */
  createCheckoutSession(
    params: CreateCheckoutSessionParams
  ): Promise<VendorCheckoutSession>;
  getSubscription(subscriptionId: string): Promise<VendorSubscription | null>;
  /**
   * Refund policy (enforced in OUR code, not Stripe): full refund before the
   * kit ships / draw is booked; none once the sample is processed.
   */
  refundOrder(params: {
    orderId: string;
    amountEur: number;
    orderStatus: TestOrderStatus;
  }): Promise<VendorRefundResult>;
}

// ---------------------------------------------------------------------------
// Email (MOCKED — writes to Mongo `outbox`, never sends)
// ---------------------------------------------------------------------------

export interface EmailVendor {
  send(params: {
    to: string;
    subject: string;
    body: string;
    template: string; // "receipt" | "kit_reminder" | "results_ready" | ...
  }): Promise<{ outboxId: string }>;
}
