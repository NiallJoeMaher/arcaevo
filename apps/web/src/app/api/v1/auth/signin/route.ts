/**
 * POST /api/v1/auth/signin — password sign-in (design §03 W3).
 *
 * Body: { email, password }.
 *
 * NON-REVEALING: unknown email, no password set, and wrong password all
 * return the SAME generic 401. 5 failures → 15-minute cool-off (429), after
 * which the counter starts fresh. The designed UI answer to every failure is
 * the same: "Or skip the password — we'll email you a link."
 */
import { parseJsonBody } from "@/lib/api";
import { consentState } from "@/lib/consents";
import { collections } from "@/lib/db";
import {
  applyFailedAttempt,
  clearFailedAttempts,
  createSession,
  findUserByEmail,
  isInCooloff,
  setMemberSessionCookie,
  verifyPassword,
} from "@/lib/member-auth";
import { SigninInput } from "@/lib/models";

const GENERIC_401 = {
  error: "invalid_credentials",
  message:
    "That didn't work — check the details, or skip the password and we'll email you a link.",
};

export async function POST(req: Request) {
  const parsed = await parseJsonBody(req, SigninInput);
  if (!parsed.ok) return parsed.response;
  const { email, password } = parsed.data;

  const user = await findUserByEmail(email);
  if (!user || !user.passwordHash) {
    // Same shape/latency class as a wrong password — reveals nothing.
    return Response.json(GENERIC_401, { status: 401 });
  }

  if (isInCooloff(user.cooloffUntil)) {
    return Response.json(
      {
        error: "cooloff",
        message:
          "Too many attempts — take a 15-minute breather, or use a sign-in link instead.",
      },
      { status: 429 }
    );
  }

  const users = await collections.users();
  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    const next = applyFailedAttempt({
      failedAttempts: user.failedAttempts,
      cooloffUntil: user.cooloffUntil,
    });
    await users.updateOne({ _id: user._id }, { $set: { ...next } });
    return Response.json(GENERIC_401, { status: 401 });
  }

  await users.updateOne({ _id: user._id }, { $set: { ...clearFailedAttempts() } });
  const { token } = await createSession(
    user._id,
    req.headers.get("user-agent") ?? "unknown"
  );
  await setMemberSessionCookie(token);

  const consent = await consentState(user._id);
  return Response.json({
    ok: true,
    member: { id: user._id, email: user.email, name: user.name },
    sessionToken: token,
    needsConsent: consent.needsConsent || consent.needsReconsent,
  });
}
