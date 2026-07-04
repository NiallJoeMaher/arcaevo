/**
 * POST /api/v1/account/portal — open the Stripe Customer Portal (design §10
 * W10 billing management: update card, invoices, plan switch, cancel renewal).
 *
 * Member-auth only (NOT consent-guarded): billing management — especially
 * cancelling — must never be conditioned on health-data (Art. 9) consent, or a
 * member who withdraws consent could be trapped paying. Same posture as
 * /account/delete. Looks up the member's cached `stripeCustomerId` (created by
 * the LIVE Stripe vendor on first checkout) and mints a portal session that
 * returns the member to /account when they leave.
 *
 * If the member has no `stripeCustomerId` yet (never checked out via live
 * Stripe — e.g. a mock-seeded membership, or a free account), there is nothing
 * to manage in Stripe, so we return 409 with a clear message rather than
 * crashing. Works with either vendor: the MOCK returns a fake portal URL so
 * dev/e2e keep exercising the same UI path.
 */
import { siteUrl } from "@/lib/api";
import { requireMember } from "@/lib/auth";
import { getPaymentsVendor } from "@/lib/vendors/stripe";

export async function POST(req: Request) {
  const auth = await requireMember(req);
  if (auth.denied) return auth.denied;
  const member = auth.member;

  const customerId = member.stripeCustomerId;
  if (!customerId) {
    return Response.json(
      {
        error: "no_stripe_customer",
        message:
          "No billing profile yet — self-service billing opens once you've completed a checkout. Nothing to manage in the meantime.",
      },
      { status: 409 }
    );
  }

  const returnUrl = `${siteUrl()}/account`;
  try {
    const { url } = await getPaymentsVendor().createBillingPortalSession(
      customerId,
      returnUrl
    );
    return Response.json({ url });
  } catch {
    // The vendor throws Stripe's message (never the key). The most common live
    // cause is the portal not being configured in the Dashboard yet.
    return Response.json(
      {
        error: "portal_unavailable",
        message:
          "Billing management is temporarily unavailable. Please try again shortly.",
      },
      { status: 502 }
    );
  }
}
