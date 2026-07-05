/** GET /api/v1/members/[id] — admin: single member detail. */
import { currentAdmin, requireAdmin } from "@/lib/auth";
import { logAdminAccess } from "@/lib/admin-audit";
import { clientIp } from "@/lib/rate-limit";
import { collections } from "@/lib/db";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await params;

  // DPIA R4: a member-detail read pulls that member's orders + readings (Art.9).
  const admin = await currentAdmin();
  logAdminAccess({
    action: "member.detail.read",
    adminId: admin?.adminId ?? null,
    role: admin?.role ?? null,
    targetMemberId: id,
    ip: clientIp(req),
  });

  const users = await collections.users();
  const user = await users.findOne({ _id: id });
  if (!user) {
    return Response.json(
      { error: "not_found", message: `No member ${id}.` },
      { status: 404 }
    );
  }

  const [membership, orders, readings, tickets] = await Promise.all([
    collections.memberships().then((c) => c.findOne({ memberId: id })),
    collections
      .testOrders()
      .then((c) => c.find({ memberId: id }).sort({ createdAt: -1 }).toArray()),
    collections
      .biomarkerReadings()
      .then((c) => c.find({ memberId: id }).sort({ takenAt: -1 }).toArray()),
    collections
      .supportTickets()
      .then((c) => c.find({ memberId: id }).sort({ createdAt: -1 }).toArray()),
  ]);

  return Response.json({
    member: {
      id: user._id,
      name: user.name,
      email: user.email,
      joinedAt: user.joinedAt,
      flag: user.flag,
      isDemo: user.isDemo,
    },
    membership,
    orders,
    readings,
    tickets,
  });
}
