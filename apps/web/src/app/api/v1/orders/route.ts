/**
 * /api/v1/orders (bearer)
 *  GET  — list the member's test orders.
 *  POST — place an order via the MOCK LetsGetChecked vendor, enforcing
 *         tier allowances + add-on pricing (€99 full / €69 recheck / €199 venous).
 */
import { requireConsentedMember } from "@/lib/consent-guard";
import { collections } from "@/lib/db";
import { newId } from "@/lib/ids";
import {
  ADDON_PRICE_EUR,
  CreateOrderInput,
  TIER_INCLUDED_TESTS,
  type TestOrder,
  type TestPanel,
  type TestOrderType,
} from "@/lib/models";
import { bloodTestVendor } from "@/lib/vendors/letsgetchecked.mock";
import { paymentsVendor } from "@/lib/vendors/stripe.mock";
import { emailVendor } from "@/lib/vendors/email.mock";

/** Panels each order type can carry. */
const PANELS_BY_TYPE: Record<TestOrderType, TestPanel[]> = {
  kit: ["full", "recheck"],
  venous: ["venous80"],
};

export async function GET(req: Request) {
  const auth = await requireConsentedMember(req);
  if (auth.denied) return auth.denied;

  const orders = await collections
    .testOrders()
    .then((c) =>
      c.find({ memberId: auth.member._id }).sort({ createdAt: -1 }).toArray()
    );
  return Response.json({ orders });
}

export async function POST(req: Request) {
  // Ordering a test also needs clinician_review consent (a clinician signs off).
  const auth = await requireConsentedMember(req, { clinicianReview: true });
  if (auth.denied) return auth.denied;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { error: "bad_request", message: "Expected JSON body." },
      { status: 400 }
    );
  }
  const parsed = CreateOrderInput.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "validation", issues: parsed.error.issues },
      { status: 400 }
    );
  }
  const { type, panel } = parsed.data;

  if (!PANELS_BY_TYPE[type].includes(panel)) {
    return Response.json(
      {
        error: "invalid_panel",
        message: `Panel "${panel}" is not available for order type "${type}". Kit = full | recheck; venous = venous80.`,
      },
      { status: 422 }
    );
  }

  const membership = await collections
    .memberships()
    .then((c) => c.findOne({ memberId: auth.member._id, status: "active" }));
  if (!membership) {
    return Response.json(
      { error: "no_membership", message: "An active membership is required to order tests." },
      { status: 403 }
    );
  }

  // --- tier allowance: is this panel still included in the current term? ---
  const ordersCol = await collections.testOrders();
  const allowance = TIER_INCLUDED_TESTS[membership.tier].find(
    (a) => a.panel === panel
  );
  let includedInPlan = false;
  if (allowance) {
    const usedThisTerm = await ordersCol.countDocuments({
      memberId: auth.member._id,
      panel,
      includedInPlan: true,
      createdAt: { $gte: membership.termStart },
    });
    // Quarterly cadence upgrade (+€130/yr) doubles the Essential allowance.
    const cap =
      membership.cadenceUpgrade && membership.tier === "essential"
        ? allowance.count * 2
        : allowance.count;
    includedInPlan = usedThisTerm < cap;
  }
  const priceEur = includedInPlan ? 0 : ADDON_PRICE_EUR[panel];

  // --- place the order with the MOCK LetsGetChecked vendor ---
  const vendorOrder = await bloodTestVendor.createKitOrder(
    auth.member._id,
    panel
  );

  const now = new Date();
  const order: TestOrder = {
    _id: newId("ord"), // collision-free (see lib/ids)
    memberId: auth.member._id,
    type,
    panel,
    status: vendorOrder.status,
    bookingStatus: type === "venous" ? "unbooked" : null,
    vendorOrderId: vendorOrder.vendorOrderId,
    priceEur,
    includedInPlan,
    createdAt: now,
    updatedAt: now,
  };
  await ordersCol.insertOne(order);

  // --- payment: only add-ons are charged (MOCK Stripe checkout session) ---
  const checkout =
    priceEur > 0
      ? await paymentsVendor.createCheckoutSession({
          memberId: auth.member._id,
          description: `Add-on ${panel} (${type}) — order ${order._id}`,
          amountEur: priceEur,
        })
      : null;

  // MOCK: confirmation email lands in the Mongo `outbox`, never sent.
  await emailVendor.send({
    to: auth.member.email,
    subject: includedInPlan
      ? "Your Arcaevo test is on its way"
      : `Your Arcaevo add-on test (€${priceEur})`,
    body: `Order ${order._id}: ${panel} panel via ${type === "kit" ? "finger-prick kit" : "in-home venous draw"}. We'll keep you posted at every step.`,
    template: "order_confirmation",
  });

  return Response.json({ order, checkout }, { status: 201 });
}
