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
import {
  createMemberUser,
  findUserByEmail,
  hashPassword,
  issueMagicLink,
} from "@/lib/member-auth";
import { SignupInput } from "@/lib/models";

export async function POST(req: Request) {
  const parsed = await parseJsonBody(req, SignupInput);
  if (!parsed.ok) return parsed.response;
  const { email, password, surface } = parsed.data;
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
    await createMemberUser({ email, passwordHash });
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
