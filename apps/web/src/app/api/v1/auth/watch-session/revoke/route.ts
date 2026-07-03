/**
 * POST /api/v1/auth/watch-session/revoke — the phone's "sign out watch".
 *
 * Auth: an authenticated MEMBER. Deletes the user's watch-device session(s),
 * so the Apple Watch's token stops resolving at once. Backs the phone's
 * "sign out watch" control and the admin device list.
 *
 * 200 → { ok: true, revoked: number }.
 */
import { requireMember } from "@/lib/auth";
import { revokeWatchSessions } from "@/lib/member-auth";

export async function POST(req: Request) {
  const auth = await requireMember(req);
  if (auth.denied) return auth.denied;

  const revoked = await revokeWatchSessions(auth.member._id);
  return Response.json({ ok: true, revoked });
}
