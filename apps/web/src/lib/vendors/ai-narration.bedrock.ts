/**
 * LIVE AI-narration vendor — Claude Haiku on Amazon Bedrock (EU region).
 *
 * No SDK is installed (repo dep ban — see docs/BUILD_STATE.md "Wanted deps":
 * the sanctioned client is `@anthropic-ai/bedrock-sdk`'s AnthropicBedrockMantle;
 * swap these internals when the ban lifts, no call sites change). So, exactly
 * like the Stripe LIVE vendor (stripe.live.ts), this talks to the REST API
 * directly with `fetch`, signed with the hand-rolled SigV4 signer
 * (src/lib/aws-sigv4.ts, node:crypto only):
 *
 *   POST https://bedrock-runtime.<region>.amazonaws.com/model/<modelId>/invoke
 *
 * (InvokeModel; the response body is the Anthropic Messages API shape.)
 * The model id contains `.` and `:` — it is encoded ONCE in the request path
 * (`:` → %3A) and the signer double-encodes it in the canonical path, per the
 * non-S3 SigV4 rule (vector-tested in __tests__/aws-sigv4.test.ts).
 *
 * FAIL-SAFE, NEVER BLOCKING: single attempt, 3s AbortController timeout, and
 * EVERY failure path (missing creds, HTTP error, timeout, bad JSON, guardrail
 * rejection) returns null — the caller ships the deterministic template
 * instead. `narrate` never throws. Nothing from the request/response payload
 * is ever logged (Art.9 health values) — logError gets status codes and the
 * model id only. The IAM secret exists only inside the HMAC chain.
 */
import { logError } from "@/lib/log";
import { containsClinicalLanguage } from "@/lib/ai/clinical-language";
import { sha256Hex, signAwsRequestV4 } from "@/lib/aws-sigv4";
import {
  NARRATION_SYSTEM_PROMPT,
  buildNarrationUserMessage,
  narrationModelId,
  resolveNarrationCredentials,
  type NarrationInput,
  type NarrationVendor,
} from "@/lib/vendors/ai-narration";

/** Hard request deadline — narration must never make the insights GET slow. */
export const BEDROCK_TIMEOUT_MS = 3_000;

/** Narration is 1–2 sentences; 300 tokens is generous headroom. */
const MAX_TOKENS = 300;

/** SigV4 service name for bedrock-runtime endpoints. */
const SERVICE = "bedrock";

/** Minimal Anthropic Messages API response shape we depend on. */
interface AnthropicMessagesResponse {
  content?: Array<{ type?: string; text?: string }>;
}

/**
 * Output guardrail (belt and braces on top of the system prompt): reject
 * empty, over-long, or medical-language outputs. Rejection = null = the
 * deterministic template ships. Exported for the unit tests.
 *
 * The clinical-language check routes through the SINGLE shared guard in
 * `ai/clinical-language.ts` — the same guard the bloodwork OCR output uses — so
 * the wellness-not-diagnosis vocabulary can never drift between the two.
 */
export function sanitizeNarration(raw: string | undefined | null): string | null {
  const text = raw?.trim() ?? "";
  if (text.length === 0 || text.length > 600) return null;
  if (containsClinicalLanguage(text)) return null;
  return text;
}

class BedrockNarration implements NarrationVendor {
  async narrate(input: NarrationInput): Promise<string | null> {
    const creds = resolveNarrationCredentials();
    if (!creds) return null; // factory shouldn't select LIVE without creds — fail safe anyway
    const modelId = narrationModelId();

    const host = `bedrock-runtime.${creds.region}.amazonaws.com`;
    // Request path: model id percent-encoded ONCE (`:` → %3A, `.` stays).
    const path = `/model/${encodeURIComponent(modelId)}/invoke`;
    const body = JSON.stringify({
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: MAX_TOKENS,
      // No temperature/top_p — defaults are fine for a 1–2 sentence rewrite.
      system: NARRATION_SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildNarrationUserMessage(input) }],
    });

    const signed = signAwsRequestV4({
      method: "POST",
      host,
      path,
      region: creds.region,
      service: SERVICE,
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        "x-amz-content-sha256": sha256Hex(body),
      },
      body,
      accessKeyId: creds.accessKeyId,
      secretAccessKey: creds.secretAccessKey,
      // STS temp creds only (ARCAEVO_AWS_SESSION_TOKEN); undefined for the
      // long-lived key pair, in which case the request is unchanged.
      sessionToken: creds.sessionToken,
    });

    // Single attempt, hard 3s deadline, null on ANY failure.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), BEDROCK_TIMEOUT_MS);
    try {
      const res = await fetch(`https://${host}${path}`, {
        method: "POST",
        headers: signed.headers,
        body,
        signal: controller.signal,
      });
      if (!res.ok) {
        // Never log the response body — surface only the status + model id.
        logError(
          "ai_narration.bedrock",
          new Error(`Bedrock InvokeModel HTTP ${res.status}`),
          { modelId, status: res.status }
        );
        return null;
      }
      const json = (await res.json()) as AnthropicMessagesResponse;
      const text = (json.content ?? [])
        .filter((b) => b.type === "text" && typeof b.text === "string")
        .map((b) => b.text)
        .join("")
        .trim();
      return sanitizeNarration(text);
    } catch (err) {
      // Timeout (AbortError), network failure, or invalid JSON. No payload
      // contents in the log line — model id only.
      logError("ai_narration.bedrock", err, { modelId });
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
}

export const bedrockNarrationVendor: NarrationVendor = new BedrockNarration();
