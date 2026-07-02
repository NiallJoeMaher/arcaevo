/**
 * POST /api/v1/auth/magic-link/verify — redeem a magic link (design §03 W2).
 *
 * Body: { token }. Single-use: the token is burned atomically. Expired/used
 * tokens get the designed edge state ("That link has expired — they only live
 * 30 minutes.") so the UI can offer a one-tap fresh link.
 *
 * Success: marks the email verified, opens a session (httpOnly cookie AND the
 * token in the body for the iOS app to use as a bearer), and reports whether
 * the consent gate must be shown next (§04: right after email verification).
 */
import { parseJsonBody } from "@/lib/api";
import { consentState } from "@/lib/consents";
import { collections } from "@/lib/db";
import {
  clearFailedAttempts,
  consumeMagicLink,
  createSession,
  findUserByEmail,
  setMemberSessionCookie,
} from "@/lib/member-auth";
import { MagicLinkVerifyInput } from "@/lib/models";

export async function POST(req: Request) {
  const parsed = await parseJsonBody(req, MagicLinkVerifyInput);
  if (!parsed.ok) return parsed.response;

  const result = await consumeMagicLink(parsed.data.token);
  if (result.state !== "valid" || result.purpose === "reset") {
    const expired = result.state === "expired" || result.state === "used";
    return Response.json(
      {
        error: expired ? "link_expired" : "link_invalid",
        message: expired
          ? "That link has expired — they only live 30 minutes."
          : "That link isn't valid.",
      },
      { status: 401 }
    );
  }

  const user = await findUserByEmail(result.email);
  if (!user) {
    // Token predates an account deletion — treat like any invalid link.
    return Response.json(
      { error: "link_invalid", message: "That link isn't valid." },
      { status: 401 }
    );
  }

  const users = await collections.users();
  await users.updateOne(
    { _id: user._id },
    { $set: { emailVerified: true, ...clearFailedAttempts() } }
  );

  const { token } = await createSession(
    user._id,
    req.headers.get("user-agent") ?? "unknown"
  );
  await setMemberSessionCookie(token);

  const consent = await consentState(user._id);
  return Response.json({
    ok: true,
    member: { id: user._id, email: user.email, name: user.name },
    /** iOS: keep this and send it as `Authorization: Bearer <sessionToken>`. */
    sessionToken: token,
    needsConsent: consent.needsConsent || consent.needsReconsent,
  });
}
