/** GET /api/v1/members/me — the authenticated member's profile + membership. */
import { requireMember } from "@/lib/auth";
import { collections } from "@/lib/db";

export async function GET(req: Request) {
  const auth = await requireMember(req);
  if (auth.denied) return auth.denied;

  const memberships = await collections.memberships();
  const membership = await memberships.findOne({ memberId: auth.member._id });

  return Response.json({
    member: {
      id: auth.member._id,
      name: auth.member.name,
      email: auth.member.email,
      joinedAt: auth.member.joinedAt,
    },
    membership: membership && {
      tier: membership.tier,
      term: membership.term,
      termStart: membership.termStart,
      renewalDate: membership.renewalDate,
      cadenceUpgrade: membership.cadenceUpgrade,
      status: membership.status,
      priceEur: membership.priceEur,
    },
  });
}
