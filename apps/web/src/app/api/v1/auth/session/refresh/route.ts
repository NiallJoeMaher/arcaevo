/**
 * POST /api/v1/auth/session/refresh — silent refresh (the watch calls this on
 * 401 / on wake, but it works for any session).
 *
 * Auth: Bearer any valid session token (falls back to the member cookie).
 * Validates the token's session; if valid, SLIDES the expiry (expiresAt →
 * now + TTL, lastSeen updated) and returns the member. In this opaque
 * long-lived-token model the session token IS the refresh token —
 * "refresh" = revalidate + slide.
 *
 * 200 → { member: {id, name, email}, device, expiresAt }.
 * 401 → { error: "session_invalid" } when missing / revoked / expired.
 */
import { refreshSession, sessionTokenFromCookies } from "@/lib/member-auth";

export async function POST(req: Request) {
  const bearer = /^Bearer\s+(.+)$/i
    .exec(req.headers.get("authorization") ?? "")?.[1]
    ?.trim();
  const token = bearer || (await sessionTokenFromCookies());

  const refreshed = token ? await refreshSession(token) : null;
  if (!refreshed) {
    return Response.json({ error: "session_invalid" }, { status: 401 });
  }

  const { user, session, expiresAt } = refreshed;
  return Response.json({
    member: { id: user._id, name: user.name, email: user.email },
    device: session.device ?? "web",
    expiresAt: expiresAt.toISOString(),
  });
}
