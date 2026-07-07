/**
 * Real-OCR vendor SELECTION factory — the extraction twin of ai-narration.ts.
 * Routes import ONLY from here; the Bedrock vision vendor implementation
 * (vendors/ai-extraction.bedrock.ts) stays swappable behind this seam.
 *
 * ONE HARD INVARIANT — CREDENTIALS ARE THE SWITCH. The real OCR vendor is
 * selected whenever, and only when, the ARCAEVO_AWS_* key pair is present
 * (reusing narration's `resolveNarrationCredentials()` — no duplicated
 * credential logic). No keys → `getExtractionVendor()` is null and the upload
 * route keeps its EXISTING mock/manual behaviour untouched (dev/e2e/CI have no
 * keys, so they exercise the deterministic mock exactly as before).
 *
 * FAIL-SAFE: any construction problem (bad SDK import, throwing constructor,
 * missing creds) resolves to null — this factory NEVER throws. A null vendor
 * routes the member to safe manual entry; it never fabricates health data.
 *
 * Art.9 (health data): nothing here touches media bytes or model output — it
 * only builds the client. There is deliberately no logging in this module.
 */
import { AnthropicBedrockMantle } from "@anthropic-ai/bedrock-sdk";
import { CANONICAL_BIOMARKER_RULES } from "@/lib/biomarker-rules";
import { catalogFromRules } from "@/lib/ai/bloodwork-extraction-schema";
import {
  narrationModelId,
  resolveNarrationCredentials,
} from "@/lib/vendors/ai-narration";
import {
  createBedrockExtractionVendor,
  type BedrockExtractionVendor,
} from "@/lib/vendors/ai-extraction.bedrock";

export type ExtractionVendorKind = "bedrock" | "off";

/**
 * Which extraction vendor the current environment selects (pure — safe to
 * unit-test). Mirrors narration: the ARCAEVO_AWS_* key pair IS the switch.
 */
export function selectedExtractionVendorKind(): ExtractionVendorKind {
  return resolveNarrationCredentials() ? "bedrock" : "off";
}

/**
 * Resolve the active real-OCR vendor at call time (env read each call). Returns
 * null when no creds are configured OR when the client can't be built — the
 * route then keeps its mock/manual path. NEVER throws.
 *
 * The model id + region reuse narration's resolvers so a single `BEDROCK_MODEL_ID`
 * / `ARCAEVO_AWS_REGION` config drives both features (EU Haiku profile,
 * eu-west-1 default). The marker catalog is the canonical biomarker rules, so
 * unknown codes are dropped, never invented.
 */
export function getExtractionVendor(): BedrockExtractionVendor | null {
  const creds = resolveNarrationCredentials();
  if (!creds) return null;
  try {
    // Built PER REQUEST, never memoised: creds may be rotating STS session
    // tokens (`sessionToken` is threaded through), so a cached client would pin
    // stale credentials and start failing after the token rotates.
    const client = new AnthropicBedrockMantle({
      awsRegion: creds.region,
      awsAccessKey: creds.accessKeyId,
      awsSecretAccessKey: creds.secretAccessKey,
      // STS temp creds only; undefined for the long-lived key pair (unchanged).
      awsSessionToken: creds.sessionToken,
      // We enforce our own single hard deadline in the transport; don't let the
      // SDK silently retry in the background on a possibly-frozen instance.
      maxRetries: 0,
    });
    return createBedrockExtractionVendor({
      client,
      modelId: narrationModelId(),
      catalog: catalogFromRules(CANONICAL_BIOMARKER_RULES),
    });
  } catch {
    // Bad SDK / construction failure → no real vendor (fail safe to manual).
    return null;
  }
}
