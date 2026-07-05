/**
 * POST /api/v1/webhooks/stripe
 *
 * TWO modes, chosen by whether `STRIPE_WEBHOOK_SECRET` is configured:
 *
 *  1. REAL (STRIPE_WEBHOOK_SECRET set) — verify the `Stripe-Signature` header
 *     against the signing secret over the RAW body (src/lib/stripe-signature.ts),
 *     then handle genuine Stripe events fired server-to-server:
 *       checkout.session.completed        → activate membership / mark add-on paid
 *       customer.subscription.updated      → status + cancel_at_period_end
 *       customer.subscription.deleted      → canceled
 *       invoice.paid                       → renew +1yr, resolve dunning
 *       invoice.payment_failed             → past_due + dunning ladder (E9 once)
 *
 *  2. MOCK/dev (no secret) — the interim shared-secret gate + simplified payload
 *     `{ type, data:{ memberId } }`, fired from the browser on /checkout so the
 *     e2e + docker stacks work without a Stripe account. UNCHANGED from before.
 *
 * See docs/MOCKED_APIS.md §2 and docs/STRIPE_SETUP.md.
 */
import { z } from "zod";
import { collections } from "@/lib/db";
import { verifyWebhookSecret } from "@/lib/env";
import { constructWebhookEvent, type StripeEvent } from "@/lib/stripe-signature";
import {
  isReadOnly,
  nextDunningStage,
  pauseDate,
  resolveDunning,
} from "@/lib/dunning";
import { sendEmail } from "@/lib/emails";
import { siteUrl } from "@/lib/api";
import type { Membership, User } from "@/lib/models";
import { mockSubscriptionId } from "@/lib/vendors/stripe.mock";

const WebhookPayload = z.object({
  type: z.enum([
    "checkout.session.completed",
    "invoice.paid",
    "invoice.payment_failed",
    "customer.subscription.deleted",
  ]),
  data: z.object({ memberId: z.string() }),
});

// MOCK: card metadata Stripe would put on the event.
const MOCK_CARD = "Visa ···· 4242";

function dayMonthLabel(date: Date): string {
  return new Intl.DateTimeFormat("en-IE", {
    day: "numeric",
    month: "long",
  }).format(date);
}

function tierLabel(tier: Membership["tier"]): string {
  return tier.charAt(0).toUpperCase() + tier.slice(1);
}

async function sendReceipt(member: User, membership: Membership, now: Date) {
  // E4 — receipt/welcome. Invoice number is a deterministic mock.
  await sendEmail("e4_receipt", member.email, {
    firstName: member.name.split(" ")[0],
    tierLabel: tierLabel(membership.tier),
    priceEur: membership.priceEur,
    cardSummary: MOCK_CARD,
    dateLabel: `${dayMonthLabel(now)} ${now.getFullYear()}`,
    invoiceNumber: `${now.getFullYear()}-${membership._id.replace(/\D/g, "").padStart(4, "0")}`,
    appUrl: `${siteUrl()}/app`,
  });
}

