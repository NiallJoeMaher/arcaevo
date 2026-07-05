/**
 * Referral engine — "give a month / get a month" (design §16; the PLG unlock in
 * docs/GROWTH_AND_ENGAGEMENT.md #3). Turns the polished invite screen's promise
 * into a real, abuse-resistant reward.
 *
 * FLOW
 *  1. Attribution (recordAttribution) — at the REFERRED member's signup, a valid
 *     `?ref=<code>` is resolved to the referrer and a `pending` referral is
 *     written (one per referred member; attribution is ALSO denormalised onto
 *     the User: referredBy / referredByCode / referredAt).
 *  2. Reward (creditReferralOnActivation) — when the referred member's
 *     membership becomes genuinely PAID/active, BOTH sides get +1 month
 *     (renewalDate extended) and the referral flips `pending` → `credited`.
 *     If the referrer has no active membership yet, their month is HELD on
 *     `user.referralCreditMonths` and applied at their own next activation.
 *
 * IDEMPOTENCY / ANTI-ABUSE
 *  - Credits at most once per referral (atomic `pending` → `credited` guard) and
 *    at most once per held balance (atomic `> 0` → 0 guard) — safe under webhook
 *    retries and concurrent deliveries; no ledger needed.
 *  - No self-referral (by userId OR email). No repeat/loop (referral keyed by
 *    the referred userId). Unknown/expired/blank codes are ignored gracefully.
 *  - No credit before the referred member actually pays (only the activation
 *    path calls this; pending/free memberships never trigger it).
 *  - Soft cap (REFERRAL_MAX_CREDITED) flags implausible farming: joins past the
 *    cap still count but earn no further months.
 *  - The referrer never learns who joined (counts only — GDPR posture).
 */
import { collections } from "@/lib/db";
import type { ReferralCode, User } from "@/lib/models";

/** Months of membership extension each side earns per successful referral. */
export const REFERRAL_CREDIT_MONTHS = 1;

/**
 * Anti-abuse soft cap: a referrer earns free months for at most this many
 * credited joins. Beyond it, joins still increment `joinedCount` (visible) but
 * grant no further months — a brake on implausible referral farming.
 */
export const REFERRAL_MAX_CREDITED = 50;

/** Normalise a user-supplied code (trim + uppercase). Codes are stored upper. */
export function normalizeReferralCode(code: string): string {
  return code.trim().toUpperCase();
}

/** Add whole months to a date (JS month arithmetic; clamps to end-of-month). */
export function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

/** Resolve a raw referral code to its ReferralCode doc, or null if unknown. */
export async function resolveReferralCode(
  code: string | null | undefined
): Promise<ReferralCode | null> {
  if (!code) return null;
  const normalized = normalizeReferralCode(code);
  if (!normalized) return null;
  const codes = await collections.referralCodes();
  return codes.findOne({ _id: normalized });
}

export interface AttributionResult {
  status: "attributed" | "ignored";
  reason?:
    | "no_code"
    | "unknown_code"
    | "self_referral"
    | "already_attributed";
  referrerUserId?: string;
}

/**
 * Record referral attribution for a freshly-created member. Best-effort and
 * fully graceful — every rejection returns `{ status: "ignored", reason }`
 * rather than throwing, so it can never break the signup path.
 */
export async function recordAttribution(params: {
  referredUser: User;
  code: string | null | undefined;
}): Promise<AttributionResult> {
  const { referredUser } = params;
  if (!params.code) return { status: "ignored", reason: "no_code" };

  const refCode = await resolveReferralCode(params.code);
  if (!refCode) return { status: "ignored", reason: "unknown_code" };

  // Self-referral guard — cannot refer yourself, by userId OR by email.
  if (refCode.userId === referredUser._id) {
    return { status: "ignored", reason: "self_referral" };
  }
  const users = await collections.users();
  const referrer = await users.findOne({ _id: refCode.userId });
  if (
    referrer &&
    referrer.email.toLowerCase() === referredUser.email.toLowerCase()
  ) {
    return { status: "ignored", reason: "self_referral" };
  }

  // One referral per referred member: `$setOnInsert` keyed on referredUserId,
  // so a re-run (double signup submit) never overwrites or duplicates.
  const referrals = await collections.referrals();
  const now = new Date();
  const res = await referrals.updateOne(
    { _id: referredUser._id },
    {
      $setOnInsert: {
        referrerUserId: refCode.userId,
        referrerCode: refCode._id,
        referredUserId: referredUser._id,
        status: "pending",
        createdAt: now,
        creditedAt: null,
        rejectedReason: null,
      },
    },
    { upsert: true }
  );
  if (res.upsertedCount === 0) {
    return {
      status: "ignored",
      reason: "already_attributed",
      referrerUserId: refCode.userId,
    };
  }

  // Denormalised attribution on the member (additive, optional fields).
  await users.updateOne(
    { _id: referredUser._id },
    {
      $set: {
        referredBy: refCode.userId,
        referredByCode: refCode._id,
        referredAt: now,
      },
    }
  );
  return { status: "attributed", referrerUserId: refCode.userId };
}

/**
 * Extend a member's ACTIVE membership renewal date by `months`. Returns whether
 * an active membership was found to extend (false = nothing to extend yet).
 */
async function extendActiveMembership(
  memberId: string,
  months: number
): Promise<boolean> {
  if (months <= 0) return false;
  const memberships = await collections.memberships();
  const m = await memberships.findOne({ memberId, status: "active" });
  if (!m) return false;
  await memberships.updateOne(
    { _id: m._id },
    { $set: { renewalDate: addMonths(new Date(m.renewalDate), months) } }
  );
  return true;
}

