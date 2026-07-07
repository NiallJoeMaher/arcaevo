/**
 * Bedrock VISION transport — a thin, DI-mockable wrapper over the sanctioned
 * `AnthropicBedrock` client (`@anthropic-ai/bedrock-sdk`, un-banned in Task 1):
 * the CLASSIC bedrock-runtime **InvokeModel** path, the same one AI narration
 * already signs with the ARCAEVO_AWS_* keys. It sends a lab-report image OR PDF
 * to Claude Haiku on Bedrock and returns the model's raw text response (a JSON
 * string) — or `null`.
 *
 * DELIBERATELY DUMB. It builds one `image` or `document` content block plus a
 * short user extraction instruction, passes the caller's `model` and `system`
 * through, calls the model, and returns the response's first text-block text.
 * It does NOT parse the JSON, validate against the marker catalog, or run the
 * clinical-language guard — that composition happens in Task 5 (the vendor
 * behind `extractBloodwork`). Do not import the schema/guard here.
 *
 * FAIL-SAFE: EVERY error path — the client throwing or rejecting, the hard
 * timeout firing, or a missing/malformed text block — returns `null`. That null
 * is the fail-safe that routes the member to manual entry, so this function
 * must NEVER throw into its caller.
 *
 * Art.9 (health data): the media base64 and the model response are NEVER logged
 * here — there is no logging at all in this module. Keep it that way.
 *
 * Structured output: we use FREE-TEXT JSON returned as a normal text block (the
 * simplest mechanism, and Task 5 zod-validates the string regardless). We do
 * NOT set `output_config.format` — Haiku-on-Bedrock structured-output adherence
 * is unverified from the claude-api skill, and the return contract (raw JSON
 * text, validated downstream) would be unchanged even if we did. The InvokeModel
 * transport + this model id are already proven by narration (live-verified
 * 2026-07-06); the only item left to confirm on real reports during the live
 * smoke test (Task 10) is free-text JSON reliability, before considering
 * `output_config.format`.
 *
 * Timeout: the deadline is BOTH forwarded to the SDK call options (`{ timeout }`
 * — milliseconds in the TS SDK) AND enforced by a local race, because the SDK's
 * own timeout is retried (wall-clock can reach timeout × (maxRetries+1)) and an
 * injected/stalled client might never settle. The race guarantees a hard,
 * single deadline for the caller. We also pass `maxRetries: 0`: once the race
 * deadline wins we abandon the request, and without this the SDK would keep
 * retrying in the background (default maxRetries=2 → up to timeoutMs×3 of wasted
 * network work on a possibly-frozen serverless instance).
 *
 * Model id: taken as the `modelId` PARAM — the factory/vendor supplies it
 * (Task 5/6). It is the EU Haiku inference profile
 * `eu.anthropic.claude-haiku-4-5-20251001-v1:0`, the SAME id narration invokes
 * over classic bedrock-runtime InvokeModel — the path this transport now uses
 * too (via `AnthropicBedrock`) — so its resolution is already proven; no open
 * model-id item remains.
 */
import type Anthropic from "@anthropic-ai/sdk";

/** The image/PDF bytes to transcribe: a MIME type and its base64 encoding. */
export type Media = { mime: string; base64: string };

/**
 * The minimal slice of `AnthropicBedrock` this transport needs. Typed against
 * the real SDK request/response types (not `any`) so the compiler checks the
 * call shape, while staying structural so a `vi.fn()` fake — or the real
 * `AnthropicBedrock` client — both satisfy it.
 */
export interface VisionClient {
  messages: {
    create(
      body: Anthropic.MessageCreateParamsNonStreaming,
      options?: Anthropic.RequestOptions
    ): Promise<Anthropic.Message>;
  };
}

export interface RunVisionExtractionArgs {
  client: VisionClient;
  modelId: string;
  system: string;
  media: Media;
  /** Hard deadline in milliseconds (TS SDK timeout unit). Defaults to 8s. */
  timeoutMs?: number;
}

/**
 * Generous headroom for the value list. A full ~17-marker panel with
 * `alternatives` arrays can approach ~1k tokens, so a tight ceiling risks silent
 * mid-JSON truncation on exactly the largest reports (which then fail Task 5's
 * parse and drop the whole panel to manual entry). Output tokens bill only for
 * what is generated, so the higher ceiling is near-free insurance.
 */
const MAX_TOKENS = 4096;

/**
 * The single user text block that pairs with the media block. Kept generic and
 * scope-neutral — the transcription scope-lock lives in the caller-supplied
 * `system` prompt (Task 3's `OCR_SYSTEM_PROMPT`), not here.
 */
const EXTRACTION_INSTRUCTION =
  "Extract the blood-test values as JSON: " +
  "{ values: [{ code, value, unit, confidence, alternatives? }] }.";

/** Sentinel resolved by the timeout race when the client outlives the deadline. */
const TIMEOUT = Symbol("bedrock-vision-timeout");

/**
 * Build the media content block: a base64 `document` for PDFs, otherwise a
 * base64 `image`. The image `media_type` is narrowed to the SDK's supported
 * union — the caller (Task 6) is responsible for only passing allowed MIME
 * types; this transport does not re-validate.
 */
function mediaBlock(
  media: Media
): Anthropic.ImageBlockParam | Anthropic.DocumentBlockParam {
  if (media.mime === "application/pdf") {
    return {
      type: "document",
      source: { type: "base64", media_type: "application/pdf", data: media.base64 },
    };
  }
  return {
    type: "image",
    source: {
      type: "base64",
      media_type: media.mime as Anthropic.Base64ImageSource["media_type"],
      data: media.base64,
    },
  };
}

/**
 * Send `media` to Claude on Bedrock and return the model's raw text response
 * (the JSON string), or `null` on ANY failure. Never throws.
 */
export async function runVisionExtraction({
  client,
  modelId,
  system,
  media,
  timeoutMs = 8000,
}: RunVisionExtractionArgs): Promise<string | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const deadline = new Promise<typeof TIMEOUT>((resolve) => {
      timer = setTimeout(() => resolve(TIMEOUT), timeoutMs);
    });

    const request = client.messages.create(
      {
        model: modelId,
        max_tokens: MAX_TOKENS,
        system,
        messages: [
          {
            role: "user",
            content: [mediaBlock(media), { type: "text", text: EXTRACTION_INSTRUCTION }],
          },
        ],
      },
      { timeout: timeoutMs, maxRetries: 0 }
    );

    // Relies on Promise.race semantics: if `deadline` wins, the losing (possibly
    // late-rejecting) `request` promise is swallowed by race's internal reaction
    // and does NOT surface as an unhandledRejection on Node/Vercel. A future
    // refactor away from Promise.race MUST preserve that, or it reintroduces an
    // unhandled-rejection leak.
    const result = await Promise.race([request, deadline]);
    if (result === TIMEOUT) return null;

    const text = result.content.find((block) => block.type === "text")?.text;
    return typeof text === "string" ? text : null;
  } catch {
    // Reject, synchronous throw, timeout-abort, or any other failure → null.
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
