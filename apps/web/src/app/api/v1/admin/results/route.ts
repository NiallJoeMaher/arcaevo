/**
 * GET /api/v1/admin/results — admin: the needs-review queue.
 * Readings with clinicianReviewed=false, oldest first, member joined in.
 * (Clinician review is MOCKED — docs/MOCKED_APIS.md §5.)
 */
import { currentAdmin, requireAdmin } from "@/lib/auth";
import { logAdminAccess } from "@/lib/admin-audit";
import { clientIp } from "@/lib/rate-limit";
import { collections } from "@/lib/db";

export async function GET(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  // DPIA R4: the review queue exposes every pending member's markers.
  const admin = await currentAdmin();
  logAdminAccess({
    action: "results.queue.read",
    adminId: admin?.adminId ?? null,
    role: admin?.role ?? null,
    ip: clientIp(req),
  });

  const [pending, users, rules] = await Promise.all([
    collections
      .biomarkerReadings()
      .then((c) =>
        c
          // v2: self-reported (uploaded) values are NEVER clinician-reviewed —
          // they don't belong in the sign-off queue (design_handoff_v2 §13).
          .find({ clinicianReviewed: false, source: { $ne: "self_reported" } })
          .sort({ takenAt: 1 })
          .toArray()
      ),
    collections.users().then((c) => c.find().toArray()),
    collections.biomarkerRules().then((c) => c.find().toArray()),
  ]);
  const userById = new Map(users.map((u) => [u._id, u]));
  const ruleByCode = new Map(rules.map((r) => [r.code, r]));

  return Response.json({
    queue: pending.map((r) => ({
      id: r._id,
      member: userById.get(r.memberId)
        ? { id: r.memberId, name: userById.get(r.memberId)!.name }
        : { id: r.memberId, name: "Unknown" },
      code: r.code,
      name: ruleByCode.get(r.code)?.name ?? r.code,
      value: r.value,
      unit: r.unit,
      takenAt: r.takenAt,
      rcvVerdict: r.rcvVerdict,
      orderId: r.orderId,
    })),
    count: pending.length,
  });
}
