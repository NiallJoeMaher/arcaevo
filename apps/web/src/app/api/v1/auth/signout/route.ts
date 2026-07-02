/**
 * POST /api/v1/auth/signout — end the current session.
 * Destroys the session row (cookie or bearer) and clears the cookie.
 */
import {
  clearMemberSessionCookie,
  destroySessionByToken,
  sessionTokenFromCookies,
} from "@/lib/member-auth";

export async function POST(req: Request) {
  const bearer = /^Bearer\s+(.+)$/i.exec(
    req.headers.get("authorization") ?? ""
  )?.[1];
  const cookieToken = await sessionTokenFromCookies();

  const token = bearer?.trim() || cookieToken;
  if (token) await destroySessionByToken(token);
  await clearMemberSessionCookie();

  return Response.json({ ok: true });
}
