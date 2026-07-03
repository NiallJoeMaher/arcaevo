/**
 * GET /api/v1/auth/sessions — the member's own active sessions.
 *
 * Auth: an authenticated MEMBER. Returns one row per session with its device,
 * human label, lastSeen and createdAt. The stored `tokenHash` is NEVER
 * returned; the current session is flagged so the UI can protect it.
 *
 * 200 → { sessions: [{ id, device, label, lastSeen, createdAt, expiresAt, current }] }.
 */
import { requireMember } from "@/lib/auth";
import { collections } from "@/lib/db";
import {
  deviceLabel,
  isSessionExpired,
  sessionTokenFromCookies,
  sha256Hex,
} from "@/lib/member-auth";

export async function GET(req: Request) {
  const auth = await requireMember(req);
  if (auth.denied) return auth.denied;

  const bearer = /^Bearer\s+(.+)$/i
    .exec(req.headers.get("authorization") ?? "")?.[1]
    ?.trim();
  const cookieToken = await sessionTokenFromCookies();
  const currentHash = (bearer || cookieToken)
    ? sha256Hex((bearer || cookieToken)!)
    : "";

  const rows = await collections
    .sessions()
    .then((c) => c.find({ userId: auth.member._id }).sort({ lastSeen: -1 }).toArray());

  return Response.json({
    sessions: rows
      .filter((s) => !isSessionExpired(s))
      .map((s) => ({
        id: s._id,
        device: s.device ?? "web",
        label: s.label ?? deviceLabel(s.device),
        lastSeen: s.lastSeen.toISOString(),
        createdAt: s.createdAt.toISOString(),
        expiresAt: s.expiresAt ? s.expiresAt.toISOString() : null,
        current: s.tokenHash === currentHash,
      })),
  });
}
