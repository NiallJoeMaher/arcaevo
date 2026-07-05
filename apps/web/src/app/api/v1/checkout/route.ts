/**
 * POST /api/v1/checkout — create a membership checkout session (design §07).
 *
 * Body: { tier, cadenceUpgrade?, eircode?, email?, name?, dob? }
 *
 * Rules enforced SERVER-SIDE (never trust the pricing page):
 *  - Essential/Performance require an eligible Eircode routing key (§06).
 *    Fusion is never gated — sold worldwide.
 *  - Signed-in members skip account creation; guests create the account
 *    inline (email required; E1 verify email goes out; checkout continues).
 *  - Annual billing only. Quarterly upgrade +€130/yr (Essential only).
 *  - Payment happens on the WEB via the MOCK Stripe vendor (+ Apple Pay on
 *    web, which is just a Stripe payment method — same mock session).
 *
 * The membership starts as "pending"; the Stripe webhook
 * (checkout.session.completed) activates it and sends the E4 receipt.
 */
import { memberFromRequest } from "@/lib/auth";
import { AnalyticsEvent, capture } from "@/lib/analytics";
import { logError } from "@/lib/log";
import { parseJsonBody, siteUrl } from "@/lib/api";
import { collections } from "@/lib/db";
import { newId } from "@/lib/ids";
import { checkEligibility } from "@/lib/eligibility";
import { sendEmail } from "@/lib/emails";
import { createMemberUser, issueMagicLink } from "@/lib/member-auth";
import { recordAttribution } from "@/lib/referral";
import {
  CADENCE_UPGRADE_EUR,
  CheckoutInput,
  TIER_PRICE_EUR,
  type Membership,
} from "@/lib/models";
import { getPaymentsVendor } from "@/lib/vendors/stripe";
import { STRIPE_SKUS, skuForTier } from "@/lib/vendors/stripe-config";

