/**
 * Catalog-bounded validation for raw OCR bloodwork extraction (pure, no I/O).
 *
 * The AI/OCR step returns a raw, model-shaped extraction we do not trust yet.
 * Before it can become a persisted `BloodworkUpload.extracted[]` (see
 * lib/models.ts) and reach the confirm screen (design §13), it is validated
 * against the biomarker catalog:
 *   - KNOWN marker + ALLOWED unit  → kept, normalized to the extracted shape,
 *     with `name`/`code` taken from the catalog (never from the model).
 *   - low `confidence`             → `flagged`, so the confirm route forces the
 *     "was this 41 or 47?" resolution (see uploads/bloodwork/confirm/route.ts,
 *     which blocks on `confidence < CONFIDENCE_THRESHOLD`).
 *   - UNKNOWN code                 → dropped and reported in `droppedUnknown`
 *     (never invented) so the caller can route to manual entry.
 *   - known code + DISALLOWED unit → dropped (a bad unit is not a new marker).
 *   - empty / garbage input        → `{ extracted: [], droppedUnknown: [] }`;
 *     this function NEVER throws.
 *
 * UNIT VALIDATION SOURCE — the web catalog (`CANONICAL_BIOMARKER_RULES`) exposes
 * a SINGLE canonical `unit` per marker, and no shared allowed-units map exists
 * on web (the multi-unit hand-entry list lives only in iOS Swift). The confirm
 * route stores `extracted.unit` verbatim, so this validator is the real gate.
 * We therefore keep `CatalogRule` generic (`units: string[]`) and let the caller
 * build it from the rules via `catalogFromRules` (each rule → `units: [unit]`).
 * A future caller can widen the allowed units (e.g. iOS's ferritin ng/mL) with
 * no change to this pure validator.
 */
import { z } from "zod";
import type { BiomarkerRule } from "@/lib/models";
import {
  CONFIDENCE_THRESHOLD,
  type ExtractedValue,
} from "@/lib/vendors/ai-extraction.mock";

export { CONFIDENCE_THRESHOLD };

/** One raw value as produced by the OCR model, before we trust any of it. */
const RawValue = z.object({
  code: z.string(),
  value: z.number().finite(),
  unit: z.string(),
  confidence: z.number().min(0).max(1).default(1),
  alternatives: z.array(z.number()).nullish(),
});

/** The raw model-shaped extraction envelope. */
export const RawExtraction = z.object({
  values: z.array(RawValue).default([]),
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
}

/**
 * Build the validator's catalog from the canonical biomarker rules. Each rule
 * has one canonical `unit`, so its allowed-units list is `[unit]`.
 */
export function catalogFromRules(rules: BiomarkerRule[]): CatalogRule[] {
  return rules.map((r) => ({ code: r.code, name: r.name, units: [r.unit] }));
}

/**
 * Validate/normalize a raw extraction against the catalog. Pure; never throws.
 */
export function validateExtraction(
  raw: unknown,
  catalog: CatalogRule[]
): ValidationResult {
  const parsed = RawExtraction.safeParse(raw);
  if (!parsed.success) return { extracted: [], droppedUnknown: [] };

  const ruleByCode = new Map(catalog.map((r) => [r.code, r]));
  const extracted: ValidatedValue[] = [];
  const droppedUnknown: string[] = [];

  for (const v of parsed.data.values) {
    const rule = ruleByCode.get(v.code);
    if (!rule) {
      droppedUnknown.push(v.code); // unknown code → report, never invent
      continue;
    }
    if (!rule.units.includes(v.unit)) continue; // known code, bad unit → drop

    extracted.push({
      code: rule.code, // canonical, from the catalog
      name: rule.name, // canonical, from the catalog
      unit: v.unit,
      value: v.value,
      confidence: v.confidence,
      alternatives: v.alternatives ?? null,
      flagged: v.confidence < CONFIDENCE_THRESHOLD,
    });
  }

  return { extracted, droppedUnknown };
}
