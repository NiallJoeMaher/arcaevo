/**
 * POST /api/v1/webhooks/stripe — MOCK webhook (docs/MOCKED_APIS.md §2).
 *
 * Payload is a simplified echo of Stripe's event envelope:
 *   { "type": "invoice.paid", "data": { "memberId": "mem_0001" } }
 *
 * Supported types (advance membership state):
 *   checkout.session.completed → membership active (+ mock subscription id)
 *   invoice.paid               → membership active, renewal pushed +1 year
 *   invoice.payment_failed     → membership past_due
 *   customer.subscription.deleted → membership canceled
 */
import { z } from "zod";
import { collections } from "@/lib/db";
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
  const membership = await memberships.findOne({ memberId: data.memberId });
  if (!membership) {
    return Response.json(
      { error: "not_found", message: `No membership for ${data.memberId}.` },
      { status: 404 }
    );
  }

  switch (type) {
    case "checkout.session.completed":
      await memberships.updateOne(
        { _id: membership._id },
        {
          $set: {
            status: "active",
            stripeSubscriptionId: mockSubscriptionId(data.memberId),
          },
        }
      );
      break;
    case "invoice.paid": {
      // Annual term: renewal moves forward one year from the previous date.
      const renewed = new Date(membership.renewalDate);
      renewed.setFullYear(renewed.getFullYear() + 1);
      await memberships.updateOne(
        { _id: membership._id },
        { $set: { status: "active", renewalDate: renewed } }
      );
      break;
    }
    case "invoice.payment_failed":
      await memberships.updateOne(
        { _id: membership._id },
        { $set: { status: "past_due" } }
      );
      break;
    case "customer.subscription.deleted":
      await memberships.updateOne(
        { _id: membership._id },
        { $set: { status: "canceled" } }
      );
      break;
  }

  return Response.json({ ok: true, type, memberId: data.memberId });
}
