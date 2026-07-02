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

export async function POST(req: Request) {
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
    await sendEmail(
      purpose === "verify" ? "e1_verify" : "e2_magic_link",
      email.toLowerCase(),
      purpose === "verify"
        ? { confirmUrl: `${siteUrl()}/verify?token=${issued.token}` }
        : { signinUrl: `${siteUrl()}/verify?token=${issued.token}` }
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
