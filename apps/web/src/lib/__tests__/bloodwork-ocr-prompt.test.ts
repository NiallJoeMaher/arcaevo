/**
 * Scope-locked OCR prompt + clinical-language output guard (pure module).
 *
 * These tests pin BEHAVIOUR, not regex internals:
 *  - the system prompt is scope-locked to TRANSCRIPTION (transcribe + forbids
 *    interpretation/diagnosis + "return nothing rather than guess");
 *  - `containsClinicalLanguage` true-positives across the SAME forbidden
 *    vocabulary the narration guard rejects (this is a safety control — it must
 *    stay consistent with vendors/ai-narration guardrails);
 *  - it does NOT false-positive on a realistic multi-marker transcription
 *    string (real marker codes/values/units + the words "value"/"reading").
 */
import { describe, expect, it } from "vitest";
import {
  OCR_SYSTEM_PROMPT,
  containsClinicalLanguage,
} from "@/lib/ai/bloodwork-ocr-prompt";

describe("OCR_SYSTEM_PROMPT", () => {
  it("is scope-locked to transcription", () => {
    expect(OCR_SYSTEM_PROMPT.toLowerCase()).toContain("transcribe");
  });

  it("forbids interpretation / diagnosis", () => {
    expect(OCR_SYSTEM_PROMPT).toMatch(/do not (interpret|diagnos)/i);
  });

  it("instructs to return nothing rather than guess when unreadable", () => {
    expect(OCR_SYSTEM_PROMPT.toLowerCase()).toMatch(
      /(return no values|no values).*(rather than|instead of).*(guess)/i
    );
  });

  it("names the fields to transcribe (value, unit, confidence, alternatives)", () => {
    const p = OCR_SYSTEM_PROMPT.toLowerCase();
    expect(p).toContain("unit");
    expect(p).toContain("confidence");
    expect(p).toContain("alternative");
  });
});

describe("containsClinicalLanguage — true positives (aligned to narration guard vocab)", () => {
  const leaks = [
    "You may have anaemia, consult a doctor",
    "You might have a deficiency",
    "Consider medication to treat this",
    "This suggests a diagnosis of iron deficiency",
    "Signs of disease are present",
    "Your ferritin indicates anemia",
    "We recommend a prescription",
    "The doctor should prescribe iron",
    "This is a treatment plan",
    "Please consult a doctor about these results",
  ];
  for (const text of leaks) {
    it(`flags: ${text}`, () => {
      expect(containsClinicalLanguage(text)).toBe(true);
    });
  }
});

describe("containsClinicalLanguage — false on pure transcription", () => {
  it("false for a single marker reading", () => {
    expect(containsClinicalLanguage("ferritin 45 µg/L")).toBe(false);
  });

  it("false for a realistic multi-marker transcription (values + units + reading/value words)", () => {
    const transcription = [
      "ferritin value 45 µg/L confidence 0.98",
      "apob value 0.95 g/L confidence 0.99",
      "hdl_c reading 1.4 mmol/L confidence 0.97 alternative 1.1",
    ].join("\n");
    expect(containsClinicalLanguage(transcription)).toBe(false);
  });

  it("false for empty string", () => {
    expect(containsClinicalLanguage("")).toBe(false);
  });
});
