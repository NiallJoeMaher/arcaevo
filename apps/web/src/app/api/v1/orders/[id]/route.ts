/**
 * GET /api/v1/orders/[id] — bearer; a member can only see their own order.
 * Each poll asks the (MOCK) LetsGetChecked vendor for the latest status and
 * syncs it onto the order (forward-only). The mock state machine advances
 * exactly one step per poll — see lib/vendors/letsgetchecked.mock.ts.
 */
import { requireConsentedMember } from "@/lib/consent-guard";
import { collections } from "@/lib/db";
import { ORDER_STATUS_SEQUENCE } from "@/lib/models";
import { bloodTestVendor } from "@/lib/vendors/letsgetchecked.mock";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireConsentedMember(req);
  if (auth.denied) return auth.denied;

  const { id } = await params;
  const ordersCol = await collections.testOrders();
  let order = await ordersCol.findOne({ _id: id, memberId: auth.member._id });
  if (!order) {
    return Response.json(
      { error: "not_found", message: `No order ${id} for this member.` },
      { status: 404 }
    );
  }

  // Poll the vendor for in-flight orders; apply forward-only (never regress).
  if (order.vendorOrderId && order.status !== "results_ready") {
    const vendorStatus = await bloodTestVendor.getOrderStatus(
      order.vendorOrderId
    );
    if (
      ORDER_STATUS_SEQUENCE.indexOf(vendorStatus) >
      ORDER_STATUS_SEQUENCE.indexOf(order.status)
    ) {
      const updatedAt = new Date();
      await ordersCol.updateOne(
        { _id: order._id },
        { $set: { status: vendorStatus, updatedAt } }
      );
      order = { ...order, status: vendorStatus, updatedAt };
    }
  }

  return Response.json({ order });
}