export async function POST(req: Request) {
  const parsed = await parseJsonBody(req, CheckoutInput);
  if (!parsed.ok) return parsed.response;
  const { tier, cadenceUpgrade, eircode, email, name, ref } = parsed.data;

  // --- step 1: eligibility (Essential/Performance only — Fusion never gated)
  if (tier !== "fusion") {
    if (!eircode) {
      return Response.json(
        {
          error: "eircode_required",
          message:
            "Essential and Performance ship kits / send a nurse — we need your Eircode routing key first.",
        },
        { status: 422 }
      );
    }
    const eligibility = await checkEligibility(eircode);
    if (eligibility.status === "invalid") {
      return Response.json(
        {
          error: "invalid_eircode",
          message:
            "That doesn't look like an Eircode — we only need the first 3 characters (e.g. D08).",
        },
        { status: 422 }
      );
    }
    if (eligibility.status === "ineligible") {
      return Response.json(
        {
          error: "not_in_service_area",
          message: `Not in ${eligibility.county} yet — but you're next. Join the early-access list, or start with Fusion (€119/yr, no shipping).`,
          routingKey: eligibility.routingKey,
          county: eligibility.county,
          waitlist: true,
        },
        { status: 403 }
      );
    }
  }

  if (cadenceUpgrade && tier !== "essential") {
    return Response.json(
      {
        error: "invalid_upgrade",
        message: "The quarterly cadence upgrade applies to Essential only.",
      },
      { status: 422 }
    );
  }

  // --- step 2: who's buying? Signed-in member, or guest account inline. -----
  let member = await memberFromRequest(req);
  let guestCreated = false;
  if (!member) {
    if (!email) {
      return Response.json(
        {
          error: "email_required",
          message:
            "Sign in, or pass an email — we'll create your account as part of checkout.",
        },
        { status: 401 }
      );
    }
    const users = await collections.users();
    member = await users.findOne({ email: email.toLowerCase() });
    if (!member) {
      capture(AnalyticsEvent.SignupStarted, { source: "checkout" });
      member = await createMemberUser({ email, name });
      guestCreated = true;
      // Referral attribution for a guest who checks out straight from a
      // `?ref=<code>` link (never for an existing/signed-in member). Best-effort
      // — a bad code is ignored and must not break checkout.
      if (ref) {
        try {
          await recordAttribution({ referredUser: member, code: ref });
        } catch (err) {
          logError("checkout.referral_attribution", err, { memberId: member._id });
        }
      }
      capture(AnalyticsEvent.SignupCompleted, { source: "checkout" }, member._id);
      // Guest signup inline: the E1 verify email rides along with checkout.
      // A failing mailer must NOT kill checkout — log it and continue (the
      // member can still verify later); silent swallow is what we're fixing.
      try {
        const issued = await issueMagicLink(email, "verify");
        if (!issued.throttled) {
          await sendEmail("e1_verify", email.toLowerCase(), {
            confirmUrl: `${siteUrl()}/verify?token=${issued.token}`,
            code: issued.code,
            codeUrl: `${siteUrl()}/signin?email=${encodeURIComponent(email.toLowerCase())}`,
          });
        }
      } catch (err) {
        logError("checkout.guest_verify_email", err, { memberId: member._id });
      }
    }
  }

  // One live membership per member.
  const memberships = await collections.memberships();
  const existing = await memberships.findOne({
    memberId: member._id,
    status: { $in: ["active", "past_due"] },
  });
  if (existing) {
    return Response.json(
      {
        error: "already_member",
        message: `You already have a ${existing.tier} membership — manage it in Account.`,
      },
      { status: 409 }
    );
  }

  // --- price + pending membership --------------------------------------------
  const priceEur =
    TIER_PRICE_EUR[tier] + (cadenceUpgrade ? CADENCE_UPGRADE_EUR : 0);
  const now = new Date();
  const renewalDate = new Date(now);
  renewalDate.setFullYear(renewalDate.getFullYear() + 1);

  const membership: Membership = {
    _id: newId("sub"), // collision-free (never `sub_${count+1}` — see lib/ids)
    memberId: member._id,
    tier,
    term: "annual",
    termStart: now,
    renewalDate,
    cadenceUpgrade,
    status: "pending", // webhook checkout.session.completed → active + E4
    priceEur,
    stripeSubscriptionId: null,
    dunningStage: "none",
    dunningStartedAt: null,
  };
  // Upsert on {memberId, status:"pending"} so a concurrent double-submit (or a
  // retried checkout) can only ever leave ONE pending membership per member —
  // the webhook then activates exactly one, never duplicate active memberships.
  const { _id: _ignoredId, ...membershipFields } = membership;
  const stored = await memberships.findOneAndUpdate(
    { memberId: member._id, status: "pending" },
    { $setOnInsert: { _id: membership._id }, $set: membershipFields },
    { upsert: true, returnDocument: "after" }
  );
  const savedMembership = stored ?? membership;

  // Funnel: checkout intent recorded. Enums/prices only — never PII/health.
  capture(
    AnalyticsEvent.CheckoutStarted,
    { tier, cadenceUpgrade: Boolean(cadenceUpgrade), priceEur },
    member._id
  );

  // --- Stripe checkout session (subscription; card + Apple Pay on web) --------
  // Memberships are subscriptions: one Billing Price per tier, plus the
  // quarterly-cadence upgrade as a second recurring line item when chosen.
  // (LIVE resolves these lookup_keys → price ids; the MOCK ignores them.)
  const lookupKeys = [skuForTier(tier).lookupKey];
  if (cadenceUpgrade) lookupKeys.push(STRIPE_SKUS.quarterly_upgrade.lookupKey);
  const checkout = await getPaymentsVendor().createCheckoutSession({
    memberId: member._id,
    description: `${tier} membership · 1 year${cadenceUpgrade ? " + quarterly cadence" : ""}`,
    amountEur: priceEur,
    mode: "subscription",
    lookupKeys,
    email: member.email,
    metadata: { tier, membershipId: savedMembership._id },
  });

  return Response.json(
    {
      checkout, // { sessionId, url, amountEur } — MOCK: url is not hosted
      membership: {
        id: savedMembership._id,
        tier,
        priceEur,
        status: savedMembership.status,
        renewalDate,
      },
      member: { id: member._id, email: member.email },
      guestAccountCreated: guestCreated,
      refundNote:
        "Full refund until your kit ships or your draw is booked.",
    },
    { status: 201 }
  );
}
