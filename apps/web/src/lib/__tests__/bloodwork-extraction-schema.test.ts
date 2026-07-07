/**
 * Unit tests for the catalog-bounded validation of raw OCR extraction output.
 *
 * The AI/OCR step (Task 2) hands us a raw, model-shaped extraction of GDPR
 * Art.9 health data. Before that ever reaches the persisted
 * `BloodworkUpload.extracted[]` / the confirm screen, it MUST be validated
 * against the biomarker catalog. Because the input is untrusted OCR, resilience
 * is the point: one malformed reading must NOT discard the whole panel.
 *
 * Behaviours:
 *  - known marker + allowed unit → kept, normalized (canonical name/unit).
 *  - low / untrusted confidence   → flagged (confirm screen forces resolution).
 *  - unknown code                 → dropped + reported in `droppedUnknown`.
 *  - malformed reading OR bad unit → dropped + counted in `droppedInvalid`.
 *  - unit variants (μ vs µ, ug)    → normalized before matching, stored canonical.
 *  - empty / garbage input         → empty; NEVER throws.
 * See lib/ai/bloodwork-extraction-schema.ts.
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
    const { extracted, droppedUnknown, droppedInvalid } = validateExtraction(
      { values: [{ code: "ferritin", value: 41, unit: "µg/L", confidence: 0.97 }] },
      catalog
    );

    expect(droppedUnknown).toEqual([]);
    expect(droppedInvalid).toBe(0);
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
    const { extracted, droppedUnknown, droppedInvalid } = validateExtraction(
      {
        values: [
          { code: "unobtanium", value: 3.2, unit: "mg/L", confidence: 0.99 },
          { code: "apob", value: 0.95, unit: "g/L", confidence: 0.99 },
        ],
      },
      catalog
    );

    expect(droppedUnknown).toEqual(["unobtanium"]);
    expect(droppedInvalid).toBe(0); // unknown codes are not "invalid"
    expect(extracted.map((v) => v.code)).toEqual(["apob"]);
  });

  it("drops a known marker that carries a disallowed unit and counts it as invalid", () => {
    // Ferritin's canonical/allowed unit is µg/L; mg/L is not accepted here.
    const { extracted, droppedUnknown, droppedInvalid } = validateExtraction(
      { values: [{ code: "ferritin", value: 41, unit: "mg/L", confidence: 0.99 }] },
      catalog
    );

    expect(extracted).toEqual([]);
    expect(droppedUnknown).toEqual([]); // a known code with a bad unit isn't "unknown"
    expect(droppedInvalid).toBe(1);
  });

  it("keeps the good readings in a mixed batch, dropping only the malformed one (non-finite value)", () => {
    const { extracted, droppedInvalid } = validateExtraction(
      {
        values: [
          { code: "ferritin", value: 41, unit: "µg/L", confidence: 0.97 },
          { code: "apob", value: Infinity, unit: "g/L", confidence: 0.99 },
        ],
      },
      catalog
    );

    expect(extracted.map((v) => v.code)).toEqual(["ferritin"]);
    expect(droppedInvalid).toBe(1);
  });

  it("does not let a wrong-typed element make the shell reject the whole array", () => {
    const { extracted, droppedInvalid } = validateExtraction(
      {
        values: [
          { code: "apob", value: 0.95, unit: "g/L", confidence: 0.99 },
          { code: "ferritin", value: "45", unit: "µg/L", confidence: 0.9 }, // value is a string
        ],
      },
      catalog
    );

    expect(extracted.map((v) => v.code)).toEqual(["apob"]);
    expect(droppedInvalid).toBe(1);
  });

  it("drops a reading whose alternatives carry a non-finite candidate", () => {
    const { extracted, droppedInvalid } = validateExtraction(
      {
        values: [
          {
            code: "ferritin",
            value: 41,
            unit: "µg/L",
            confidence: 0.55,
            alternatives: [41, Infinity],
          },
        ],
      },
      catalog
    );

    expect(extracted).toEqual([]);
    expect(droppedInvalid).toBe(1);
  });

  describe("confidence robustness", () => {
    const one = (confidence: unknown) =>
      validateExtraction(
        { values: [{ code: "apob", value: 0.95, unit: "g/L", confidence }] },
        catalog
      ).extracted;

    it("clamps a slightly-over-1 confidence to 1 and leaves it unflagged", () => {
      const [v] = one(1.05);
      expect(v.confidence).toBe(1);
      expect(v.flagged).toBe(false);
    });

    it("clamps a negative confidence to 0 and flags it", () => {
      const [v] = one(-0.1);
      expect(v.confidence).toBe(0);
      expect(v.flagged).toBe(true);
    });

    it("keeps but flags a NaN confidence (never guesses)", () => {
      const [v] = one(NaN);
      expect(v).toBeDefined();
      expect(v.flagged).toBe(true);
    });

    it("keeps but flags an Infinity confidence", () => {
      const [v] = one(Infinity);
      expect(v).toBeDefined();
      expect(v.flagged).toBe(true);
    });

    it("keeps but flags a reading whose confidence is missing (forces review)", () => {
      const { extracted } = validateExtraction(
        { values: [{ code: "apob", value: 0.95, unit: "g/L" }] },
        catalog
      );
      expect(extracted).toHaveLength(1);
      expect(extracted[0].flagged).toBe(true);
    });
  });

  describe("unit normalization", () => {
    it("accepts the Greek mu variant (μg/L, U+03BC) and stores the canonical µg/L", () => {
      const { extracted } = validateExtraction(
        { values: [{ code: "ferritin", value: 41, unit: "μg/L", confidence: 0.97 }] },
        catalog
      );
      expect(extracted).toHaveLength(1);
      expect(extracted[0].unit).toBe("µg/L"); // canonical micro sign (U+00B5)
    });

    it("accepts the ASCII ug/L variant and stores the canonical µg/L", () => {
      const { extracted } = validateExtraction(
        { values: [{ code: "ferritin", value: 41, unit: "ug/L", confidence: 0.97 }] },
        catalog
      );
      expect(extracted).toHaveLength(1);
      expect(extracted[0].unit).toBe("µg/L");
    });
  });

  it("returns empty (never throws) on empty or garbage input", () => {
    const garbage: unknown[] = [
      undefined,
      null,
      42,
      "not-json",
      {},
      { values: [] },
      { values: "nonsense" },
      { values: [{ code: "ferritin" }] }, // missing value/unit
      { values: [{ code: "ferritin", value: Infinity, unit: "µg/L" }] }, // non-finite value
    ];

    for (const bad of garbage) {
      const result = validateExtraction(bad, catalog);
      expect(result.extracted).toEqual([]);
      expect(result.droppedUnknown).toEqual([]);
      expect(typeof result.droppedInvalid).toBe("number");
    }
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
