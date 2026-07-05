/**
 * Canonical biomarker rule table — the SINGLE SOURCE OF TRUTH for every
 * biomarker's Reference Change Value (RCV %), unit, and direction.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * The RCV percentage decides whether a change between two readings of the same
 * marker is a *real* signal or within-noise. These numbers were previously
 * defined twice — here on the web (the seed) and again as hardcoded Swift
 * constants in iOS (`ArcaevoKit/VitalityEngine.swift`, `BiomarkerRuleLite.defaults`)
 * — and the two copies drifted apart (e.g. hs-CRP 85% web vs 46% iOS). A member
 * then saw a *different* "meaningful change" verdict on web vs phone. That is a
 * correctness/trust bug.
 *
 * The fix: WEB IS CANONICAL. This array is the one place the numbers live.
 *   - `scripts/seed.ts` seeds the `biomarkerRules` collection from it.
 *   - `GET /api/v1/biomarker-rules` serves it publicly so iOS can fetch the
 *     live values at runtime.
 *   - iOS hardcodes the same values as an offline fallback and a parity test
 *     on each side fails if they ever diverge again.
 *
 * ⚠️ THESE % VALUES ARE PROVISIONAL. They are plausible wellness thresholds, NOT
 * clinically-validated. They MUST be confirmed by a clinician and against
 * published biological-variation (CVi/CVa → RCV) data before any real clinical
 * reliance. Arcaevo is a wellness product, never a diagnostic device. Any change
 * to a number here is a deliberate clinical decision — update docs/RCV_THRESHOLDS.md
 * and both parity tests (web + iOS) in the same change.
 */
import type { BiomarkerRule } from "@/lib/models";

/**
 * The canonical rules. `_id` doubles as the marker `code`. Keep this list and
 * the literals in `src/lib/__tests__/biomarker-rules.test.ts` in lockstep.
 */
export const CANONICAL_BIOMARKER_RULES: BiomarkerRule[] = [
  { _id: "apob", code: "apob", name: "ApoB", unit: "g/L", rcvPercent: 10, direction: "lower_is_better" },
  { _id: "ldl_c", code: "ldl_c", name: "LDL-C", unit: "mmol/L", rcvPercent: 17, direction: "lower_is_better" },
  { _id: "hdl_c", code: "hdl_c", name: "HDL-C", unit: "mmol/L", rcvPercent: 12, direction: "higher_is_better" },
  { _id: "triglycerides", code: "triglycerides", name: "Triglycerides", unit: "mmol/L", rcvPercent: 40, direction: "lower_is_better" },
  { _id: "hba1c", code: "hba1c", name: "HbA1c", unit: "mmol/mol", rcvPercent: 6, direction: "lower_is_better" },
  { _id: "fasting_glucose", code: "fasting_glucose", name: "Fasting glucose", unit: "mmol/L", rcvPercent: 11, direction: "lower_is_better" },
  { _id: "hs_crp", code: "hs_crp", name: "hs-CRP", unit: "mg/L", rcvPercent: 85, direction: "lower_is_better" },
  { _id: "ferritin", code: "ferritin", name: "Ferritin", unit: "µg/L", rcvPercent: 30, direction: "higher_is_better" },
  { _id: "vitamin_d", code: "vitamin_d", name: "Vitamin D (25-OH)", unit: "nmol/L", rcvPercent: 25, direction: "higher_is_better" },
  { _id: "tsh", code: "tsh", name: "TSH", unit: "mIU/L", rcvPercent: 20, direction: "lower_is_better" },
  { _id: "alt", code: "alt", name: "ALT", unit: "U/L", rcvPercent: 25, direction: "lower_is_better" },
  { _id: "creatinine", code: "creatinine", name: "Creatinine (eGFR basis)", unit: "µmol/L", rcvPercent: 9, direction: "lower_is_better" },
  { _id: "testosterone", code: "testosterone", name: "Testosterone (total)", unit: "nmol/L", rcvPercent: 20, direction: "higher_is_better" },
  { _id: "cortisol", code: "cortisol", name: "Cortisol (morning)", unit: "nmol/L", rcvPercent: 45, direction: "lower_is_better" },
  { _id: "omega3_index", code: "omega3_index", name: "Omega-3 Index", unit: "%", rcvPercent: 15, direction: "higher_is_better" },
];

/** One public rule row as served by `GET /api/v1/biomarker-rules`. */
export interface PublicBiomarkerRule {
  code: string;
  rcvPercent: number;
  unit: string;
  direction: BiomarkerRule["direction"];
}

/** The stable public payload shape for the runtime rules endpoint. */
export interface BiomarkerRulesResponse {
  rules: PublicBiomarkerRule[];
}

/** Project the canonical rules to the public (secret-free) endpoint shape. */
export function publicBiomarkerRules(): PublicBiomarkerRule[] {
  return CANONICAL_BIOMARKER_RULES.map((r) => ({
    code: r.code,
    rcvPercent: r.rcvPercent,
    unit: r.unit,
    direction: r.direction,
  }));
}

/** Canonical `code → rcvPercent` map (used by parity tests + consumers). */
export function canonicalRcvMap(): Record<string, number> {
  return Object.fromEntries(
    CANONICAL_BIOMARKER_RULES.map((r) => [r.code, r.rcvPercent])
  );
}
