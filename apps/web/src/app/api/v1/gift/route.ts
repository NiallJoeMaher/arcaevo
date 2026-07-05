/**
 * POST /api/v1/gift — buy a gift year of Essential (design §16 R2).
 *
 * Body: { purchaserEmail, recipientEmail?, note?, delivery }
 *
 * "You pay today; their year starts when they activate, not when you buy."
 * The buyer gets one email when it's activated and NEVER sees health data.
 * MOCK: payment via the mock Stripe vendor; code delivery via the outbox.
 */
import { randomBytes } from "node:crypto";
import { parseJsonBody } from "@/lib/api";
import { collections } from "@/lib/db";
import { bloodTiersEnabled } from "@/lib/env";
import { CODE_ALPHABET } from "@/lib/member-auth";
import { GiftCreateInput, TIER_PRICE_EUR, type GiftCode } from "@/lib/models";
import { getPaymentsVendor } from "@/lib/vendors/stripe";

/**
 * CSPRNG gift code (security audit W-3). Uses the same unambiguous 32-char
 * alphabet as the magic-link codes (no 0/O/1/I) — 32 is a whole multiple of
 * 256, so `byte % 32` is bias-free. 16 chars ⇒ 16 × log2(32) = 80 bits of
 * entropy, replacing the old ~32-bit FNV-1a-derived code that was brute-
 * forceable regardless of its 8-char rendering.
 */
const GIFT_CODE_LENGTH = 16;

function giftCode(): string {
  const bytes = randomBytes(GIFT_CODE_LENGTH);
  let code = "";
  for (let i = 0; i < GIFT_CODE_LENGTH; i++) {
    code += CODE_ALPHABET[bytes[i]! % CODE_ALPHABET.length];
  }
  return `GIFT-${code.slice(0, 4)}-${code.slice(4, 8)}-${code.slice(
    8,
    12
  )}-${code.slice(12, 16)}`;
}

export async function POST(req: Request) {
  // Blood-tier feature gate — gifting is Essential-only (a blood tier), so
  // when blood tiers are off we can't sell an unfulfillable gift year.
  if (!bloodTiersEnabled()) {
    return Response.json(
      {
        error: "blood_tiers_unavailable",
        message:
          "Gift memberships aren't available yet — the Essential gift year opens once our lab partner and clinician are live.",
      },
      { status: 403 }
    );
  }

  const parsed = await parseJsonBody(req, GiftCreateInput);
  if (!parsed.ok) return parsed.response;
  const { purchaserEmail, recipientEmail, note, delivery } = parsed.data;

  const giftCodes = await collections.giftCodes();
  // 80-bit CSPRNG code (see giftCode) — no purchaser-derived seed, so concurrent
  // gifts from the same purchaser can't collide on insert.
  const code = giftCode();

  const gift: GiftCode = {
    _id: code,
    tier: "essential", // gifting is Essential-only at launch (design §16)
    priceEur: TIER_PRICE_EUR.essential,
    purchaserEmail: purchaserEmail.toLowerCase(),
    recipientEmail: recipientEmail?.toLowerCase() ?? null,
    note: note ?? null,
    delivery,
    createdAt: new Date(),
    redeemedBy: null,
    redeemedAt: null,
  };
  await giftCodes.insertOne(gift);

  // Stripe checkout for the €329 gift purchase. A gift is a ONE-OFF payment
  // (buyer pays today; the recipient's own subscription starts at activation),
  // so mode:"payment" with an inline price — not the recurring Essential Price.
  const checkout = await getPaymentsVendor().createCheckoutSession({
    memberId: `gift:${purchaserEmail.toLowerCase()}`,
    description: `Gift Essential — 1 year (${code})`,
    amountEur: gift.priceEur,
    mode: "payment",
    email: purchaserEmail.toLowerCase(),
    metadata: { giftCode: code, kind: "gift" },
  });

  return Response.json(
    {
      code,
      priceEur: gift.priceEur,
      delivery,
      checkout,
      note:
        "Their year starts when they activate, not when you buy. Recipient outside Dublin? The gift converts to Fusion + waitlist priority, or a full refund — their choice.",
    },
    { status: 201 }
  );
}
