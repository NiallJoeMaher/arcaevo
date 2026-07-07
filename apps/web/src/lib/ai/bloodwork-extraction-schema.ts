/**
 * Catalog-bounded validation for raw OCR bloodwork extraction (pure, no I/O).
 *
 * The AI/OCR step returns a raw, model-shaped extraction of GDPR Art.9 health
 * data that we do not trust yet. Before it can become a persisted
 * `BloodworkUpload.extracted[]` (see lib/models.ts) and reach the confirm
 * screen (design §13), it is validated against the biomarker catalog. Because
 * the input is untrusted OCR, RESILIENCE is the point — one malformed reading
 * must NOT discard the whole panel:
 *   - KNOWN marker + ALLOWED unit  → kept, normalized to the extracted shape,
 *     with `code`/`name`/`unit` taken from the catalog (never the model's).
 *   - untrusted `confidence`       → `flagged`, so the confirm route forces the
 *     "was this 41 or 47?" resolution (uploads/bloodwork/confirm/route.ts blocks
 *     on `confidence < CONFIDENCE_THRESHOLD`).
 *   - UNKNOWN code                 → dropped and reported in `droppedUnknown`
 *     (never invented) so the caller can route to manual entry.
 *   - MALFORMED reading OR bad unit → dropped and counted in `droppedInvalid`,
 *     so the route can later force review rather than let a member confirm an
 *     incomplete panel believing it complete. (Signal only; route decides.)
 *   - empty / garbage input        → `{ extracted: [], droppedUnknown: [],
 *     droppedInvalid: 0 }`; this function NEVER throws.
 *
 * PER-VALUE PARSING — the envelope is parsed loosely (an array of `unknown`),
 * then EACH element is parsed with `RawValue` independently, so a single bad
 * reading is dropped-and-counted instead of nuking the batch.
 *
 * UNIT VALIDATION SOURCE — the web catalog (`CANONICAL_BIOMARKER_RULES`) exposes
 * a SINGLE canonical `unit` per marker, and no shared allowed-units map exists
 * on web (the multi-unit hand-entry list lives only in iOS Swift). The confirm
 * route stores `extracted.unit` verbatim, so this validator is the real gate.
 * We keep `CatalogRule` generic (`units: string[]`) and let the caller build it
 * from the rules via `catalogFromRules` (each rule → `units: [unit]`); a future
 * caller can widen allowed units (e.g. iOS's ferritin ng/mL) with no change
 * here. OCR emits unit VARIANTS (Greek mu vs micro sign, ASCII `ug`), so units
 * are normalized on BOTH sides before matching and the CANONICAL catalog unit
 * is stored on the kept value (see `normalizeUnit`).
 */
import { z } from "zod";
import type { BiomarkerRule } from "@/lib/models";
import {
  CONFIDENCE_THRESHOLD,
  type ExtractedValue,
} from "@/lib/vendors/ai-extraction.mock";

export { CONFIDENCE_THRESHOLD };

/**
 * One raw value from the OCR model. `code`/`value`/`unit` MUST be well-formed
 * for the reading to survive (a non-finite value or non-array alternatives is a
 * corrupt read we cannot trust). `confidence` is deliberately `unknown` — it is
 * best-effort and must never, by itself, drop a reading (see the `confidence`
 * normalization below).
 */
const RawValue = z.object({
  code: z.string(),
  value: z.number().finite(),
  unit: z.string(),
  confidence: z.unknown().optional(),
  alternatives: z.array(z.number().finite()).nullish(),
});

/** The raw model-shaped extraction envelope, parsed loosely (per-value after). */
const RawExtractionShell = z.object({
  values: z.array(z.unknown()).default([]),
});

/** A catalog entry the validator gates against: a marker + its allowed units. */
export interface CatalogRule {
  code: string;
  name: string;
  units: string[];
}

/**
 * A validated + normalized reading: the persisted `ExtractedValue` shape (see
 * ai-extraction.mock.ts / BloodworkUploadSchema.extracted[]) plus `flagged`,
 * which the confirm screen uses to force resolution of low-confidence reads.
 */
export type ValidatedValue = ExtractedValue & { flagged: boolean };

export interface ValidationResult {
  extracted: ValidatedValue[];
  /** Codes the model returned that are not in the catalog → route to manual. */
  droppedUnknown: string[];
  /**
   * Count of readings dropped for being malformed (failed `RawValue`) or for
   * carrying a disallowed unit — i.e. everything dropped that ISN'T an unknown
   * code. Lets the route force review so a member never confirms an incomplete
   * panel believing it complete.
   */
  droppedInvalid: number;
}

/**
 * Build the validator's catalog from the canonical biomarker rules. Each rule
 * has one canonical `unit`, so its allowed-units list is `[unit]`.
 */
export function catalogFromRules(rules: BiomarkerRule[]): CatalogRule[] {
  return rules.map((r) => ({ code: r.code, name: r.name, units: [r.unit] }));
}

/**
 * Normalize a unit string so OCR variants match the catalog without losing
 * data: trim, map the Greek small mu (μ, U+03BC) to the micro sign (µ, U+00B5),
 * and a leading ASCII `ug` token to `µg`. NOT lowercased — casing is semantic
 * (L = litre ≠ l).
 */
function normalizeUnit(unit: string): string {
  return unit
    .trim()
    .replace(/μ/g, "µ") // Greek small letter mu (U+03BC) → micro sign (U+00B5)
    .replace(/^ug(?![A-Za-z])/, "µg"); // leading ASCII "ug" → "µg"
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/**
 * Validate/normalize a raw extraction against the catalog. Pure; never throws.
 */
export function validateExtraction(
  raw: unknown,
  catalog: CatalogRule[]
): ValidationResult {
  const shell = RawExtractionShell.safeParse(raw);
  if (!shell.success) return { extracted: [], droppedUnknown: [], droppedInvalid: 0 };

  const ruleByCode = new Map(catalog.map((r) => [r.code, r]));
  const extracted: ValidatedValue[] = [];
  const droppedUnknown: string[] = [];
  let droppedInvalid = 0;

  for (const element of shell.data.values) {
    const parsed = RawValue.safeParse(element);
    if (!parsed.success) {
      droppedInvalid++; // corrupt read → drop-and-count, keep the rest
      continue;
    }
    const v = parsed.data;

    const rule = ruleByCode.get(v.code);
    if (!rule) {
      droppedUnknown.push(v.code); // unknown code → report, never invent
      continue;
    }

    // Match on normalized units (both sides); store the CANONICAL catalog unit.
    const normalized = normalizeUnit(v.unit);
    const canonicalUnit = rule.units.find((u) => normalizeUnit(u) === normalized);
    if (!canonicalUnit) {
      droppedInvalid++; // known code, disallowed unit → drop-and-count
      continue;
    }

    // Confidence is conservative: a bad confidence must not drop a reading, only
    // force human review. A finite confidence is clamped to [0,1]; anything else
    // (missing, NaN, Infinity, wrong-typed) keeps the reading but forces flagged.
    const rawConfidence = v.confidence;
    const trusted =
      typeof rawConfidence === "number" && Number.isFinite(rawConfidence);
    const confidence = trusted ? clamp01(rawConfidence) : 1;
    const flagged = trusted ? confidence < CONFIDENCE_THRESHOLD : true;

    extracted.push({
      code: rule.code, // canonical, from the catalog
      name: rule.name, // canonical, from the catalog
      unit: canonicalUnit, // canonical, from the catalog
      value: v.value,
      confidence,
      alternatives: v.alternatives ?? null,
      flagged,
    });
  }

  return { extracted, droppedUnknown, droppedInvalid };
}
