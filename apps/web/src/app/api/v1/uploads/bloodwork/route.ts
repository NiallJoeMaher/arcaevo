/**
 * POST /api/v1/uploads/bloodwork — upload → AI extraction (design §13 U1→U2).
 *
 * Body: { kind: "photo" | "pdf" | "manual", fileName?, manualValues? }
 *
 * MOCK: no file bytes travel — the deterministic mock "AI"
 * (vendors/ai-extraction.mock.ts) fabricates an extraction from the file
 * name. Manual entry skips extraction entirely (confidence 1).
 *
 * Nothing enters the timeline yet: the response is the U2 confirm screen's
 * data. Low-confidence reads are flagged ("was this 41 or 47?") and BLOCK
 * confirmation until resolved. POST …/confirm writes the readings.
 */
import { requireMember } from "@/lib/auth";
import { parseJsonBody } from "@/lib/api";
import { collections } from "@/lib/db";
import { BloodworkUploadInput, type BloodworkUpload } from "@/lib/models";
import {
  CONFIDENCE_THRESHOLD,
  extractBloodwork,
} from "@/lib/vendors/ai-extraction.mock";

export async function POST(req: Request) {
  const auth = await requireMember(req);
  if (auth.denied) return auth.denied;

  const parsed = await parseJsonBody(req, BloodworkUploadInput);
  if (!parsed.ok) return parsed.response;
  const { kind, fileName, manualValues } = parsed.data;

  if (kind === "manual" && !manualValues?.length) {
    return Response.json(
      {
        error: "values_required",
        message: "Manual entry needs at least one typed value.",
      },
      { status: 422 }
    );
  }
  if (kind !== "manual" && !fileName) {
    return Response.json(
      {
        error: "file_required",
        message: "Photo/PDF uploads need a fileName (MOCK: no bytes travel).",
      },
      { status: 422 }
    );
  }

  // MOCK: deterministic fake extraction (or pass-through for manual entry).
  const extraction =
    kind === "manual"
      ? {
          sourceName: "Typed by hand",
          documentDate: new Date().toISOString().slice(0, 10),
          values: manualValues!.map((v) => ({
            code: v.code,
            name: v.code,
            unit: v.unit,
            value: v.value,
            confidence: 1, // the user IS the source
            alternatives: null,
          })),
        }
      : extractBloodwork(fileName!);

  const uploads = await collections.bloodworkUploads();
  const count = await uploads.countDocuments();
  const upload: BloodworkUpload = {
    _id: `upload_${String(count + 1).padStart(4, "0")}`,
    memberId: auth.member._id,
    kind,
    fileName: fileName ?? null,
    sourceName: extraction.sourceName,
    documentDate: extraction.documentDate,
    status: "pending_confirmation",
    extracted: extraction.values,
    createdAt: new Date(),
    confirmedAt: null,
  };
  await uploads.insertOne(upload);

  const flagged = extraction.values.filter(
    (v) => v.confidence < CONFIDENCE_THRESHOLD
  );
  return Response.json(
    {
      uploadId: upload._id,
      sourceName: upload.sourceName,
      documentDate: upload.documentDate,
      markersFound: extraction.values.length,
      values: extraction.values.map((v) => ({
        ...v,
        lowConfidence: v.confidence < CONFIDENCE_THRESHOLD,
      })),
      /** Flagged reads block until resolved — never guessed (design §13 U2). */
      flagged: flagged.map((v) => ({
        code: v.code,
        question: `Low confidence — was this ${v.alternatives?.[0]} or ${v.alternatives?.[1]}?`,
        alternatives: v.alternatives,
      })),
      nextStep:
        "Confirm every value via POST /api/v1/uploads/bloodwork/confirm — nothing enters your timeline unreviewed.",
    },
    { status: 201 }
  );
}
