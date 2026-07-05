/**
 * GET /api/v1/referral — the signed-in member's referral summary for the
 * invite screen ("give a month / get a month", design §16).
 *
 * Returns COUNTS ONLY — the member's own shareable code, how many joins it has
 * earned, how many free months have been applied, and any month held for their
 * next renewal. NEVER the identity/email of anyone who joined (GDPR posture —
 * the referrer must not learn who they referred).
 *
 * The code is created lazily on first read, so every member (not just seeded
 * fixtures) has a real NAME-XX code to share.
 */
import { requireMember } from "@/lib/auth";
import { ensureReferralCode } from "@/lib/referral";
import { siteUrl } from "@/lib/api";

export async function GET(req: Request) {
  const auth = await requireMember(req);
  if (auth.denied) return auth.denied;

  const code = await ensureReferralCode(auth.member);

  return Response.json({
    code: code._id,
    shareUrl: `${siteUrl()}/join?ref=${encodeURIComponent(code._id)}`,
    joinedCount: code.joinedCount,
    freeMonthsApplied: code.freeMonthsApplied,
    /** Months earned but not yet applied (referrer wasn't active when a friend
     * paid) — will extend their next renewal. */
    creditMonthsPending: auth.member.referralCreditMonths ?? 0,
  });
}
