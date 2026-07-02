/**
 * POST /api/v1/webhooks/letsgetchecked — MOCK webhook (docs/MOCKED_APIS.md §1).
 *
 * Payload shape is OUR GUESS, not LetsGetChecked's real schema:
 *   { "vendorOrderId": "lgc_mock_0001", "status": "shipped",
 *     "bookingStatus"?: "nurse_booked" }
 *
 * Advances the matching TestOrder (forward-only). When status hits
 * "results_ready", pulls the (mock, deterministic) results, computes baseline
 * bands + RCV verdicts, stores readings for clinician review, and queues the
 * results-ready email in the outbox.
 */
import { z } from "zod";
import { collections } from "@/lib/db";
import {
  ORDER_STATUS_SEQUENCE,
  TestOrderStatus,
  VenousBookingStatus,
  type BiomarkerReading,
} from "@/lib/models";
import { computeBaselineBand, computeRcvVerdict } from "@/lib/rcv";
import { bloodTestVendor } from "@/lib/vendors/letsgetchecked.mock";
import { emailVendor } from "@/lib/vendors/email.mock";

const WebhookPayload = z.object({
  vendorOrderId: z.string(),
  status: TestOrderStatus,
  bookingStatus: VenousBookingStatus.optional(),
});

// MOCK: signature verification is a documented no-op stub. Productionise with
// the real LGC webhook signing scheme before going live.
function verifySignature(_req: Request): boolean {
  return true; // MOCK: always accepted
}

export async function POST(req: Request) {
  if (!verifySignature(req)) {
    return Response.json({ error: "bad_signature" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { error: "bad_request", message: "Expected JSON body." },
      { status: 400 }
    );
  }
  const parsed = WebhookPayload.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "validation", issues: parsed.error.issues },
      { status: 400 }
    );
  }
  const { vendorOrderId, status, bookingStatus } = parsed.data;

  const ordersCol = await collections.testOrders();
  const order = await ordersCol.findOne({ vendorOrderId });
  if (!order) {
    return Response.json(
      { error: "not_found", message: `No order for vendor id ${vendorOrderId}.` },
      { status: 404 }
    );
  }

  // Forward-only status machine: ignore stale/out-of-order deliveries.
  const currentIdx = ORDER_STATUS_SEQUENCE.indexOf(order.status);
  const nextIdx = ORDER_STATUS_SEQUENCE.indexOf(status);
  if (nextIdx < currentIdx) {
    return Response.json({ ok: true, ignored: "stale_status" });
  }

  await ordersCol.updateOne(
    { _id: order._id },
    {
      $set: {
        status,
        updatedAt: new Date(),
        ...(order.type === "venous" && bookingStatus ? { bookingStatus } : {}),
      },
    }
  );

  // First transition into results_ready ⇒ ingest results.
  let ingested = 0;
  if (status === "results_ready" && order.status !== "results_ready") {
    ingested = await ingestResults(order._id, order.memberId, vendorOrderId);
  }

  return Response.json({ ok: true, orderId: order._id, status, ingested });
}

async function ingestResults(
  orderId: string,
  memberId: string,
  vendorOrderId: string
): Promise<number> {
  const [results, rules, readingsCol, usersCol] = await Promise.all([
    bloodTestVendor.getResults(vendorOrderId),
    collections.biomarkerRules().then((c) => c.find().toArray()),
    collections.biomarkerReadings(),
    collections.users(),
  ]);
  const ruleByCode = new Map(rules.map((r) => [r.code, r]));
  const takenAt = new Date();
  const existingCount = await readingsCol.countDocuments();

  const docs: BiomarkerReading[] = [];
  for (const [i, result] of results.entries()) {
    const rule = ruleByCode.get(result.code);
    const history = await readingsCol
      .find({ memberId, code: result.code })
      .sort({ takenAt: 1 })
      .toArray();
    const prior = history.at(-1) ?? null;
    const series = [...history.map((h) => h.value), result.value];
    docs.push({
      _id: `read_${String(existingCount + i + 1).padStart(4, "0")}`,
      memberId,
      orderId,
      code: result.code,
      value: result.value,
      unit: result.unit,
      takenAt,
      baselineBand: rule ? computeBaselineBand(series, rule.rcvPercent) : null,
      rcvVerdict:
        prior && rule
          ? computeRcvVerdict(prior.value, result.value, rule)
          : null,
      clinicianReviewed: false, // lands in the admin needs-review queue
      source: "lab", // Arcaevo pipeline results are lab-sourced (v2)
    });
  }
  if (docs.length) await readingsCol.insertMany(docs);

  const member = await usersCol.findOne({ _id: memberId });
  if (member) {
    await emailVendor.send({
      to: member.email,
      subject: "Your Arcaevo results are ready",
      body: `Results for order ${orderId} are in and queued for clinician review. Open the app to see how they compare with your baseline.`,
      template: "results_ready",
    });
  }
  return docs.length;
}
