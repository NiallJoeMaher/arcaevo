/**
 * POST /api/v1/admin/results/[id]/review — admin marks a reading as
 * clinician-reviewed. (Clinician review is MOCKED — docs/MOCKED_APIS.md §5;
 * a real flow needs a clinician portal + medical-ops partner.)
 *
 * Phase 22: sign-off also writes the panel's ClinicianNote onto the reading's
 * TestOrder — a template-assisted, wellness-framed summary of in-range vs
 * watch markers, signed by the mock persona (MOCKED_APIS §15, Dr. S. Nolan,
 * IMC 412887). The note is regenerated on every sign-off so it always
 * reflects the panel's current state; un-reviewing the last reading of a
 * panel removes it.
 */
import { currentAdmin, requireAdminRole } from "@/lib/auth";
import { logAdminAccess } from "@/lib/admin-audit";
import { clientIp } from "@/lib/rate-limit";
import { collections } from "@/lib/db";
import {
  composeClinicianNote,
  isWatchMarker,
  ReviewResultInput,
} from "@/lib/models";

/**
 * Recompute the panel note for an order from its readings' current state.
 * A "watch" marker is one whose latest verdict worsened or whose value sits
 * outside the member's own baseline band on the harmful side (isWatchMarker)
 * — never a diagnosis, just what the reviewer would flag for a €69 recheck.
 */
async function syncClinicianNote(orderId: string): Promise<void> {
  const [readingsCol, ordersCol] = await Promise.all([
    collections.biomarkerReadings(),
    collections.testOrders(),
  ]);
  const panel = await readingsCol.find({ orderId }).toArray();
  if (panel.length === 0) return;

  if (!panel.some((r) => r.clinicianReviewed)) {
    // Nothing on the panel is reviewed any more — the note no longer stands.
    await ordersCol.updateOne({ _id: orderId }, { $unset: { clinicianNote: "" } });
    return;
  }

  const rules = await collections.biomarkerRules().then((c) => c.find().toArray());
  const ruleByCode = new Map(rules.map((r) => [r.code, r]));
  const watchMarkerNames = panel
    .filter((r) => {
      const rule = ruleByCode.get(r.code);
      return rule ? isWatchMarker(r, rule.direction) : false;
    })
    .map((r) => ruleByCode.get(r.code)?.name ?? r.code);

  const note = composeClinicianNote({
    totalMarkers: panel.length,
    watchMarkerNames,
    readAt: new Date(),
  });
  await ordersCol.updateOne({ _id: orderId }, { $set: { clinicianNote: note } });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // Clinician sign-off writes the clinician note onto a member's Art.9 record,
  // so it is restricted to clinician|owner (ops is 403). Other admin views stay
  // any-role via requireAdmin.
  const denied = await requireAdminRole("clinician", "owner");
  if (denied) return denied;

  const { id } = await params;
  let reviewed = true;
  try {
    const body = await req.json();
    const parsed = ReviewResultInput.safeParse(body);
    if (parsed.success) reviewed = parsed.data.reviewed;
  } catch {
    // empty body ⇒ default: mark reviewed
  }

  const readings = await collections.biomarkerReadings();
  const result = await readings.findOneAndUpdate(
    { _id: id },
    { $set: { clinicianReviewed: reviewed } },
    { returnDocument: "after" }
  );
  if (!result) {
    return Response.json(
      { error: "not_found", message: `No reading ${id}.` },
      { status: 404 }
    );
  }

  // Phase 22: every reviewed panel carries a short human note (ALGORITHM §5).
  if (result.orderId) {
    await syncClinicianNote(result.orderId);
  }

  // DPIA R4: record the sign-off against the member whose record it touches.
  const admin = await currentAdmin();
  logAdminAccess({
    action: reviewed ? "result.review.signoff" : "result.review.unsign",
    adminId: admin?.adminId ?? null,
    role: admin?.role ?? null,
    targetMemberId: result.memberId,
    ip: clientIp(req),
  });

  return Response.json({ reading: result });
}
