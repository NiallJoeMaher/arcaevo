/**
 * POST /api/v1/auth/sessions/[id]/revoke — end one of the member's sessions.
 *
 * Auth: an authenticated MEMBER. A member can only revoke their OWN session
 * (the filter is scoped to userId), backing the §17 "End session" control and
 * the phone ending the watch. Deleting the row makes that token stop resolving.
 *
 * 200 → { ok: true, revoked: number } (revoked 0 if the id isn't theirs).
 */
import { requireMember } from "@/lib/auth";
import { collections } from "@/lib/db";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireMember(req);
  if (auth.denied) return auth.denied;

  const { id } = await params;
  const result = await collections
    .sessions()
    .then((c) => c.deleteOne({ _id: id, userId: auth.member._id }));

  return Response.json({ ok: true, revoked: result.deletedCount });
}
