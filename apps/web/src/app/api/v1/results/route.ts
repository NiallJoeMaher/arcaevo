/**
 * GET /api/v1/results — bearer: the member's biomarker readings, newest first,
 * with the rule metadata (name/unit/RCV) joined in.
 */
import { requireMember } from "@/lib/auth";
import { collections } from "@/lib/db";

export async function GET(req: Request) {
  const auth = await requireMember(req);
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
      };
    }),
  });
}
