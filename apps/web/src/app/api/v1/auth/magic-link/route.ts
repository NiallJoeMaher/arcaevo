/**
 * POST /api/v1/auth/magic-link — request a sign-in link (design §03 W3).
 *
 * Body: { email, purpose?: "signin" | "verify" }.
 *
 * Rules: 30-minute single-use links, resend throttled to once per 60s (429
 * with retryInSeconds — the throttle applies per email, so it reveals nothing
 * to third parties beyond "someone asked twice"). If the email isn't
 * registered, NO email is sent but the response is identical (non-revealing).
 */
import { parseJsonBody, siteUrl } from "@/lib/api";
import { sendEmail } from "@/lib/emails";
import { findUserByEmail, issueMagicLink } from "@/lib/member-auth";
import { MagicLinkRequestInput } from "@/lib/models";
import { limitByIp, REQUEST_RATE_LIMIT } from "@/lib/rate-limit";

export async function POST(req: Request) {
  // IP rate-limit on top of the per-email 60s resend throttle (blunts an
  // attacker spamming links across many addresses from one host).
  const limited = await limitByIp(req, "magic-link-request", REQUEST_RATE_LIMIT);
  if (limited) return limited;

  const parsed = await parseJsonBody(req, MagicLinkRequestInput);
  if (!parsed.ok) return parsed.response;
  const { email, purpose } = parsed.data;

  const user = await findUserByEmail(email);
  if (user) {
    const issued = await issueMagicLink(email, purpose);
    if (issued.throttled) {
      return Response.json(
        {
          error: "throttled",
          message: "A link was sent less than a minute ago — check your inbox.",
          retryInSeconds: issued.retryInSeconds,
        },
        { status: 429 }
      );
    }
    const verifyUrl = `${siteUrl()}/verify?token=${issued.token}`;
    const codeUrl = `${siteUrl()}/signin?email=${encodeURIComponent(email.toLowerCase())}`;
    await sendEmail(
      purpose === "verify" ? "e1_verify" : "e2_magic_link",
      email.toLowerCase(),
      purpose === "verify"
        ? { confirmUrl: verifyUrl, code: issued.code, codeUrl }
        : { signinUrl: verifyUrl, code: issued.code, codeUrl }
    );
  }

  // Unknown email → same response, no email sent. Never reveals registration.
  return Response.json(
    {
      ok: true,
      message: `If ${email.toLowerCase()} has an account, a sign-in link is on its way. It's valid for 30 minutes.`,
    },
    { status: 202 }
  );
}
