/**
 * POST /api/v1/uploads/bloodwork — upload → AI extraction (design §13 U1→U2).
 *
 * Body: { kind: "photo" | "pdf" | "manual", fileName?, manualValues?, media? }
 *
 * THREE PATHS, in precedence order:
 *  1. REAL OCR — creds configured (getExtractionVendor) AND `media` bytes
 *     supplied: the EU Bedrock vision vendor transcribes the image/PDF. Runs
 *     regardless of mockExtractionEnabled() (real creds ⇒ a real member's real
 *     document; never fabricate). Fail-safe: an empty result routes to honest
 *     manual entry (nothing persisted).
 *  2. MOCK — no creds / no bytes, and mockExtractionEnabled() (dev/e2e): the
 *     deterministic mock fabricates an extraction from the file name. UNCHANGED.
 *  3. HONEST MANUAL — no creds / no bytes, mock disabled (production): return a
 *     manual-entry state instead of guessing (audit must-fix #2). Manual entry
 *     (kind:"manual") skips extraction entirely (confidence 1).
 *
 * Nothing enters the timeline yet: the response is the U2 confirm screen's data.
 * Low-confidence reads are flagged ("was this 41 or 47?") and BLOCK confirmation
 * until resolved. POST …/confirm writes the readings.
 *
 * Art.9 (health data): the base64 `media` flows request → vendor.extract →
 * DISCARDED. It is NEVER written to Mongo (the BloodworkUpload doc has no
 * raw-image field) and NEVER logged. Only the validated numeric readings persist.
 */
import { requireConsentedMember } from "@/lib/consent-guard";
import { parseJsonBody } from "@/lib/api";
import { collections } from "@/lib/db";
import { mockExtractionEnabled } from "@/lib/env";
import { getExtractionVendor } from "@/lib/ai-extraction";
import { newId } from "@/lib/ids";
import { BloodworkUploadInput, type BloodworkUpload } from "@/lib/models";
import type { ValidatedValue } from "@/lib/ai/bloodwork-extraction-schema";
import {
  CONFIDENCE_THRESHOLD,
  extractBloodwork,
  type ExtractedValue,
} from "@/lib/vendors/ai-extraction.mock";

/** The honest manual-entry state (nothing persisted). `extra` is additive:
 * the real-OCR failure path attaches `unreadableCount`; the production gate
 * omits it, keeping that response byte-shape unchanged (e2e parity). */
function manualEntryResponse(message: string, extra?: Record<string, unknown>) {
  return Response.json(
    {
      manualEntryRequired: true,
      markersFound: 0,
      values: [],
      flagged: [],
      message,
      nextStep:
        'Re-submit as POST /api/v1/uploads/bloodwork with kind:"manual" and your typed values.',
      ...(extra ?? {}),
    },
    { status: 200 }
  );
}

/** Just below the confirm gate so an untrusted (flagged) read can never be
 * silently confirmed. */
const FLAGGED_SENTINEL_CONFIDENCE = CONFIDENCE_THRESHOLD - 0.01;

/**
 * Map a validated real-OCR reading to the persisted (confidence-driven)
 * `extracted[]` shape. The confirm route and the `flagged[]` response both gate
 * SOLELY on `confidence < CONFIDENCE_THRESHOLD`, so a read the validator flagged
 * but could NOT attach a trusted confidence to (it sets confidence=1,
 * flagged=true) is persisted just BELOW the threshold — otherwise the confirm
 * screen would let the member confirm an untrusted read without resolving it.
 */
function toPersistedValue(v: ValidatedValue): ExtractedValue {
  const confidence =
    v.flagged && v.confidence >= CONFIDENCE_THRESHOLD
      ? FLAGGED_SENTINEL_CONFIDENCE
      : v.confidence;
  return {
    code: v.code,
    name: v.name,
    unit: v.unit,
    value: v.value,
    confidence,
    alternatives: v.alternatives,
  };
}

/** The confirm-screen question for a flagged read — resilient to a missing pair
 * of candidate readings (the real vendor may flag a read with no alternatives). */
function flaggedQuestion(v: ExtractedValue): string {
  if (v.alternatives && v.alternatives.length >= 2) {
    return `Low confidence — was this ${v.alternatives[0]} or ${v.alternatives[1]}?`;
  }
  return "Low confidence — please re-enter this value to confirm it.";
}

/** Persist the pending upload and return the U2 confirm-screen payload. `extra`
 * is merged additively (real-OCR path adds `unreadableCount`). */
