/**
 * POST /api/v1/auth/magic-link/verify — redeem a magic link (design §03 W2).
 *
 * Body: EITHER { token } (the emailed link) OR { email, code } (the human code
 * — the prefetch-safe fallback, Phase 21, immune to email virus-scanner link
 * prefetching). Both consume the ONE single-use token, burned atomically:
 * using the code kills the link and vice-versa.
 *
 * Expired/used tokens get the designed edge state ("That link has expired —
 * they only live 30 minutes.") so the UI can offer a one-tap fresh link; on
 * the link path the JSON hints that the code fallback is available. Five wrong
 * codes → "too_many" (the token is burned).
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
  consumeMagicLinkByCode,
  createSession,
  findUserByEmail,
  setMemberSessionCookie,
  type ConsumeMagicLinkByCodeResult,
} from "@/lib/member-auth";
import { MagicLinkVerifyInput } from "@/lib/models";

export async function POST(req: Request) {
  const parsed = await parseJsonBody(req, MagicLinkVerifyInput);
  if (!parsed.ok) return parsed.response;

  const { token, email, code } = parsed.data;
  const viaCode = !token;
  const result: ConsumeMagicLinkByCodeResult = token
    ? await consumeMagicLink(token)
    : await consumeMagicLinkByCode(email!, code!);

  if (result.state !== "valid" || result.purpose === "reset") {
    if (result.state === "too_many") {
      return Response.json(
        {
          error: "too_many",
          message:
            "Too many tries with that code. Ask for a fresh sign-in email and we'll send a new one.",
        },
        { status: 401 }
      );
    }
    const expired = result.state === "expired" || result.state === "used";
    return Response.json(
      {
        error: expired ? "link_expired" : "link_invalid",
        message: viaCode
          ? "That code isn't valid — check it, or ask for a fresh sign-in email."
          : expired
            ? "That link has expired — they only live 30 minutes."
            : "That link isn't valid.",
        // Link path: point the human at the typed-code escape hatch, since a
        // scanner may have burned the link before they ever clicked.
        ...(viaCode ? {} : { codeAvailable: true }),
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

  const { token: sessionToken } = await createSession(
    user._id,
    req.headers.get("user-agent") ?? "unknown"
  );
  await setMemberSessionCookie(sessionToken);

  const consent = await consentState(user._id);
  return Response.json({
    ok: true,
    member: { id: user._id, email: user.email, name: user.name },
    /** iOS: keep this and send it as `Authorization: Bearer <sessionToken>`. */
    sessionToken,
    needsConsent: consent.needsConsent || consent.needsReconsent,
  });
}
