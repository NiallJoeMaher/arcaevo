/**
 * REAL Bedrock bloodwork OCR vendor — the composition of three separately
 * tested pieces into one `extract(media)` method:
 *
 *   1. `runVisionExtraction` (transport)  — sends the lab-report image/PDF to
 *      Claude on Bedrock, returns the raw model JSON text or `null`. DUMB.
 *   2. `containsClinicalLanguage` (guard) — belt-and-braces OUTPUT safety guard.
 *   3. `validateExtraction` (validator)   — catalog-bounded, per-value, resilient.
 *
 * This module OWNS NO parse/validate/guard logic of its own — it only sequences
 * the pieces and glues them with a fail-safe JSON parse. The seam differs from
 * the mock vendor (`ai-extraction.mock.ts`, which is filename-based because no
 * bytes travel today): the real vendor takes IMAGE/PDF BYTES as `media`, since
 * that is what the model actually reads. Route wiring is Task 6.
 *
 * SAFETY-CRITICAL ORDERING (do not reorder):
 *   text = transport(...)                             // may be null/empty
 *   if !text                        → empty result
 *   if containsClinicalLanguage(text)                 // GUARD on the FULL raw
 *                                   → empty result       text, BEFORE any parse
 *   parsed = robustParse(text)      // JSON.parse, then ONE braces fallback
 *   if !parsed                      → empty result
 *   return validateExtraction(parsed, catalog)
 *
 * The guard runs on the COMPLETE raw text before/regardless of JSON parsing so a
 * leaked diagnosis rejects the WHOLE extraction (we drop everything rather than
 * surface any diagnosis into a wellness product). Fail-safe throughout — this
 * method NEVER throws; every failure returns the empty result that routes the
 * member to manual entry.
 *
 * Art.9 (health data): the media bytes, the raw model text, and any parsed value
 * are NEVER logged or persisted here — there is no logging in this module. Keep
 * it that way.
 */
import {
  runVisionExtraction,
  type Media,
  type VisionClient,
} from "@/lib/ai/transports/bedrock-vision";
import {
  OCR_SYSTEM_PROMPT,
  containsClinicalLanguage,
} from "@/lib/ai/bloodwork-ocr-prompt";
import {
  validateExtraction,
  type CatalogRule,
  type ValidationResult,
} from "@/lib/ai/bloodwork-extraction-schema";

/** The empty, fail-safe result — every failure/rejection path returns this. */
const EMPTY: ValidationResult = { extracted: [], droppedUnknown: [], droppedInvalid: 0 };

export interface BedrockExtractionVendorConfig {
  client: VisionClient;
  modelId: string;
  catalog: CatalogRule[];
}

export interface BedrockExtractionVendor {
  /** Transcribe + guard + validate `media` (image/PDF bytes). Never throws. */
  extract(media: Media): Promise<ValidationResult>;
}

/**
 * Robust, fail-safe JSON parse: try `JSON.parse`; on failure try ONE braces
 * fallback (slice from the first `{` to the last `}`, to unwrap prose/markdown
 * fences) and parse that; return `null` if both fail. Never throws.
 */
function robustParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end <= start) return null;
    try {
      return JSON.parse(text.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}

/**
 * Build the real Bedrock OCR vendor. `client` and `catalog` are injected so the
 * transport is DI-mockable in tests and the allowed markers/units are bounded by
 * the caller (the confirm route's canonical catalog).
 */
export function createBedrockExtractionVendor({
  client,
  modelId,
  catalog,
}: BedrockExtractionVendorConfig): BedrockExtractionVendor {
  return {
    async extract(media: Media): Promise<ValidationResult> {
      const text = await runVisionExtraction({
        client,
        modelId,
        system: OCR_SYSTEM_PROMPT,
        media,
      });

      // 2. null/empty transport output → fail safe.
      if (!text) return EMPTY;

      // 3. GUARD FIRST, on the FULL raw text, before any JSON parsing: a leaked
      // diagnosis rejects the whole extraction.
      if (containsClinicalLanguage(text)) return EMPTY;

      // 4. Robust, fail-safe parse (JSON.parse → ONE braces fallback).
      const parsed = robustParse(text);
      if (parsed === null) return EMPTY;

      // 5. Catalog-bounded validation (never throws).
      return validateExtraction(parsed, catalog);
    },
  };
}
