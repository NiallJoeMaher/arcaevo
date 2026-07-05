/**
 * GET /api/v1/referral/resolve?code=<code> — validate a referral code so the
 * /join screen can confirm "you've been invited" before the prospect signs up.
 *
 * Deliberately NON-REVEALING: returns only `{ valid, code }` — never the
 * referrer's name/email/id (privacy; also prevents code-enumeration harvesting
 * of member identities). Public (no auth) — a prospect isn't a member yet.
 */
import { resolveReferralCode, normalizeReferralCode } from "@/lib/referral";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const raw = url.searchParams.get("code") ?? "";
  if (!raw.trim()) {
    return Response.json({ valid: false, code: null });
  }
  const resolved = await resolveReferralCode(raw);
  return Response.json({
    valid: Boolean(resolved),
    code: resolved ? resolved._id : normalizeReferralCode(raw),
  });
}
