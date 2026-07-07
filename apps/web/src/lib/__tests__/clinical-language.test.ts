/**
 * Single-source clinical-language safety vocabulary (src/lib/ai/clinical-language.ts).
 *
 * This is the ONE guard both the narration output guardrail
 * (vendors/ai-narration.bedrock.ts `sanitizeNarration`) and the bloodwork OCR
 * output guard (ai/bloodwork-ocr-prompt.ts `containsClinicalLanguage`) route
 * through, so the wellness-not-diagnosis vocabulary can never drift apart.
 *
 * These tests pin BEHAVIOUR, not regex internals:
 *  - every BASE term (the words narration has always rejected) is caught;
 *  - every OCR-EXTRA leak is caught;
 *  - realistic pure transcription (marker codes/values/units + the plain words
 *    "value"/"reading"/"alternative") never false-positives.
 */
import { describe, expect, it } from "vitest";
import {
  CLINICAL_BASE_TERMS,
  CLINICAL_OCR_EXTRA_TERMS,
  containsClinicalLanguage,
} from "@/lib/ai/clinical-language";

describe("containsClinicalLanguage — BASE vocabulary (narration + OCR share this)", () => {
  const baseLeaks = [
    "This could be a diagnosis of something.",
    "Please diagnose the cause.",
    "You may have heart disease.",
    "Ask your GP to prescribe a statin.",
    "We recommend a prescription.",
    "Consider medication changes.",
    "This treatment is working.",
    "The doctor is treating this.",
  ];
  for (const text of baseLeaks) {
    it(`flags base leak: ${text}`, () => {
      expect(containsClinicalLanguage(text)).toBe(true);
    });
  }
});

describe("containsClinicalLanguage — OCR-EXTRA vocabulary", () => {
  const extraLeaks = [
    "You might have a deficiency",
    "This suggests iron deficiency",
    "Your ferritin indicates anaemia",
    "Your ferritin indicates anemia",
    "Please consult a doctor about these results",
    "You should consult your doctor",
    "You may have anaemia",
    "You might have low iron",
    "Reduce the dosage",
  ];
  for (const text of extraLeaks) {
    it(`flags OCR-extra leak: ${text}`, () => {
      expect(containsClinicalLanguage(text)).toBe(true);
    });
  }
});

describe("containsClinicalLanguage — no false positives on pure transcription", () => {
  it("false for a single marker reading", () => {
    expect(containsClinicalLanguage("ferritin 45 µg/L")).toBe(false);
  });

  it("false for a realistic multi-marker transcription", () => {
    const transcription = [
      "ferritin value 45 µg/L confidence 0.98",
      "apob value 0.95 g/L confidence 0.99",
      "hdl_c reading 1.4 mmol/L confidence 0.97 alternative 1.1",
    ].join("\n");
    expect(containsClinicalLanguage(transcription)).toBe(false);
  });

  it("false for ordinary wellness copy", () => {
    expect(containsClinicalLanguage("Great progress on your ApoB.")).toBe(false);
  });

  it("false for empty string", () => {
    expect(containsClinicalLanguage("")).toBe(false);
  });
});

describe("exported vocabulary is documented + non-empty", () => {
  it("exposes the base and OCR-extra term lists", () => {
    expect(CLINICAL_BASE_TERMS.length).toBeGreaterThan(0);
    expect(CLINICAL_OCR_EXTRA_TERMS.length).toBeGreaterThan(0);
  });
});