export async function POST(req: Request) {
  // ── REAL Stripe signature verification (production) ──────────────────────
  if (process.env.STRIPE_WEBHOOK_SECRET) {
    const raw = await req.text();
    const event = constructWebhookEvent(
      raw,
      req.headers.get("stripe-signature"),
      process.env.STRIPE_WEBHOOK_SECRET
    );
    if (!event) {
      // Bad/expired signature, or unparseable body → 400 (Stripe retries).
      return Response.json(
        { error: "invalid_signature" },
        { status: 400 }
      );
    }
    return handleRealEvent(event);
  }

  // ── MOCK path (dev/e2e/docker): shared-secret gate + simplified payload ──
  if (
    !verifyWebhookSecret(req, "STRIPE_WEBHOOK_SECRET", "x-arcaevo-webhook-secret")
  ) {
    return Response.json(
      { error: "unauthorized", message: "Missing or invalid webhook secret." },
      { status: 401 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { error: "bad_request", message: "Expected JSON body." },
      { status: 400 }
    );
  }
  const parsed = WebhookPayload.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "validation", issues: parsed.error.issues },
      { status: 400 }
    );
  }
  const { type, data } = parsed.data;

  const memberships = await collections.memberships();
  // Prefer the live membership; fall back to a pending checkout.
  const membership =
    (await memberships.findOne({
      memberId: data.memberId,
      status: { $in: ["active", "past_due", "pending"] },
    })) ?? (await memberships.findOne({ memberId: data.memberId }));
  if (!membership) {
    return Response.json(
      { error: "not_found", message: `No membership for ${data.memberId}.` },
      { status: 404 }
    );
  }
  const member = await collections
    .users()
    .then((c) => c.findOne({ _id: data.memberId }));

  const now = new Date();

  switch (type) {
    case "checkout.session.completed": {
      await memberships.updateOne(
        { _id: membership._id },
        {
          $set: {
            status: "active",
            stripeSubscriptionId: mockSubscriptionId(data.memberId),
            ...resolveDunning(),
          },
        }
      );
      // E4 — "You're a member — here's everything".
      if (member) await sendReceipt(member, membership, now);
      break;
    }
    case "invoice.paid": {
      // Annual term: renewal moves forward one year from the previous date.
      const renewed = new Date(membership.renewalDate);
      renewed.setFullYear(renewed.getFullYear() + 1);
      await memberships.updateOne(
        { _id: membership._id },
        {
          $set: {
            status: "active",
            renewalDate: renewed,
            // Instant resume — unused tests carry over, nothing was deleted.
            ...resolveDunning(),
          },
        }
      );
      break;
    }
    case "invoice.payment_failed": {
      // Dunning ladder: each failed charge/retry advances one stage.
      const stage = nextDunningStage(membership.dunningStage ?? "none");
      const startedAt = membership.dunningStartedAt ?? now;
      await memberships.updateOne(
        { _id: membership._id },
        {
          $set: {
            status: "past_due",
            dunningStage: stage,
            dunningStartedAt: startedAt,
          },
        }
      );
      // E9 on the FIRST failure only — retries stay quiet (banner, no email,
      // no pushes, no red — design §14 X2).
      if (stage === "day0" && member) {
        await sendEmail("e9_payment_failed", member.email, {
          cardSummary: MOCK_CARD,
          pauseDateLabel: dayMonthLabel(pauseDate(startedAt)),
          updateCardUrl: `${siteUrl()}/account`,
        });
      }
      return Response.json({
        ok: true,
        type,
        memberId: data.memberId,
        dunningStage: stage,
        readOnly: isReadOnly(stage),
      });
    }
    case "customer.subscription.deleted":
      await memberships.updateOne(
        { _id: membership._id },
        { $set: { status: "canceled" } }
      );
      break;
  }

  return Response.json({ ok: true, type, memberId: data.memberId });
}

// ---------------------------------------------------------------------------
// REAL event handling (genuine Stripe event envelopes)
// ---------------------------------------------------------------------------

/** Read a string field off an object (defensive). */
function str(obj: Record<string, unknown>, key: string): string | undefined {
  const v = obj[key];
  return typeof v === "string" ? v : undefined;
}

/** Read a metadata string off a Stripe object. */
function meta(obj: Record<string, unknown>, key: string): string | undefined {
  const m = obj.metadata as Record<string, unknown> | undefined;
  const v = m?.[key];
  return typeof v === "string" ? v : undefined;
}

/** The subscription id an invoice belongs to (handles nested `parent`). */
function invoiceSubscriptionId(
  inv: Record<string, unknown>
): string | undefined {
  const direct = str(inv, "subscription");
  if (direct) return direct;
  const parent = inv.parent as Record<string, unknown> | undefined;
  const details = parent?.subscription_details as
    | Record<string, unknown>
    | undefined;
  return details ? str(details, "subscription") : undefined;
}

