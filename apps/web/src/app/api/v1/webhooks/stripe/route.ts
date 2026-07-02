/**
 * POST /api/v1/webhooks/stripe — MOCK webhook (docs/MOCKED_APIS.md §2).
 *
 * Payload is a simplified echo of Stripe's event envelope:
 *   { "type": "invoice.paid", "data": { "memberId": "mem_0001" } }
 *
 * Supported types:
 *   checkout.session.completed → membership active (+ mock subscription id),
 *                                dunning cleared, E4 receipt email sent
 *   invoice.paid               → membership active, renewal +1 year,
 *                                dunning resolved (instant resume)
 *   invoice.payment_failed     → membership past_due + dunning ladder
 *                                advances (day 0 → 3 → 10 → 14 read-only
 *                                pause); first failure sends E9
 *   customer.subscription.deleted → membership canceled
 */
import { z } from "zod";
import { collections } from "@/lib/db";
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

// MOCK: no signature check — a real integration MUST verify
// `stripe-signature` against the webhook signing secret.
function verifySignature(_req: Request): boolean {
  return true; // MOCK: always accepted
}

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
  if (!verifySignature(req)) {
    return Response.json({ error: "bad_signature" }, { status: 401 });
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
