/**
 * POST /api/v1/auth/signup — create account (design §03 W1).
 *
 * Body: { email, password?, surface? }. Password optional — a magic link
 * covers everyone.
 *
 * NON-REVEALING: the response is IDENTICAL whether or not the email is
 * already registered ("check your inbox"). New addresses get the E1 verify
 * email; existing addresses get an E2 sign-in link instead — only the inbox
 * owner ever learns which.
 */
import { parseJsonBody, siteUrl } from "@/lib/api";
import { sendEmail } from "@/lib/emails";
import { logError } from "@/lib/log";
import {
  createMemberUser,
  findUserByEmail,
  hashPassword,
  issueMagicLink,
} from "@/lib/member-auth";
import { recordAttribution } from "@/lib/referral";
import { SignupInput } from "@/lib/models";

export async function POST(req: Request) {
  const parsed = await parseJsonBody(req, SignupInput);
  if (!parsed.ok) return parsed.response;
  const { email, password, surface, ref } = parsed.data;
  void surface; // consent surface is recorded at the consent gate, not here

  const existing = await findUserByEmail(email);

  if (existing) {
    // "You already have an account — we've emailed you a sign-in link."
    // …but the HTTP response never says so (design §03 edge states).
    const issued = await issueMagicLink(email, "signin");
    if (!issued.throttled) {
      await sendEmail("e2_magic_link", email.toLowerCase(), {
        signinUrl: `${siteUrl()}/verify?token=${issued.token}`,
        code: issued.code,
        codeUrl: `${siteUrl()}/signin?email=${encodeURIComponent(email.toLowerCase())}`,
      });
    }
  } else {
    const passwordHash = password ? await hashPassword(password) : null;
    const user = await createMemberUser({ email, passwordHash });
    // Referral attribution — NEW accounts only (never for an existing email, so
    // the non-revealing response holds and self-referral by re-signup is out).
    // Best-effort: a bad/unknown code is ignored and never blocks signup.
    if (ref) {
      try {
        await recordAttribution({ referredUser: user, code: ref });
      } catch (err) {
        logError("signup.referral_attribution", err, { memberId: user._id });
      }
    }
    const issued = await issueMagicLink(email, "verify");
    if (!issued.throttled) {
      await sendEmail("e1_verify", email.toLowerCase(), {
        confirmUrl: `${siteUrl()}/verify?token=${issued.token}`,
        code: issued.code,
        codeUrl: `${siteUrl()}/signin?email=${encodeURIComponent(email.toLowerCase())}`,
      });
    }
  }

  // Identical response either way — never reveals registration status.
  return Response.json(
    {
      ok: true,
      message: `We've sent a confirmation link to ${email.toLowerCase()}. It's valid for 30 minutes.`,
    },
    { status: 202 }
  );
}
