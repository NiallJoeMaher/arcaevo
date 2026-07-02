/**
 * POST /api/v1/auth/reset — request a password reset (design §03 edge state).
 *
 * Body: { email }. Sends E3 with a 30-minute single-use reset link.
 * NON-REVEALING: identical response whether or not the email is registered.
 */
import { parseJsonBody, siteUrl } from "@/lib/api";
import { sendEmail } from "@/lib/emails";
import { findUserByEmail, issueMagicLink } from "@/lib/member-auth";
import { ResetRequestInput } from "@/lib/models";

export async function POST(req: Request) {
  const parsed = await parseJsonBody(req, ResetRequestInput);
  if (!parsed.ok) return parsed.response;
  const { email } = parsed.data;

  const user = await findUserByEmail(email);
  if (user) {
    const issued = await issueMagicLink(email, "reset");
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
    await sendEmail("e3_password_reset", email.toLowerCase(), {
      resetUrl: `${siteUrl()}/verify?token=${issued.token}&reset=1`,
    });
  }

  return Response.json(
    {
      ok: true,
      message: `If ${email.toLowerCase()} has an account, a reset link is on its way. It's valid for 30 minutes.`,
    },
    { status: 202 }
  );
}
