/**
 * POST /api/v1/gift — buy a gift year of Essential (design §16 R2).
 *
 * Body: { purchaserEmail, recipientEmail?, note?, delivery }
 *
 * "You pay today; their year starts when they activate, not when you buy."
 * The buyer gets one email when it's activated and NEVER sees health data.
 * MOCK: payment via the mock Stripe vendor; code delivery via the outbox.
 */
import { parseJsonBody } from "@/lib/api";
import { collections } from "@/lib/db";
import { GiftCreateInput, TIER_PRICE_EUR, type GiftCode } from "@/lib/models";
import { paymentsVendor } from "@/lib/vendors/stripe.mock";

/** Human-safe code alphabet (no 0/O/1/I). Deterministic per sequence+email. */
function giftCode(seq: number, purchaserEmail: string): string {
  const alphabet = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
  let h = 0x811c9dc5;
  const input = `${seq}:${purchaserEmail}`;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  let code = "";
  let value = h >>> 0;
  for (let i = 0; i < 8; i++) {
    code += alphabet[value % alphabet.length];
    value = Math.floor(value / alphabet.length) || (value ^ (seq + i)) >>> 0;
  }
  return `GIFT-${code.slice(0, 4)}-${code.slice(4)}`;
}

export async function POST(req: Request) {
  const parsed = await parseJsonBody(req, GiftCreateInput);
  if (!parsed.ok) return parsed.response;
  const { purchaserEmail, recipientEmail, note, delivery } = parsed.data;

  const giftCodes = await collections.giftCodes();
  const seq = (await giftCodes.countDocuments()) + 1;
  const code = giftCode(seq, purchaserEmail.toLowerCase());

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

  // MOCK Stripe checkout for the €329 gift purchase.
  const checkout = await paymentsVendor.createCheckoutSession({
    memberId: `gift:${purchaserEmail.toLowerCase()}`,
    description: `Gift Essential — 1 year (${code})`,
    amountEur: gift.priceEur,
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
