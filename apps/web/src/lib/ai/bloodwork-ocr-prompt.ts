/**
 * Scope-locked OCR prompt (pure, no I/O).
 *
 * The bloodwork OCR step reads a lab-report image/PDF (GDPR Art.9 health data)
 * and must ONLY transcribe the printed result values — never interpret them.
 * This is a safety control for a WELLNESS product that must never diagnose:
 *
 *  - `OCR_SYSTEM_PROMPT` scope-locks the model to transcription and forbids
 *    interpretation/diagnosis/disease-naming/medication+treatment talk, and
 *    tells it to return NO values (rather than guess) when a value is
 *    unreadable or the document is not a blood-test report.
 *  - `containsClinicalLanguage` is the belt-and-braces OUTPUT guard: if the
 *    model output leaks clinical/diagnostic language it is rejected (the caller
 *    then drops the extraction rather than surface a diagnosis).
 *
 * The output guard is now the SINGLE shared clinical-language guard in
 * `ai/clinical-language.ts`, which the narration guardrail
 * (`vendors/ai-narration.bedrock.ts` `sanitizeNarration`) also routes through —
 * so the two safety vocabularies can never drift apart. `containsClinicalLanguage`
 * is re-exported here so OCR callers keep their existing import path unchanged.
 */

// The output guard lives in the shared clinical-language module so narration +
// OCR can never fork the safety vocabulary. Re-exported below for OCR callers.
export { containsClinicalLanguage } from "@/lib/ai/clinical-language";

/**
 * Scope-locked system prompt: TRANSCRIBE result values only. Written as joined
 * lines so the forbidden-scope instructions read as discrete rules.
 */
export const OCR_SYSTEM_PROMPT = [
  "You transcribe blood-test result values from an image or PDF of a lab report. You are an optical-character-recognition transcriber, not a clinician.",
  "For each printed result, return ONLY: the marker code, the numeric value, the unit, a confidence between 0 and 1, and up to two alternative readings when a digit is ambiguous (e.g. a 41 that could be 47).",
  "Do NOT interpret, diagnose, name any disease or medical condition, comment on whether a value is high, low or normal, or suggest any medication or treatment.",
  "Never use diagnostic or clinical language of any kind — you are copying numbers, not reading meaning into them.",
  "If a value is unreadable, or the document is not a blood-test report, return no values rather than guessing.",
].join("\n");
