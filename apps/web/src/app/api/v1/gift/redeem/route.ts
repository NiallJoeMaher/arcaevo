/**
 * POST /api/v1/gift/redeem — activate a gift (design §16).
 *
 * Body: { code, eircode } — member auth required (redemption slots into the
 * normal sign-up flow: same account, same consent gate, same Eircode check).
 *
 * The membership YEAR STARTS NOW (at activation, not purchase). The buyer
 * gets exactly one email — "your gift was activated" — and never any data.
 * Outside Dublin: honest fallback — Fusion + waitlist priority, or a refund.
 */
import { requireMember } from "@/lib/auth";
import { parseJsonBody } from "@/lib/api";
import { collections } from "@/lib/db";
import { newId } from "@/lib/ids";
import { checkEligibility } from "@/lib/eligibility";
import { renderEmailLayout } from "@/lib/emails";
import { GiftRedeemInput, type Membership } from "@/lib/models";
import { GIFT_REDEEM_RATE_LIMIT, limitByIp } from "@/lib/rate-limit";
import { emailVendor } from "@/lib/vendors/email.mock";

export async function POST(req: Request) {
  // IP rate-limit BEFORE any lookup (security audit W-3): caps how fast an
  // authenticated attacker can grind for an unredeemed code.
  const limited = await limitByIp(req, "gift_redeem", GIFT_REDEEM_RATE_LIMIT);
  if (limited) return limited;

  const auth = await requireMember(req);
  if (auth.denied) return auth.denied;

  const parsed = await parseJsonBody(req, GiftRedeemInput);
  if (!parsed.ok) return parsed.response;

  const giftCodes = await collections.giftCodes();
  const gift = await giftCodes.findOne({
    _id: parsed.data.code.toUpperCase().trim(),
  });
  if (!gift) {
    return Response.json(
      { error: "unknown_code", message: "That code doesn't match a gift." },
      { status: 404 }
    );
  }
  if (gift.redeemedBy) {
    return Response.json(
      { error: "already_redeemed", message: "This gift was already activated." },
      { status: 409 }
    );
  }

  // Same Eircode gate as checkout, with the same honest fallback.
  const eligibility = await checkEligibility(parsed.data.eircode);
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
        message: `Not in ${eligibility.county} yet. Your gift can convert to Fusion + waitlist priority, or a full refund — your choice.`,
        county: eligibility.county,
        options: ["fusion_plus_waitlist_priority", "full_refund"],
      },
      { status: 403 }
    );
  }

  const memberships = await collections.memberships();
  const existing = await memberships.findOne({
    memberId: auth.member._id,
    status: { $in: ["active", "past_due"] },
  });
  if (existing) {
    return Response.json(
      {
        error: "already_member",
        message: "You already have a live membership — contact us and we'll sort the gift.",
      },
      { status: 409 }
    );
  }

  // Activate: the year starts today.
  const now = new Date();
  const renewalDate = new Date(now);
  renewalDate.setFullYear(renewalDate.getFullYear() + 1);
  const membership: Membership = {
    _id: newId("sub"), // collision-free (see lib/ids)
    memberId: auth.member._id,
    tier: gift.tier,
    term: "annual",
    termStart: now,
    renewalDate,
    cadenceUpgrade: false,
    status: "active", // pre-paid — no checkout step
    priceEur: gift.priceEur,
    stripeSubscriptionId: null,
    dunningStage: "none",
    dunningStartedAt: null,
  };
  await memberships.insertOne(membership);
  await giftCodes.updateOne(
    { _id: gift._id },
    { $set: { redeemedBy: auth.member._id, redeemedAt: now } }
  );

  // The buyer's one and only email — no health data, ever (design §16).
  await emailVendor.send({
    to: gift.purchaserEmail,
    subject: "Your gift was activated",
    body: renderEmailLayout({
      headline: "Your gift just came to life.",
      bodyHtml:
        '<p style="font-size:13px;line-height:1.6;color:#4A554D;margin:0 0 18px;">The Essential year you gifted has been activated. That\'s everything we\'ll ever tell you — their health data starts and ends with them.</p>',
      footerHtml: "Arcaevo Ltd · Dublin, Ireland",
    }),
    template: "gift_activated",
  });

  return Response.json({
    ok: true,
    membership: {
      id: membership._id,
      tier: membership.tier,
      termStart: now,
      renewalDate,
      status: "active",
    },
    giftNote: gift.note,
  });
}
