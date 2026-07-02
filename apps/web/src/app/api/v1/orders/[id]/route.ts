/** GET /api/v1/orders/[id] — bearer; a member can only see their own order. */
import { requireMember } from "@/lib/auth";
import { collections } from "@/lib/db";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireMember(req);
  if (auth.denied) return auth.denied;

  const { id } = await params;
  const order = await collections
    .testOrders()
    .then((c) => c.findOne({ _id: id, memberId: auth.member._id }));
  if (!order) {
    return Response.json(
      { error: "not_found", message: `No order ${id} for this member.` },
      { status: 404 }
    );
  }
  return Response.json({ order });
}