/**
 * Claim a Stripe event id in the idempotency ledger. Returns true when the
 * event has ALREADY been processed (caller must no-op), false on the first,
 * winning delivery. Atomic via `$setOnInsert` upsert (upsertedCount===1 wins).
 *
 * When no event id is present (should not happen for genuine Stripe events —
 * `constructWebhookEvent` parses `id` from the body) we conservatively treat it
 * as fresh so we never drop a real renewal on a missing id.
 */
async function alreadyProcessed(
  eventId: string | undefined,
  type: string
): Promise<boolean> {
  if (!eventId) return false;
  const ledger = await collections.processedWebhookEvents();
  const res = await ledger.updateOne(
    { _id: eventId },
    { $setOnInsert: { type, processedAt: new Date() } },
    { upsert: true }
  );
  // First delivery inserts (upsertedCount 1); a retry matches the existing doc.
  return res.upsertedCount === 0;
}

async function findMembership(opts: {
  memberId?: string;
  subscriptionId?: string;
}): Promise<Membership | null> {
  const memberships = await collections.memberships();
  if (opts.memberId) {
    const byMember =
      (await memberships.findOne({
        memberId: opts.memberId,
        status: { $in: ["active", "past_due", "pending"] },
      })) ?? (await memberships.findOne({ memberId: opts.memberId }));
    if (byMember) return byMember;
  }
  if (opts.subscriptionId) {
    return memberships.findOne({ stripeSubscriptionId: opts.subscriptionId });
  }
  return null;
}

