// MOCK: Stripe adapter — NOT a real integration. No keys, no network calls.
//
// See docs/MOCKED_APIS.md §2: to productionise, create a real Stripe account
// (EU entity) with Products/Prices for Fusion €119, Essential €329,
// Performance €399, quarterly-upgrade €130, add-ons €99/€69/€199, a real
// webhook signing secret, and Stripe Tax for IE VAT.
//
// Determinism: session/subscription ids derive from an fnv1a hash of the
// inputs — identical inputs always produce identical ids. No randomness.
import type { TestOrderStatus } from "@/lib/models";
import type {
  PaymentsVendor,
  VendorCheckoutSession,
  VendorRefundResult,
  VendorSubscription,
} from "@/lib/vendors/types";

function fnv1aHex(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/** Refund rule from the pricing FAQ: full refund before the kit ships / draw
 * is booked; none once the sample is processed. Enforced HERE, not by Stripe. */
export function isRefundable(orderStatus: TestOrderStatus): boolean {
  return orderStatus === "ordered";
}

class StripeMock implements PaymentsVendor {
  // MOCK: returns a fake checkout URL — nothing is hosted there.
  async createCheckoutSession(params: {
    memberId: string;
    description: string;
    amountEur: number;
  }): Promise<VendorCheckoutSession> {
    const sessionId = `cs_mock_${fnv1aHex(
      `${params.memberId}:${params.description}:${params.amountEur}`
    )}`;
    return {
      sessionId,
      url: `https://checkout.stripe.mock/pay/${sessionId}`,
      amountEur: params.amountEur,
    };
  }

  // MOCK: any well-formed mock id resolves to an active annual subscription.
  async getSubscription(
    subscriptionId: string
  ): Promise<VendorSubscription | null> {
    if (!subscriptionId.startsWith("sub_mock_")) return null;
    return { subscriptionId, status: "active", priceEur: 0 };
  }

  // MOCK: applies OUR refund policy and pretends the money moved.
  async refundOrder(params: {
    orderId: string;
    amountEur: number;
    orderStatus: TestOrderStatus;
  }): Promise<VendorRefundResult> {
    if (isRefundable(params.orderStatus)) {
      return {
        refunded: true,
        amountEur: params.amountEur,
        reason: "Full refund — kit not yet shipped / draw not yet booked.",
      };
    }
    return {
      refunded: false,
      amountEur: 0,
      reason:
        "No refund — the sample is already in motion (kit shipped, draw booked, or sample processed).",
    };
  }
}

/** Deterministic mock subscription id for a member (used by seed + webhooks). */
export function mockSubscriptionId(memberId: string): string {
  return `sub_mock_${fnv1aHex(memberId)}`;
}

/** The one PaymentsVendor the app uses. Swap for the real Stripe client here. */
export const paymentsVendor: PaymentsVendor = new StripeMock();
