/**
 * Unit tests for the catalog-bounded validation of raw OCR extraction output.
 *
 * The AI/OCR step (Task 2) hands us a raw, model-shaped extraction. Before that
 * ever reaches the persisted `BloodworkUpload.extracted[]` / the confirm screen,
 * it MUST be validated against the biomarker catalog: known markers with allowed
 * units are kept and normalized; low-confidence reads are flagged (so the confirm
 * screen forces "41 or 47?"); unknown codes are dropped and reported (never
 * invented); known markers carrying a disallowed unit are dropped; garbage never
 * throws. See lib/ai/bloodwork-extraction-schema.ts.
 */
import { describe, expect, it } from "vitest";
import { CONFIDENCE_THRESHOLD } from "@/lib/vendors/ai-extraction.mock";
import { CANONICAL_BIOMARKER_RULES } from "@/lib/biomarker-rules";
import {
  catalogFromRules,
  validateExtraction,
  type CatalogRule,
} from "@/lib/ai/bloodwork-extraction-schema";

// The catalog the OCR validator gates against: canonical web rules, each with
// its single canonical unit as the allowed unit (mirrors the confirm route).
const catalog = catalogFromRules(CANONICAL_BIOMARKER_RULES);

describe("validateExtraction", () => {
  it("keeps a clean known marker, normalizing name/unit from the catalog and not flagging it", () => {
    const { extracted, droppedUnknown } = validateExtraction(
      { values: [{ code: "ferritin", value: 41, unit: "µg/L", confidence: 0.97 }] },
      catalog
    );

    expect(droppedUnknown).toEqual([]);
    expect(extracted).toEqual([
      {
        code: "ferritin",
        name: "Ferritin", // canonical name from the catalog, not the raw input
        unit: "µg/L",
        value: 41,
        confidence: 0.97,
        alternatives: null,
        flagged: false,
      },
    ]);
  });

  it("flags a low-confidence read and preserves its candidate alternatives", () => {
    const { extracted } = validateExtraction(
      {
        values: [
          {
            code: "ferritin",
            value: 41,
            unit: "µg/L",
            confidence: 0.55,
            alternatives: [41, 47],
          },
        ],
      },
      catalog
    );

    expect(extracted).toHaveLength(1);
    expect(extracted[0].flagged).toBe(true);
    expect(extracted[0].confidence).toBeLessThan(CONFIDENCE_THRESHOLD);
    expect(extracted[0].alternatives).toEqual([41, 47]);
  });

  it("drops an unknown marker and reports its code in droppedUnknown (never invents)", () => {
    const { extracted, droppedUnknown } = validateExtraction(
      {
        values: [
          { code: "unobtanium", value: 3.2, unit: "mg/L", confidence: 0.99 },
          { code: "apob", value: 0.95, unit: "g/L", confidence: 0.99 },
        ],
      },
      catalog
    );

    expect(droppedUnknown).toEqual(["unobtanium"]);
    expect(extracted.map((v) => v.code)).toEqual(["apob"]);
  });

  it("drops a known marker that carries a disallowed unit", () => {
    // Ferritin's canonical/allowed unit is µg/L; ng/mL is not accepted here.
    const { extracted, droppedUnknown } = validateExtraction(
      { values: [{ code: "ferritin", value: 41, unit: "ng/mL", confidence: 0.99 }] },
      catalog
    );

    expect(extracted).toEqual([]);
    // A known code with a bad unit is not an "unknown" code.
    expect(droppedUnknown).toEqual([]);
  });

  it("returns empty (never throws) on empty or garbage input", () => {
    const empties: unknown[] = [
      undefined,
      null,
      42,
      "not-json",
      {},
      { values: [] },
      { values: "nonsense" },
      { values: [{ code: "ferritin" }] }, // missing value/unit
      { values: [{ code: "ferritin", value: Infinity, unit: "µg/L" }] }, // non-finite
    ];

    for (const bad of empties) {
      const result = validateExtraction(bad, catalog);
      expect(result).toEqual({ extracted: [], droppedUnknown: [] });
    }
  });

  it("defaults a missing confidence to a confident (unflagged) read", () => {
    const { extracted } = validateExtraction(
      { values: [{ code: "apob", value: 0.95, unit: "g/L" }] },
      catalog
    );

    expect(extracted).toHaveLength(1);
    expect(extracted[0].confidence).toBe(1);
    expect(extracted[0].flagged).toBe(false);
  });
});

describe("catalogFromRules", () => {
  it("maps each canonical rule to its single allowed unit", () => {
    const rules: CatalogRule[] = catalogFromRules([
      {
        _id: "ferritin",
        code: "ferritin",
        name: "Ferritin",
        unit: "µg/L",
        rcvPercent: 30,
        direction: "higher_is_better",
      },
    ]);

    expect(rules).toEqual([{ code: "ferritin", name: "Ferritin", units: ["µg/L"] }]);
  });
});
