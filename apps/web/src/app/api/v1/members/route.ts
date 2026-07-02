/** GET /api/v1/members — admin: list members with membership + last test. */
import { requireAdmin } from "@/lib/auth";
import { collections } from "@/lib/db";

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  const [users, memberships, orders] = await Promise.all([
    collections.users().then((c) => c.find().sort({ joinedAt: -1 }).toArray()),
    collections.memberships().then((c) => c.find().toArray()),
    collections
      .testOrders()
      .then((c) => c.find().sort({ createdAt: -1 }).toArray()),
  ]);

  const membershipByMember = new Map(memberships.map((m) => [m.memberId, m]));
  const lastOrderByMember = new Map<string, (typeof orders)[number]>();
  for (const order of orders) {
    if (!lastOrderByMember.has(order.memberId)) {
      lastOrderByMember.set(order.memberId, order);
    }
  }

  return Response.json({
    members: users.map((u) => {
      const m = membershipByMember.get(u._id);
      const lastOrder = lastOrderByMember.get(u._id);
      return {
        id: u._id,
        name: u.name,
        email: u.email,
        joinedAt: u.joinedAt,
        flag: u.flag,
        isDemo: u.isDemo,
        tier: m?.tier ?? null,
        membershipStatus: m?.status ?? null,
        renewalDate: m?.renewalDate ?? null,
        lastTest: lastOrder
          ? { orderId: lastOrder._id, status: lastOrder.status, createdAt: lastOrder.createdAt }
          : null,
      };
    }),
  });
}
