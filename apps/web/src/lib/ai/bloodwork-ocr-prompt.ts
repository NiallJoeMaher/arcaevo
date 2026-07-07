/**
 * Scope-locked OCR prompt + clinical-language output guard (pure, no I/O).
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
 * CONSISTENCY WITH THE NARRATION GUARD (deliberate): the forbidden vocabulary
 * here is aligned to the narration guardrail in
 * `vendors/ai-narration.bedrock.ts` (`sanitizeNarration`, which rejects
 * /(diagnos|disease|prescri|medicat|treatment)/i) and the forbidden-word list
 * baked into `NARRATION_SYSTEM_PROMPT` in `vendors/ai-narration.ts`
 * (diagnosis/diagnose/disease/prescribe/prescription/medication/treatment).
 * The narration guard exposes NO shareable clinical-term list (its regex is
 * inline in `sanitizeNarration`; the words are hardcoded strings in the
 * prompt), so a clean DRY reuse would require refactoring narration — that is
 * Task 8 (narration light-refactor onto a shared shape). Until then this keeps
 * an INDEPENDENT but vocabulary-aligned regex, a superset of the narration
 * terms (adds the OCR-specific leaks: deficiency, anaemia/anemia, "consult a
 * doctor", "you may/might have"). TODO(Task 8): consolidate onto one shared
 * clinical-term guard so narration + OCR can never drift apart.
 */

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

/**
 * OUTPUT GUARD — returns true if the text leaks clinical/diagnostic language.
 *
 * Vocabulary is aligned to (and a superset of) the narration guard:
 *   - narration `sanitizeNarration`: diagnos | disease | prescri | medicat | treatment
 *   - OCR-specific leaks: deficien(cy|t) | anaemia/anemia | consult a doctor |
 *     you may/might have.
 *
 * Deliberately word-scoped (\b … token boundaries) so legitimate transcription
 * — marker codes (ferritin, apob, hdl_c), values, units (µg/L, g/L, mmol/L),
 * and the plain words "value"/"reading"/"alternative" — never trips it.
 */
const CLINICAL_LANGUAGE =
  /\b(diagnos\w*|disease|anaemi\w*|anemi\w*|deficien\w*|medicat\w*|treat(?:ment|ing|s|ed)?|prescri\w*|dosage|consult (?:a|your) doctor|you (?:may|might) have)\b/i;

export function containsClinicalLanguage(text: string): boolean {
  return CLINICAL_LANGUAGE.test(text);
}
