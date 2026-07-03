/**
 * POST /api/v1/auth/watch-session — mint a device-scoped Apple Watch session.
 *
 * Auth: an authenticated MEMBER (phone session cookie OR bearer session/demo
 * token, via the existing member auth). Mints a NEW device:"watch" session for
 * the SAME user — a freshly generated token with its own row, NOT a copy of the
 * phone token, so the watch authenticates independently and is separately
 * revocable. Replace policy: one active watch session per user (any prior watch
 * session is revoked first — see createWatchSession).
 *
 * 201 → { watchSessionToken, expiresAt (ISO 8601), device: "watch" }.
 */
import { requireMember } from "@/lib/auth";
import { createWatchSession } from "@/lib/member-auth";

export async function POST(req: Request) {
  const auth = await requireMember(req);
  if (auth.denied) return auth.denied;

  const { token, expiresAt } = await createWatchSession(auth.member._id);
  return Response.json(
    {
      watchSessionToken: token,
      expiresAt: expiresAt.toISOString(),
      device: "watch" as const,
    },
    { status: 201 }
  );
}
