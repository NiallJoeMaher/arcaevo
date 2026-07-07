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
 * only builds the client. The ONLY thing ever logged is a non-sensitive WARNING
 * naming a misconfigured (non-EU) region — never any media/creds/PII.
 *
 * EU RESIDENCY IS FAIL-CLOSED: Art.9 health-data images must never leave the EU.
 * The region is not merely defaulted to eu-west-1 — it is checked against an EU
 * allowlist, and a non-EU region DISABLES OCR (returns null → the route degrades
 * to manual entry) rather than constructing a client that would call a non-EU
 * endpoint. A misconfig disables the feature; it never leaks data.
 */
import { AnthropicBedrock } from "@anthropic-ai/bedrock-sdk";
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
 * The AWS regions the real OCR vendor is ALLOWED to target — STRICTLY EU/EEA
 * MEMBER-STATE regions only. This is a fail-closed Art.9 data-residency
 * safeguard for special-category health data: a region outside this set
 * DISABLES OCR (→ manual entry) rather than shipping images to a non-EU/EEA
 * endpoint such as us-east-1.
 *
 * Deliberately EXCLUDED even though they are `eu-*` and hold EU adequacy
 * decisions: `eu-west-2` (London — UK) and `eu-central-2` (Zurich —
 * Switzerland). Neither is an EU/EEA member state; routing special-category
 * health data there is a SEPARATE, deliberate compliance decision, so they
 * fail closed here by default.
 */
export const EU_AWS_REGIONS: ReadonlySet<string> = new Set([
  "eu-west-1", // Ireland
  "eu-west-3", // Paris, France
  "eu-central-1", // Frankfurt, Germany
  "eu-north-1", // Stockholm, Sweden
  "eu-south-1", // Milan, Italy
  "eu-south-2", // Spain
]);

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
  // FAIL CLOSED (Art.9): a non-EU region must DISABLE OCR, never silently ship
  // health-data images outside the EU. Degrade to manual entry instead of
  // constructing a client that would call a non-EU endpoint. The warning names
  // ONLY the region — never creds/media/PII.
  if (!EU_AWS_REGIONS.has(creds.region)) {
    console.warn(
      `[ai-extraction] OCR disabled: AWS region "${creds.region}" is outside the EU allowlist (Art.9 health-data residency).`
    );
    return null;
  }
  try {
    // Built PER REQUEST, never memoised: creds may be rotating STS session
    // tokens (`sessionToken` is threaded through), so a cached client would pin
    // stale credentials and start failing after the token rotates.
    //
    // `AnthropicBedrock` (the default export) is the CLASSIC bedrock-runtime
    // InvokeModel client — the SAME path AI narration signs with these creds and
    // that the deployed ARCAEVO_AWS_* IAM keys are already permissioned for
    // (bedrock:InvokeModel on the Haiku EU inference profile). NOTE the classic
    // client's cred param is `awsSecretKey` (NOT the Mantle client's
    // `awsSecretAccessKey`) — see @anthropic-ai/bedrock-sdk client.d.ts.
    const client = new AnthropicBedrock({
      awsRegion: creds.region,
      awsAccessKey: creds.accessKeyId,
      awsSecretKey: creds.secretAccessKey,
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
