/**
 * GET /api/v1/results — bearer: the member's biomarker readings, newest first,
 * with the rule metadata (name/unit/RCV) joined in.
 *
 * Phase 22: each clinician-reviewed panel (= the readings of one TestOrder)
 * also carries the panel's `clinicianNote { text, clinicianName, imcNumber,
 * readAt }` — field names LOCKED by the shared contract (iOS decodes them).
 * `clinicianNote` is null while a reading awaits review or has no order
 * (self-reported uploads are never clinician-reviewed).
 */
import { requireConsentedMember } from "@/lib/consent-guard";
import { collections } from "@/lib/db";
import type { ClinicianNote } from "@/lib/models";

export async function GET(req: Request) {
  const auth = await requireConsentedMember(req);
  if (auth.denied) return auth.denied;

  const [readings, rules] = await Promise.all([
    collections
      .biomarkerReadings()
      .then((c) =>
        c.find({ memberId: auth.member._id }).sort({ takenAt: -1 }).toArray()
      ),
    collections.biomarkerRules().then((c) => c.find().toArray()),
  ]);
  const ruleByCode = new Map(rules.map((r) => [r.code, r]));

  // One clinician note per reviewed panel — stored on the panel's TestOrder.
  const orderIds = [
    ...new Set(
      readings
        .map((r) => r.orderId)
        .filter((id): id is string => typeof id === "string")
    ),
  ];
  const orders =
    orderIds.length === 0
      ? []
      : await collections
          .testOrders()
          .then((c) => c.find({ _id: { $in: orderIds } }).toArray());
  const noteByOrderId = new Map<string, ClinicianNote>(
    orders.flatMap((o) => (o.clinicianNote ? [[o._id, o.clinicianNote]] : []))
  );

  return Response.json({
    results: readings.map((r) => {
      const rule = ruleByCode.get(r.code);
      return {
        id: r._id,
        code: r.code,
        name: rule?.name ?? r.code,
        value: r.value,
        unit: r.unit,
        takenAt: r.takenAt,
        baselineBand: r.baselineBand,
        rcvVerdict: r.rcvVerdict,
        rcvPercent: rule?.rcvPercent ?? null,
        direction: rule?.direction ?? null,
        clinicianReviewed: r.clinicianReviewed,
        orderId: r.orderId,
        clinicianNote:
          r.clinicianReviewed && r.orderId
            ? noteByOrderId.get(r.orderId) ?? null
            : null,
      };
    }),
  });
}
