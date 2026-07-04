/**
 * LIVE Stripe adapter — the real integration behind `PaymentsVendor`.
 *
 * No SDK is installed (repo forbids `npm install`), so this talks to Stripe's
 * REST API directly with `fetch` + form-encoded bodies. Swap to the official
 * `stripe` package later with no call-site changes (see docs/STRIPE_SETUP.md).
 *
 * Best-practice choices baked in (Stripe official guidance):
 *  - Memberships → Checkout `mode:"subscription"` on Billing Prices; add-ons →
 *    `mode:"payment"`. (src/lib/vendors/stripe-config.ts is the SKU catalogue.)
 *  - We NEVER pass `payment_method_types` — omitting it enables dynamic payment
 *    methods, so card / Apple Pay / Link appear automatically (configured in the
 *    Dashboard, not code). That is how "Stripe + Apple Pay on web" works.
 *  - `automatic_tax[enabled]=true` + address collection → IE VAT via Stripe Tax.
 *  - One Stripe Customer per member (keyed by memberId, cached on the user as
 *    `stripeCustomerId`) so tax, the Customer Portal and dunning stay coherent.
 *
 * Keys come from env (STRIPE_SECRET_KEY). They are never logged.
 */
import { collections } from "@/lib/db";
import { siteUrl } from "@/lib/api";
import type { TestOrderStatus } from "@/lib/models";
import { isRefundable } from "@/lib/vendors/stripe.mock";
import { priceIdEnvVar } from "@/lib/vendors/stripe-config";
import type {
  CreateCheckoutSessionParams,
  PaymentsVendor,
  VendorCheckoutSession,
  VendorRefundResult,
  VendorSubscription,
} from "@/lib/vendors/types";

/** Pin the API version so behaviour never shifts under us on a Stripe upgrade. */
export const STRIPE_API_VERSION = "2026-06-24.dahlia";
const STRIPE_API_BASE = "https://api.stripe.com/v1";

/** Flatten nested objects/arrays into Stripe's form bracket notation. */
function encodeForm(
  obj: unknown,
  prefix = "",
  out: URLSearchParams = new URLSearchParams()
): URLSearchParams {
  if (obj === null || obj === undefined) return out;
  if (Array.isArray(obj)) {
    obj.forEach((v, i) => encodeForm(v, `${prefix}[${i}]`, out));
  } else if (typeof obj === "object") {
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (v === undefined || v === null) continue;
      encodeForm(v, prefix ? `${prefix}[${k}]` : k, out);
    }
  } else {
    out.append(prefix, String(obj));
  }
  return out;
}

function secretKey(): string {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    // Never reached in practice — the factory only selects LIVE when a key is
    // present — but fail loud rather than send an unauthenticated request.
    throw new Error("STRIPE_SECRET_KEY is not set (LIVE Stripe vendor).");
  }
  return key;
}

async function stripeRequest<T = Record<string, unknown>>(
  method: "GET" | "POST",
  path: string,
  params?: Record<string, unknown>
): Promise<T> {
  const isGet = method === "GET";
  const body = params ? encodeForm(params).toString() : undefined;
  const url = isGet && body ? `${STRIPE_API_BASE}${path}?${body}` : `${STRIPE_API_BASE}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      "Stripe-Version": STRIPE_API_VERSION,
      ...(isGet ? {} : { "Content-Type": "application/x-www-form-urlencoded" }),
    },
    body: isGet ? undefined : body,
  });
  const json = (await res.json().catch(() => ({}))) as T & {
    error?: { message?: string; type?: string };
  };
  if (!res.ok) {
    // Surface Stripe's message but never echo the key or full request.
    const message = json?.error?.message ?? `Stripe API ${res.status}`;
    throw new Error(`Stripe ${method} ${path} failed: ${message}`);
  }
  return json;
}

// --- price id resolution (env override → API lookup by lookup_key, cached) ---
const priceIdCache = new Map<string, string>();

async function resolvePriceId(lookupKey: string): Promise<string> {
  const fromEnv = process.env[priceIdEnvVar(lookupKey)];
  if (fromEnv) return fromEnv;
  const cached = priceIdCache.get(lookupKey);
  if (cached) return cached;
  const list = await stripeRequest<{ data: Array<{ id: string }> }>(
    "GET",
    "/prices",
    { "lookup_keys[]": lookupKey, active: "true", limit: 1 }
  );
  const id = list.data?.[0]?.id;
  if (!id) {
    throw new Error(
      `No active Stripe price for lookup_key "${lookupKey}". Run ` +
        `\`npm run stripe:setup\` (or set ${priceIdEnvVar(lookupKey)}).`
    );
  }
  priceIdCache.set(lookupKey, id);
  return id;
}

