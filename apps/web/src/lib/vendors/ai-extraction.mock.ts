// MOCK: AI bloodwork extraction — NO real model, NO OCR, NO network calls.
//
// Design §13 (design_handoff_v2): photo/PDF/manual → AI reads the document,
// the user confirms EVERY value before it becomes data. Low-confidence reads
// are flagged, never guessed ("was this 41 or 47?"), and block confirmation
// until resolved. Units auto-converted, original preserved.
//
// This mock is fully deterministic: an fnv1a hash of the file name decides
// which markers are "found", their values, and which single marker (if any)
// comes back low-confidence with two candidate readings. Same file name →
// same extraction, forever. See docs/MOCKED_APIS.md §11 to productionise
// (EU-hosted vision model / OCR + unit normalisation + human-in-the-loop).

export interface ExtractedValue {
  code: string;
  name: string;
  unit: string;
  value: number;
  /** 0–1. Below CONFIDENCE_THRESHOLD the read is flagged and blocks. */
  confidence: number;
  /** Candidate readings for flagged values, e.g. [41, 47]. Null otherwise. */
  alternatives: number[] | null;
}

export interface ExtractionResult {
  sourceName: string; // lab/letterhead the "AI" read off the document
  documentDate: string; // YYYY-MM-DD
  values: ExtractedValue[];
}

/** Reads below this are flagged and MUST be resolved before confirm. */
export const CONFIDENCE_THRESHOLD = 0.9;

function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Marker pool mirrors the seeded BiomarkerRules (codes must match). */
const MARKER_POOL: { code: string; name: string; unit: string; typical: number }[] = [
  { code: "apob", name: "ApoB", unit: "g/L", typical: 0.95 },
  { code: "ldl_c", name: "LDL-C", unit: "mmol/L", typical: 3.1 },
  { code: "hdl_c", name: "HDL-C", unit: "mmol/L", typical: 1.3 },
  { code: "triglycerides", name: "Triglycerides", unit: "mmol/L", typical: 1.4 },
  { code: "hba1c", name: "HbA1c", unit: "mmol/mol", typical: 36 },
  { code: "fasting_glucose", name: "Fasting glucose", unit: "mmol/L", typical: 5.1 },
  { code: "hs_crp", name: "hs-CRP", unit: "mg/L", typical: 1.2 },
  { code: "ferritin", name: "Ferritin", unit: "µg/L", typical: 41 },
  { code: "vitamin_d", name: "Vitamin D (25-OH)", unit: "nmol/L", typical: 62 },
  { code: "tsh", name: "TSH", unit: "mIU/L", typical: 1.8 },
  { code: "alt", name: "ALT", unit: "U/L", typical: 24 },
  { code: "creatinine", name: "Creatinine (eGFR basis)", unit: "µmol/L", typical: 82 },
];

const SOURCE_NAMES = [
  "St. Vincent's",
  "Beaumont Hospital",
  "Affidea Dublin",
  "GP letter",
];

/**
 * MOCK: "extract" biomarker values from an uploaded document.
 * Deterministic in `fileName` — no randomness, no I/O.
 */
export function extractBloodwork(fileName: string): ExtractionResult {
  const seed = fnv1a(fileName);
  const count = 8 + (seed % 5); // 8–12 markers found
  const markers = MARKER_POOL.slice(0, count);
  // Roughly half of uploads contain one ambiguous read (like the designed
  // ferritin "41 or 47?"): pick it deterministically from the hash.
  const flaggedIndex = seed % 2 === 0 ? seed % count : -1;

  const values: ExtractedValue[] = markers.map((m, i) => {
    const jitter = (((seed >> (i % 24)) & 0xff) / 255 - 0.5) * 0.2; // ±10%
    const value = Math.round(m.typical * (1 + jitter) * 100) / 100;
    if (i === flaggedIndex) {
      // Digit-ambiguity style alternative (41 vs 47) — never guessed.
      const alt = Math.round((value + Math.max(1, value * 0.15)) * 100) / 100;
      return {
        code: m.code,
        name: m.name,
        unit: m.unit,
        value,
        confidence: 0.55,
        alternatives: [value, alt],
      };
    }
    return {
      code: m.code,
      name: m.name,
      unit: m.unit,
      value,
      confidence: 0.93 + ((seed >> i) % 7) / 100, // 0.93–0.99
      alternatives: null,
    };
  });

  // Deterministic "document metadata" the AI read off the page.
  const year = 2024 + (seed % 3);
  const month = 1 + (seed % 12);
  const day = 1 + (seed % 28);
  return {
    sourceName: SOURCE_NAMES[seed % SOURCE_NAMES.length],
    documentDate: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    values,
  };
}