export interface CreditResult {
  /** True when this call flipped a pending referral to credited. */
  creditedReferral: boolean;
  /** Months applied to the referred member's own membership this call. */
  referredMonths: number;
  /** Months applied to the referrer's active membership this call. */
  referrerMonths: number;
  /** True when the referrer had no active membership → their month was HELD. */
  referrerHeld: boolean;
  /** Held referrer-credit months this member consumed at their activation. */
  heldConsumed: number;
}

/**
 * Apply referral rewards when `memberId`'s membership becomes genuinely
 * PAID/active. MUST be called from every activation path (mock + real Stripe
 * `checkout.session.completed`). Idempotent — two guarded atomic transitions
 * mean it can run any number of times and credit at most once.
 */
export async function creditReferralOnActivation(
  memberId: string
): Promise<CreditResult> {
  const result: CreditResult = {
    creditedReferral: false,
    referredMonths: 0,
    referrerMonths: 0,
    referrerHeld: false,
    heldConsumed: 0,
  };
  const users = await collections.users();
  const referrals = await collections.referrals();
  const referralCodes = await collections.referralCodes();
  const now = new Date();

  // --- Part A: consume any HELD referrer credits on THIS member -------------
  // Atomic claim: only the winning call sees a > 0 balance; it resets to 0.
  const heldPre = await users.findOneAndUpdate(
    { _id: memberId, referralCreditMonths: { $gt: 0 } },
    { $set: { referralCreditMonths: 0 } },
    { returnDocument: "before" }
  );
  const held = heldPre?.referralCreditMonths ?? 0;
  if (held > 0) {
    const applied = await extendActiveMembership(memberId, held);
    if (applied) {
      result.heldConsumed = held;
    } else {
      // No active membership to apply to (shouldn't happen on activation) —
      // put the balance back so the credit is never silently lost.
      await users.updateOne(
        { _id: memberId },
        { $inc: { referralCreditMonths: held } }
      );
    }
  }

  // --- Part B: credit THIS member's OWN referral (pending → credited) -------
  // Guard (defense-in-depth for "no credit on a free/pending membership"):
  // only credit once the referred member GENUINELY has an active (paid)
  // membership. Called wrongly before payment settles → no-op, referral stays
  // pending until they actually pay.
  const memberships = await collections.memberships();
  const activeMembership = await memberships.findOne({
    memberId,
    status: "active",
  });
  if (!activeMembership) return result;

  // Atomic claim: only the first delivery flips pending → credited; retries and
  // concurrent deliveries see no pending doc and no-op (never double-credit).
  const claimed = await referrals.findOneAndUpdate(
    { _id: memberId, status: "pending" },
    { $set: { status: "credited", creditedAt: now } },
    { returnDocument: "before" }
  );
  if (!claimed) return result;
  result.creditedReferral = true;

  // Referred member (this member) — +1 month to their now-active membership.
  await memberships.updateOne(
    { _id: activeMembership._id },
    {
      $set: {
        renewalDate: addMonths(
          new Date(activeMembership.renewalDate),
          REFERRAL_CREDIT_MONTHS
        ),
      },
    }
  );
  result.referredMonths = REFERRAL_CREDIT_MONTHS;

  // Referrer — soft cap on farming: beyond the cap, the join still counts but
  // earns no further months.
  const refCode = await referralCodes.findOne({ _id: claimed.referrerCode });
  const underCap = (refCode?.freeMonthsApplied ?? 0) < REFERRAL_MAX_CREDITED;
  if (underCap) {
    const extended = await extendActiveMembership(
      claimed.referrerUserId,
      REFERRAL_CREDIT_MONTHS
    );
    if (extended) {
      result.referrerMonths = REFERRAL_CREDIT_MONTHS;
    } else {
      // Referrer not active yet — HOLD the month for their next activation.
      await users.updateOne(
        { _id: claimed.referrerUserId },
        { $inc: { referralCreditMonths: REFERRAL_CREDIT_MONTHS } }
      );
      result.referrerHeld = true;
    }
  }

  // Referrer's public counters (counts only — never referee PII). joinedCount
  // always ++; freeMonthsApplied only when a month was actually granted.
  await referralCodes.updateOne(
    { _id: claimed.referrerCode },
    {
      $inc: {
        joinedCount: 1,
        freeMonthsApplied: underCap ? REFERRAL_CREDIT_MONTHS : 0,
      },
    }
  );
  return result;
}

// Unambiguous alphabet for generated code suffixes (no O/0, I/1, etc.).
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function randomSuffix(len: number): string {
  let s = "";
  for (let i = 0; i < len; i++) {
    s += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return s;
}

/**
 * The member's own referral code — created lazily on first read so EVERY member
 * (not just seeded fixtures) has a real, shareable NAME-XX code. Idempotent per
 * user (returns the existing code if one exists); retries on the rare code
 * collision.
 */
export async function ensureReferralCode(user: User): Promise<ReferralCode> {
  const codes = await collections.referralCodes();
  const existing = await codes.findOne({ userId: user._id });
  if (existing) return existing;

  const base =
    (user.name.split(" ")[0] || "MEMBER")
      .toUpperCase()
      .replace(/[^A-Z]/g, "")
      .slice(0, 8) || "MEMBER";

  for (let attempt = 0; attempt < 16; attempt++) {
    const code = `${base}-${randomSuffix(attempt < 8 ? 2 : 4)}`;
    const doc: ReferralCode = {
      _id: code,
      userId: user._id,
      joinedCount: 0,
      freeMonthsApplied: 0,
      createdAt: new Date(),
    };
    try {
      await codes.insertOne(doc);
      return doc;
    } catch {
      // Duplicate code _id, or a racing insert for this same user — re-check.
      const raced = await codes.findOne({ userId: user._id });
      if (raced) return raced;
    }
  }
  throw new Error(`could not allocate a referral code for ${user._id}`);
}