async function handleRealEvent(event: StripeEvent): Promise<Response> {
  const obj = event.data.object;
  const memberships = await collections.memberships();
  const users = await collections.users();
  const now = new Date();

  switch (event.type) {
    case "checkout.session.completed": {
      // Only grant access once funds have actually settled. With dynamic
      // payment methods an async method (e.g. SEPA/bank debit) can fire
      // `completed` while still `unpaid`; activating then would give a paid
      // membership before payment clears. `paid` = settled; `no_payment_required`
      // = €0/trial. `unpaid` → ack (200 so Stripe stops retrying) but do NOT
      // activate — subscriptions settle via `invoice.paid` (handled below); if
      // async one-off methods are ever enabled, add
      // `checkout.session.async_payment_succeeded` handling here.
      const paymentStatus = str(obj, "payment_status");
      if (paymentStatus && paymentStatus === "unpaid") {
        return Response.json({ ok: true, type: event.type, deferred: "unpaid" });
      }

      const orderId = meta(obj, "orderId");
      const memberId = meta(obj, "memberId");
      const subscriptionId =
        str(obj, "subscription") ?? undefined; // set for mode:subscription
      const customerId = str(obj, "customer");

      // One-off add-on / recheck (mode:payment) → mark the order paid.
      if (orderId) {
        await collections
          .testOrders()
          .then((c) =>
            c.updateOne({ _id: orderId }, { $set: { paidAt: now } })
          );
        return Response.json({ ok: true, type: event.type, orderId });
      }

      // Membership subscription → activate.
      const membership = await findMembership({ memberId, subscriptionId });
      if (!membership) {
        // Gift or unknown context — nothing to activate, ack so Stripe stops.
        return Response.json({ ok: true, type: event.type, ignored: "no_membership" });
      }
      await memberships.updateOne(
        { _id: membership._id },
        {
          $set: {
            status: "active",
            ...(subscriptionId
              ? { stripeSubscriptionId: subscriptionId }
              : {}),
            ...resolveDunning(),
          },
        }
      );
      if (customerId && membership.memberId.startsWith("mem")) {
        await users.updateOne(
          { _id: membership.memberId },
          { $set: { stripeCustomerId: customerId } }
        );
      }
      const member = await users.findOne({ _id: membership.memberId });
      if (member) await sendReceipt(member, membership, now);
      return Response.json({ ok: true, type: event.type, memberId: membership.memberId });
    }

    case "customer.subscription.updated": {
      const membership = await findMembership({
        memberId: meta(obj, "memberId"),
        subscriptionId: str(obj, "id"),
      });
      if (!membership) {
        return Response.json({ ok: true, type: event.type, ignored: "no_membership" });
      }
      const stripeStatus = str(obj, "status");
      const status: Membership["status"] =
        stripeStatus === "past_due" || stripeStatus === "unpaid"
          ? "past_due"
          : stripeStatus === "canceled" || stripeStatus === "incomplete_expired"
            ? "canceled"
            : "active";
      await memberships.updateOne(
        { _id: membership._id },
        {
          $set: {
            status,
            cancelAtPeriodEnd: obj.cancel_at_period_end === true,
            ...(str(obj, "id")
              ? { stripeSubscriptionId: str(obj, "id") }
              : {}),
          },
        }
      );
      return Response.json({
        ok: true,
        type: event.type,
        memberId: membership.memberId,
        status,
      });
    }

    case "customer.subscription.deleted": {
      const membership = await findMembership({
        memberId: meta(obj, "memberId"),
        subscriptionId: str(obj, "id"),
      });
      if (!membership) {
        return Response.json({ ok: true, type: event.type, ignored: "no_membership" });
      }
      await memberships.updateOne(
        { _id: membership._id },
        { $set: { status: "canceled", cancelAtPeriodEnd: false } }
      );
      return Response.json({ ok: true, type: event.type, memberId: membership.memberId });
    }

    case "invoice.paid": {
      // Idempotency (CRITICAL): Stripe delivers webhooks at-least-once and
      // retries on any non-2xx. Renewal advances the period by a WHOLE YEAR, so
      // a re-delivered `invoice.paid` would hand the member free years. Claim
      // the event id first; a duplicate delivery is a no-op. The claim is an
      // upsert with $setOnInsert (atomic, race-safe) keyed on the event id, so
      // even simultaneous duplicate deliveries can only apply the renewal once.
      if (await alreadyProcessed(event.id, event.type)) {
        return Response.json({ ok: true, type: event.type, deduped: true });
      }
      const subscriptionId = invoiceSubscriptionId(obj);
      const membership = await findMembership({
        memberId: meta(obj, "memberId"),
        subscriptionId,
      });
      if (!membership) {
        return Response.json({ ok: true, type: event.type, ignored: "no_membership" });
      }
      const renewed = new Date(membership.renewalDate);
      renewed.setFullYear(renewed.getFullYear() + 1);
      await memberships.updateOne(
        { _id: membership._id },
        {
          $set: { status: "active", renewalDate: renewed, ...resolveDunning() },
        }
      );
      return Response.json({ ok: true, type: event.type, memberId: membership.memberId });
    }

    case "invoice.payment_failed": {
      const subscriptionId = invoiceSubscriptionId(obj);
      const membership = await findMembership({
        memberId: meta(obj, "memberId"),
        subscriptionId,
      });
      if (!membership) {
        return Response.json({ ok: true, type: event.type, ignored: "no_membership" });
      }
      const stage = nextDunningStage(membership.dunningStage ?? "none");
      const startedAt = membership.dunningStartedAt ?? now;
      await memberships.updateOne(
        { _id: membership._id },
        {
          $set: {
            status: "past_due",
            dunningStage: stage,
            dunningStartedAt: startedAt,
          },
        }
      );
      if (stage === "day0") {
        const member = await users.findOne({ _id: membership.memberId });
        if (member) {
          await sendEmail("e9_payment_failed", member.email, {
            cardSummary: MOCK_CARD,
            pauseDateLabel: dayMonthLabel(pauseDate(startedAt)),
            updateCardUrl: `${siteUrl()}/account`,
          });
        }
      }
      return Response.json({
        ok: true,
        type: event.type,
        memberId: membership.memberId,
        dunningStage: stage,
        readOnly: isReadOnly(stage),
      });
    }

    default:
      // Unhandled event type — ack so Stripe stops retrying.
      return Response.json({ ok: true, ignored: event.type });
  }
}