// --- customer create / lookup, cached on the member ------------------------
async function resolveCustomerId(
  memberId: string,
  email?: string | null
): Promise<string | null> {
  // Only real members (mem_…) get a persisted customer; ad-hoc buyers (e.g.
  // gift purchases keyed "gift:email") let Checkout create a customer instead.
  if (!memberId.startsWith("mem")) return null;
  const users = await collections.users();
  const user = await users.findOne({ _id: memberId });
  if (user?.stripeCustomerId) return user.stripeCustomerId;

  const customer = await stripeRequest<{ id: string }>("POST", "/customers", {
    ...(email ? { email } : user?.email ? { email: user.email } : {}),
    ...(user?.name ? { name: user.name } : {}),
    metadata: { memberId },
  });
  await users.updateOne(
    { _id: memberId },
    { $set: { stripeCustomerId: customer.id } }
  );
  return customer.id;
}

class StripeLive implements PaymentsVendor {
  async createCheckoutSession(
    params: CreateCheckoutSessionParams
  ): Promise<VendorCheckoutSession> {
    const mode = params.mode ?? "payment";

    // Line items: resolve lookup_keys → price ids, else one inline price.
    let lineItems: Array<Record<string, unknown>>;
    if (params.lookupKeys && params.lookupKeys.length > 0) {
      const priceIds = await Promise.all(
        params.lookupKeys.map((k) => resolvePriceId(k))
      );
      lineItems = priceIds.map((price) => ({ price, quantity: 1 }));
    } else {
      lineItems = [
        {
          quantity: 1,
          price_data: {
            currency: "eur",
            unit_amount: Math.round(params.amountEur * 100),
            product_data: { name: params.description },
            ...(mode === "subscription"
              ? { recurring: { interval: "year" } }
              : {}),
          },
        },
      ];
    }

    const customerId = await resolveCustomerId(params.memberId, params.email);
    const metadata = {
      memberId: params.memberId,
      ...(params.metadata ?? {}),
    };

    const payload: Record<string, unknown> = {
      mode,
      line_items: lineItems,
      // Omit payment_method_types → dynamic methods (card/Apple Pay/Link).
      automatic_tax: { enabled: true },
      billing_address_collection: "required", // Stripe Tax needs an address
      metadata,
      success_url:
        params.successUrl ??
        `${siteUrl()}/welcome?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: params.cancelUrl ?? `${siteUrl()}/checkout`,
    };

    if (customerId) {
      payload.customer = customerId;
      payload.customer_update = { address: "auto", name: "auto" };
    } else if (params.email) {
      payload.customer_email = params.email;
      if (mode === "payment") payload.customer_creation = "always";
    } else if (mode === "payment") {
      payload.customer_creation = "always";
    }

    // Carry memberId onto the subscription too, so later invoice /
    // customer.subscription.* webhooks can resolve the member.
    if (mode === "subscription") {
      payload.subscription_data = { metadata };
    }

    const session = await stripeRequest<{
      id: string;
      url: string;
      amount_total: number | null;
    }>("POST", "/checkout/sessions", payload);

    return {
      sessionId: session.id,
      url: session.url,
      amountEur:
        session.amount_total != null
          ? session.amount_total / 100
          : params.amountEur,
    };
  }

  async getSubscription(
    subscriptionId: string
  ): Promise<VendorSubscription | null> {
    try {
      const sub = await stripeRequest<{
        id: string;
        status: string;
        items?: { data?: Array<{ price?: { unit_amount?: number } }> };
      }>("GET", `/subscriptions/${encodeURIComponent(subscriptionId)}`);
      const unit = sub.items?.data?.[0]?.price?.unit_amount ?? 0;
      const status: VendorSubscription["status"] =
        sub.status === "active" || sub.status === "trialing"
          ? "active"
          : sub.status === "past_due" || sub.status === "unpaid"
            ? "past_due"
            : "canceled";
      return { subscriptionId: sub.id, status, priceEur: unit / 100 };
    } catch {
      return null;
    }
  }

  /**
   * Arcaevo's refund POLICY is enforced in our code (full refund only while the
   * order is still "ordered"). We don't persist the per-order charge id, so a
   * real Stripe refund is left to the ops flow / Dashboard; this returns the
   * policy decision (same contract as the mock). See docs/STRIPE_SETUP.md.
   */
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

export const stripeLiveVendor: PaymentsVendor = new StripeLive();
