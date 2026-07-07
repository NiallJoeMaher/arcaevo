/**
 * SINGLE SOURCE OF TRUTH for the wellness-not-diagnosis clinical-language
 * safety vocabulary (pure, no I/O).
 *
 * Arcaevo is a WELLNESS product that must never diagnose. Two AI output guards
 * enforce that, and until now each carried its OWN copy of the forbidden
 * vocabulary and so could silently drift:
 *   - narration: `sanitizeNarration` in vendors/ai-narration.bedrock.ts
 *     (rewrites an insight template; rejected output → deterministic template);
 *   - bloodwork OCR: `containsClinicalLanguage` in ai/bloodwork-ocr-prompt.ts
 *     (transcribes a lab report; leaked clinical language → drop the extraction).
 * Both now import the guard from THIS module, so the base vocabulary can never
 * fork again (fulfils the former TODO(Task 8)).
 *
 * APPROACH — UNIFIED SUPERSET (verified). Narration was historically the
 * narrower guard (/(diagnos|disease|prescri|medicat|treatment)/i); OCR added
 * the leaks a transcription can produce (anaemia/anemia, deficiency, dosage,
 * "consult a/your doctor", "you may/might have"). We route BOTH guards through
 * the FULL superset (BASE ∪ OCR_EXTRAS): a stricter narration guard is strictly
 * safer for a never-diagnose product, and it keeps EVERY existing narration
 * test green with no edits (verified: ai-narration.test.ts +
 * ai-narration.bedrock.test.ts) because no legitimate narration fixture trips
 * the extra terms. There is therefore ONE guard, `containsClinicalLanguage`,
 * used by both call sites.
 *
 * Word-scoped (\b … token boundaries) so legitimate transcription — marker
 * codes (ferritin, apob, hdl_c), numeric values, units (µg/L, g/L, mmol/L) and
 * the plain words "value"/"reading"/"alternative" — never trips it.
 */

/**
 * BASE vocabulary — the clinical stems the narration guard has always
 * rejected. `\w*` / the treat-variation group make these leak-proof against
 * inflections (diagnosis/diagnose, prescribe/prescription, treating/treated).
 */
export const CLINICAL_BASE_TERMS: readonly string[] = [
  "diagnos\\w*",
  "disease",
  "prescri\\w*",
  "medicat\\w*",
  "treat(?:ment|ing|s|ed)?",
];

/**
 * OCR-EXTRA vocabulary — the interpretive leaks a lab-report transcription can
 * produce that the original narration list did not name. Additive on top of
 * BASE; the narration guard now also rejects these (see APPROACH above).
 */
export const CLINICAL_OCR_EXTRA_TERMS: readonly string[] = [
  "anaemi\\w*",
  "anemi\\w*",
  "deficien\\w*",
  "dosage",
  "consult (?:a|your) doctor",
  "you (?:may|might) have",
];

/**
 * The unified guard regex over BASE ∪ OCR_EXTRAS, whole-token scoped. Reordering
 * the alternation vs. the previous inline OCR literal is behaviour-preserving —
 * `.test()` is a boolean membership check, independent of alternative order.
 */
const CLINICAL_LANGUAGE = new RegExp(
  `\\b(${[...CLINICAL_BASE_TERMS, ...CLINICAL_OCR_EXTRA_TERMS].join("|")})\\b`,
  "i"
);

/**
 * OUTPUT GUARD — true if `text` leaks clinical/diagnostic language. Used by
 * BOTH the narration and OCR output guards; the shared vocabulary above is the
 * only place the safety terms live.
 */
export function containsClinicalLanguage(text: string): boolean {
  return CLINICAL_LANGUAGE.test(text);
}
