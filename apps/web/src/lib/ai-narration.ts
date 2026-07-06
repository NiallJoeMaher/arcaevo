/**
 * AI-narration selection factory + the fail-safe cache flow the insights
 * route calls. Mirrors the payments pattern (src/lib/vendors/stripe.ts):
 * routes import from HERE only; the vendor implementation is swappable.
 *
 * "Deterministic rules decide, AI narrates" — three hard invariants:
 *
 *  1. FAIL-SAFE OFF. Narration runs ONLY when AI_NARRATION_ENABLED is exactly
 *     "true" AND the ARCAEVO_AWS_* key pair is present (same fail-safe posture
 *     as BLOOD_TIERS_ENABLED). Otherwise `getNarrationVendor()` is null and
 *     the insights payload is byte-identical to today's template-only output.
 *
 *  2. NEVER BLOCKING. The insights GET does ONE indexed `_id $in` cache read
 *     (zero when the feature is off). A cache MISS never calls Bedrock
 *     inline — generation is enqueued fire-and-forget and the template ships;
 *     the narration appears from the next request onward. Any cache/vendor
 *     error degrades to templates + one logError line (never health values).
 *
 *  3. FLAGGED VALUES GO TO A CLINICIAN, NOT A CHATBOT. `isNarrationEligible`
 *     reuses the clinician-review watch rule (models.ts `isWatchMarker`):
 *     a worsened verdict, or a value outside the member's own band on the
 *     harmful side, is NEVER passed to the model. `resolveNarrations` also
 *     re-drops any "worsened" input defensively (belt and braces).
 */
import { collections } from "@/lib/db";
import { logError } from "@/lib/log";
import {
  isWatchMarker,
  type BaselineBand,
  type RcvVerdict,
  type RuleDirection,
} from "@/lib/models";
import {
  narrationCacheKey,
  narrationModelId,
  resolveNarrationCredentials,
  type NarrationInput,
  type NarrationVendor,
} from "@/lib/vendors/ai-narration";
import { bedrockNarrationVendor } from "@/lib/vendors/ai-narration.bedrock";

export type NarrationVendorKind = "bedrock" | "off";

/** Which vendor the current environment selects (pure — safe to unit-test). */
export function selectedNarrationVendorKind(): NarrationVendorKind {
  // Fail-safe: exactly "true" (BLOOD_TIERS_ENABLED convention), never auto-on.
  if (process.env.AI_NARRATION_ENABLED !== "true") return "off";
  if (!resolveNarrationCredentials()) return "off"; // needs ARCAEVO_AWS_* keys
  return "bedrock";
}

/**
 * Resolve the active narration vendor at call time (env read each call).
 * Null = feature off — templates only, zero extra work on the request.
 * There is deliberately NO mock narration vendor: dev/e2e/CI run with the
 * feature off and exercise the exact template path production users see.
 */
export function getNarrationVendor(): NarrationVendor | null {
  return selectedNarrationVendorKind() === "bedrock"
    ? bedrockNarrationVendor
    : null;
}

/**
 * THE guardrail filter — may this reading's insight be narrated at all?
 * Reuses the clinician-review watch rule: anything a reviewer would flag
 * (worsened beyond RCV, or outside the member's own band on the harmful
 * side) routes to a clinician, never to a chatbot. Unit-tested directly in
 * __tests__/ai-narration.test.ts.
 */
export function isNarrationEligible(
  reading: {
    value: number;
    baselineBand: BaselineBand | null | undefined;
    rcvVerdict: RcvVerdict | null | undefined;
  },
  direction: RuleDirection
): boolean {
  if (!reading.rcvVerdict) return false; // no verdict → nothing to narrate
  return !isWatchMarker(reading, direction);
}

/**
 * Per-runtime in-flight set so one serverless instance doesn't fire duplicate
 * Bedrock calls for the same cache key while a generation is pending. (Two
 * instances may still race; the $setOnInsert upsert makes that harmless.)
 */
const inFlight = new Set<string>();

/**
 * Cache-first narration resolution, aligned 1:1 with `inputs`:
 *
 *  - feature off / empty input → all null, no I/O at all;
 *  - cache HIT → the cached narration string;
 *  - cache MISS → null now + fire-and-forget generation for next time.
 *
 * Never throws; a failing cache read degrades to all-null (templates ship).
 */
export async function resolveNarrations(
  inputs: Array<NarrationInput | null>
): Promise<Array<string | null>> {
  const blank = inputs.map(() => null);
  const vendor = getNarrationVendor();
  if (!vendor || inputs.every((i) => i === null)) return blank;

  const modelId = narrationModelId();
  // Defense in depth: a flagged verdict never reaches the model even if a
  // future caller forgets the isNarrationEligible gate. This re-drop covers
  // only "worsened" — the primary route gate also drops harmful out-of-band
  // values, but inputs carry no baseline band, so this layer can't re-check
  // bands by design.
  const safe = inputs.map((i) => (i && i.verdict !== "worsened" ? i : null));
  const keys = safe.map((i) => (i ? narrationCacheKey(i, modelId) : null));

  let cached: Map<string, string>;
  try {
    const col = await collections.narrations();
    const docs = await col
      .find({ _id: { $in: keys.filter((k): k is string => k !== null) } })
      .toArray();
    cached = new Map(docs.map((d) => [d._id, d.text]));
  } catch (err) {
    logError("ai_narration.cache_read", err, { count: inputs.length });
    return blank; // fail-safe: templates only
  }

  safe.forEach((input, i) => {
    const key = keys[i];
    if (!input || !key || cached.has(key)) return;
    if (inFlight.has(key)) return;
    inFlight.add(key);
    // Fire-and-forget: NEVER awaited — the GET returns immediately with the
    // template; the narration lands in the cache for future requests.
    void generateAndCache(vendor, input, key, modelId)
      .catch((err) => logError("ai_narration.generate", err, { modelId }))
      .finally(() => inFlight.delete(key));
  });

  return keys.map((k) => (k && cached.get(k)) || null);
}

/** Background generation: vendor call (never throws) + idempotent upsert. */
async function generateAndCache(
  vendor: NarrationVendor,
  input: NarrationInput,
  key: string,
  modelId: string
): Promise<void> {
  const text = await vendor.narrate(input);
  if (!text) return; // vendor failed / guardrail rejected — template stands
  const col = await collections.narrations();
  await col.updateOne(
    { _id: key },
    { $setOnInsert: { text, modelId, createdAt: new Date() } },
    { upsert: true }
  );
}