async function persistAndRespond(params: {
  memberId: string;
  kind: BloodworkUpload["kind"];
  fileName: string | null;
  sourceName: string;
  documentDate: string | null;
  values: ExtractedValue[];
  extra?: Record<string, unknown>;
}) {
  const uploads = await collections.bloodworkUploads();
  const upload: BloodworkUpload = {
    _id: newId("upload"), // collision-free (see lib/ids)
    memberId: params.memberId,
    kind: params.kind,
    fileName: params.fileName,
    sourceName: params.sourceName,
    documentDate: params.documentDate,
    status: "pending_confirmation",
    extracted: params.values,
    createdAt: new Date(),
    confirmedAt: null,
  };
  await uploads.insertOne(upload);

  const flagged = params.values.filter((v) => v.confidence < CONFIDENCE_THRESHOLD);
  return Response.json(
    {
      uploadId: upload._id,
      sourceName: upload.sourceName,
      documentDate: upload.documentDate,
      markersFound: params.values.length,
      values: params.values.map((v) => ({
        ...v,
        lowConfidence: v.confidence < CONFIDENCE_THRESHOLD,
      })),
      /** Flagged reads block until resolved — never guessed (design §13 U2). */
      flagged: flagged.map((v) => ({
        code: v.code,
        question: flaggedQuestion(v),
        alternatives: v.alternatives,
      })),
      ...(params.extra ?? {}),
      nextStep:
        "Confirm every value via POST /api/v1/uploads/bloodwork/confirm — nothing enters your timeline unreviewed.",
    },
    { status: 201 }
  );
}

export async function POST(req: Request) {
  const auth = await requireConsentedMember(req);
  if (auth.denied) return auth.denied;

  const parsed = await parseJsonBody(req, BloodworkUploadInput);
  if (!parsed.ok) return parsed.response;
  const { kind, fileName, manualValues, media } = parsed.data;

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
        message: "Photo/PDF uploads need a fileName.",
      },
      { status: 422 }
    );
  }

  // PATH 1 — REAL OCR. Only when the client sent bytes AND creds select a real
  // vendor. This runs even in production (mock disabled): real creds mean a real
  // member's real document, so we transcribe it rather than guess.
  if (kind !== "manual" && media) {
    const vendor = getExtractionVendor();
    if (vendor) {
      // Belt-and-braces fail-safe: extract() is documented never-throw and that
      // holds today, but this is the live Art.9 request path — wrap the whole
      // extract-and-map block so ANY future regression in the vendor/transport/
      // parse/map chain degrades to manual entry instead of surfacing a 500 to a
      // member mid-upload. The media bytes are discarded right here — never
      // persisted, never logged (Art.9).
      try {
        const result = await vendor.extract(media);
        const unreadableCount =
          result.droppedUnknown.length + result.droppedInvalid;

        if (result.extracted.length === 0) {
          // Nothing legible — honest manual entry (nothing persisted). The
          // additive `unreadableCount` lets the client say "N markers couldn't
          // be read — add them manually".
          return manualEntryResponse(
            "We couldn't reliably read this document — enter your values by hand and we'll add them to your timeline.",
            { unreadableCount }
          );
        }

        return await persistAndRespond({
          memberId: auth.member._id,
          kind,
          fileName: fileName ?? null,
          // No OCR of the letterhead — use the uploaded file name as the source.
          sourceName: fileName!,
          // No OCR of the draw date — the member sets it at confirm (takenAt).
          documentDate: null,
          values: result.extracted.map(toPersistedValue),
          extra: { unreadableCount },
        });
      } catch {
        // Fail safe: never a 500 on the upload path. Nothing was persisted (the
        // insert either didn't run or its failure landed here).
        return manualEntryResponse(
          "We couldn't reliably read this document — enter your values by hand and we'll add them to your timeline."
        );
      }
    }
    // Creds absent but bytes present (e.g. dev with no keys) → fall through to
    // the mock/honest-manual gate below, exactly as before.
  }

  // PATH 3 — HONEST MANUAL (production, mock disabled, no real vendor ran). With
  // no real EU OCR vendor configured, the photo/PDF path must NOT fabricate
  // values — a real user would otherwise "confirm" invented numbers as their own
  // health data. Nothing is persisted; the client re-submits with kind:"manual".
  if (kind !== "manual" && !mockExtractionEnabled()) {
    return manualEntryResponse(
      "Automatic reading of photos and PDFs isn't available yet — enter your values by hand and we'll add them to your timeline."
    );
  }

  // PATH 2 — MOCK (dev/e2e) or MANUAL pass-through. Deterministic fake
  // extraction, or the user-typed values (confidence 1 — the user IS the source).
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

  return persistAndRespond({
    memberId: auth.member._id,
    kind,
    fileName: fileName ?? null,
    sourceName: extraction.sourceName,
    documentDate: extraction.documentDate,
    values: extraction.values,
  });
}
