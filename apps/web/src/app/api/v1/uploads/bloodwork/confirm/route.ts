/**
 * POST /api/v1/uploads/bloodwork/confirm — "Looks right — add all 12"
 * (design §13 U2→U3).
 *
 * Body: { uploadId, values: [{ code, value }], takenAt: "YYYY-MM-DD" }
 *
 * Rules:
 *  - Every flagged (low-confidence) marker MUST appear in `values` — the
 *    upload blocks until the "41 or 47?" question is answered.
 *  - Confirmed values become BiomarkerReadings with source "self_reported":
 *    hollow gold dots forever, excluded from clinician-reviewed claims,
 *    clinicianReviewed stays false.
 *  - Baseline bands + RCV verdicts are computed against the member's
 *    SELF-REPORTED history only (kept separate from the clinician-track lab
 *    baseline), against the chronologically-prior reading, excluding this one —
 *    history is the whole point of uploading (see lib/rcv.ts).
 */
import { requireConsentedMember } from "@/lib/consent-guard";
import { parseJsonBody } from "@/lib/api";
import { collections } from "@/lib/db";
import { newId } from "@/lib/ids";
import { BloodworkConfirmInput, type BiomarkerReading } from "@/lib/models";
import {
  baselineInputsForIngest,
  computeBaselineBand,
  computeRcvVerdict,
} from "@/lib/rcv";
import { CONFIDENCE_THRESHOLD } from "@/lib/vendors/ai-extraction.mock";

export async function POST(req: Request) {
  const auth = await requireConsentedMember(req);
  if (auth.denied) return auth.denied;

  const parsed = await parseJsonBody(req, BloodworkConfirmInput);
  if (!parsed.ok) return parsed.response;
  const { uploadId, values, takenAt } = parsed.data;

  const uploads = await collections.bloodworkUploads();
  const upload = await uploads.findOne({
    _id: uploadId,
    memberId: auth.member._id,
  });
  if (!upload) {
    return Response.json(
      { error: "not_found", message: `No upload ${uploadId} on your account.` },
      { status: 404 }
    );
  }
  if (upload.status !== "pending_confirmation") {
    return Response.json(
      { error: "already_confirmed", message: "This upload was already handled." },
      { status: 409 }
    );
  }

  // Flagged reads block until resolved — the user must supply a value.
  const confirmedByCode = new Map(values.map((v) => [v.code, v.value]));
  const unresolved = upload.extracted.filter(
    (v) => v.confidence < CONFIDENCE_THRESHOLD && !confirmedByCode.has(v.code)
  );
  if (unresolved.length) {
    return Response.json(
      {
        error: "unresolved_low_confidence",
        message: "Some low-confidence reads still need your answer.",
        unresolved: unresolved.map((v) => ({
          code: v.code,
          alternatives: v.alternatives,
        })),
      },
      { status: 422 }
    );
  }

  // Only markers the extraction (or manual entry) actually contained.
  const extractedByCode = new Map(upload.extracted.map((v) => [v.code, v]));
  const unknown = values.filter((v) => !extractedByCode.has(v.code));
  if (unknown.length) {
    return Response.json(
      {
        error: "unknown_markers",
        message: `Not part of this upload: ${unknown.map((v) => v.code).join(", ")}.`,
      },
      { status: 422 }
    );
  }

  const readingsCol = await collections.biomarkerReadings();
  const rules = await collections
    .biomarkerRules()
    .then((c) => c.find().toArray());
  const ruleByCode = new Map(rules.map((r) => [r.code, r]));

  // Batch the history lookup: ONE query for every confirmed code (bounded to
  // ≤100 values by the zod schema), then group in memory — never a per-value
  // query loop (that was a DoS amplification path).
  const codes = values.map((v) => v.code);
  const allHistory = await readingsCol
    .find({ memberId: auth.member._id, code: { $in: codes } })
    .sort({ takenAt: 1 })
    .toArray();
  const historyByCode = new Map<string, typeof allHistory>();
  for (const h of allHistory) {
    const arr = historyByCode.get(h.code);
    if (arr) arr.push(h);
    else historyByCode.set(h.code, [h]);
  }

  const takenAtDate = new Date(`${takenAt}T09:00:00.000Z`);
  const docs: BiomarkerReading[] = [];
  for (const confirmed of values) {
    const extracted = extractedByCode.get(confirmed.code)!;
    const rule = ruleByCode.get(confirmed.code);
    const history = historyByCode.get(confirmed.code) ?? [];
    // Self-reported readings are verdicted/banded against the member's
    // self-reported history ONLY (kept separate from the clinician-track lab
    // baseline), against the chronologically-prior reading (so backfilled old
    // bloodwork isn't compared to today's), excluding this reading. See
    // lib/rcv.ts baselineInputsForIngest.
    const { prior, series } = baselineInputsForIngest(history, {
      takenAt: takenAtDate,
      source: "self_reported",
    });
    docs.push({
      _id: newId("read"), // collision-free (see lib/ids)
      memberId: auth.member._id,
      orderId: null, // not an Arcaevo order — user-provided history
      code: confirmed.code,
      value: confirmed.value,
      unit: extracted.unit,
      takenAt: takenAtDate,
      baselineBand: rule ? computeBaselineBand(series, rule.rcvPercent) : null,
      rcvVerdict:
        prior && rule
          ? computeRcvVerdict(prior.value, confirmed.value, rule)
          : null,
      clinicianReviewed: false, // self-reported is never clinician-reviewed
      source: "self_reported", // hollow gold dots forever (design §13 U3)
    });
  }
  if (docs.length) await readingsCol.insertMany(docs);

  await uploads.updateOne(
    { _id: upload._id },
    { $set: { status: "confirmed", confirmedAt: new Date() } }
  );

  return Response.json(
    {
      ok: true,
      uploadId: upload._id,
      readingsAdded: docs.length,
      source: "self_reported",
      note: "Self-reported points stay visually distinct forever and are excluded from clinician-reviewed claims.",
    },
    { status: 201 }
  );
}
