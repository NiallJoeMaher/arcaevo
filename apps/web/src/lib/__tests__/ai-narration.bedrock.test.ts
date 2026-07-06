/**
 * LIVE Bedrock narration vendor (vendors/ai-narration.bedrock.ts) — all with
 * a mocked global fetch (no network, deterministic):
 *  - request shape: InvokeModel URL (single-encoded model id in the path),
 *    signed headers, anthropic_version body, guardrail system prompt;
 *  - success path parses the Anthropic Messages response shape;
 *  - EVERY failure (HTTP error, network throw, 3s timeout, junk JSON, missing
 *    creds) returns null and never throws — the template must always ship;
 *  - output guardrail rejects empty/medical-language completions.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  BEDROCK_TIMEOUT_MS,
  bedrockNarrationVendor,
  sanitizeNarration,
} from "@/lib/vendors/ai-narration.bedrock";
import type { NarrationInput } from "@/lib/vendors/ai-narration";

const INPUT: NarrationInput = {
  code: "apob",
  name: "ApoB",
  unit: "g/L",
  direction: "lower_is_better",
  verdict: "improved",
  priorValue: 1.2,
  currentValue: 1.0,
  deltaPct: 17,
  templateText: "Your ApoB moved 17% in the right direction…",
};

function messagesResponse(text: string) {
  return new Response(
    JSON.stringify({
      id: "msg_x",
      type: "message",
      role: "assistant",
      content: [{ type: "text", text }],
      stop_reason: "end_turn",
    }),
    { status: 200, headers: { "content-type": "application/json" } }
  );
}

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubEnv("ARCAEVO_AWS_ACCESS_KEY_ID", "AKIDEXAMPLE");
  vi.stubEnv("ARCAEVO_AWS_SECRET_ACCESS_KEY", "fake-secret");
  vi.stubEnv("ARCAEVO_AWS_REGION", "eu-west-1");
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {}); // logError lines
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("request shape", () => {
  it("POSTs a signed InvokeModel request with the encoded model id in the path", async () => {
    fetchMock.mockResolvedValueOnce(messagesResponse("Nice work — real progress."));
    const text = await bedrockNarrationVendor.narrate(INPUT);
    expect(text).toBe("Nice work — real progress.");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    // Default model id, single-encoded on the wire (':' → %3A, '.' kept).
    expect(url).toBe(
      "https://bedrock-runtime.eu-west-1.amazonaws.com/model/" +
        "eu.anthropic.claude-haiku-4-5-20251001-v1%3A0/invoke"
    );
    expect(init.method).toBe("POST");
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toMatch(
      /^AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE\/\d{8}\/eu-west-1\/bedrock\/aws4_request, SignedHeaders=/
    );
    expect(headers["content-type"]).toBe("application/json");

    const body = JSON.parse(String(init.body));
    expect(body.anthropic_version).toBe("bedrock-2023-05-31");
    expect(body.max_tokens).toBe(300);
    expect(body.temperature).toBeUndefined(); // defaults on purpose
    expect(body.system).toMatch(/wellness language only/i);
    expect(body.messages).toEqual([
      { role: "user", content: expect.stringContaining("Marker: ApoB (apob)") },
    ]);
  });

  it("honours a BEDROCK_MODEL_ID override in the URL", async () => {
    vi.stubEnv("BEDROCK_MODEL_ID", "anthropic.claude-haiku-4-5-20251001-v1:0");
    fetchMock.mockResolvedValueOnce(messagesResponse("ok text"));
    await bedrockNarrationVendor.narrate(INPUT);
    expect(String(fetchMock.mock.calls[0][0])).toContain(
      "/model/anthropic.claude-haiku-4-5-20251001-v1%3A0/invoke"
    );
  });
});

describe("fail-safe null on every failure path (never throws)", () => {
  it("returns null on a non-2xx response and logs status only", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response('{"message":"AccessDeniedException"}', { status: 403 })
    );
    await expect(bedrockNarrationVendor.narrate(INPUT)).resolves.toBeNull();
    const line = String((console.error as ReturnType<typeof vi.fn>).mock.calls[0][0]);
    expect(line).toContain("ai_narration.bedrock");
    expect(line).toContain("403");
    expect(line).not.toContain("ApoB"); // no payload contents in logs
  });

  it("returns null when fetch rejects (network failure)", async () => {
    fetchMock.mockRejectedValueOnce(new Error("socket hang up"));
    await expect(bedrockNarrationVendor.narrate(INPUT)).resolves.toBeNull();
  });

  it("returns null when the response body is not valid JSON", async () => {
    fetchMock.mockResolvedValueOnce(new Response("not-json", { status: 200 }));
    await expect(bedrockNarrationVendor.narrate(INPUT)).resolves.toBeNull();
  });

  it("returns null when the JSON lacks a text content block", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ content: [] }), { status: 200 })
    );
    await expect(bedrockNarrationVendor.narrate(INPUT)).resolves.toBeNull();
  });

  it("returns null when AWS creds are missing", async () => {
    vi.stubEnv("ARCAEVO_AWS_ACCESS_KEY_ID", "");
    vi.stubEnv("ARCAEVO_AWS_SECRET_ACCESS_KEY", "");
    await expect(bedrockNarrationVendor.narrate(INPUT)).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it(`aborts after ${BEDROCK_TIMEOUT_MS}ms (single attempt) and returns null`, async () => {
    vi.useFakeTimers();
    // A fetch that only settles when its abort signal fires.
    fetchMock.mockImplementationOnce(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener("abort", () =>
            reject(new DOMException("The operation was aborted.", "AbortError"))
          );
        })
    );
    const pending = bedrockNarrationVendor.narrate(INPUT);
    await vi.advanceTimersByTimeAsync(BEDROCK_TIMEOUT_MS);
    await expect(pending).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1); // no retry
  });
});

describe("sanitizeNarration() — output guardrail", () => {
  it("passes ordinary wellness copy through, trimmed", () => {
    expect(sanitizeNarration("  Great progress on your ApoB.  ")).toBe(
      "Great progress on your ApoB."
    );
  });

  it("rejects empty / whitespace-only output", () => {
    expect(sanitizeNarration("")).toBeNull();
    expect(sanitizeNarration("   ")).toBeNull();
    expect(sanitizeNarration(undefined)).toBeNull();
  });

  it("rejects medical/diagnosis language the prompt forbids", () => {
    for (const bad of [
      "This could be a diagnosis of something.",
      "You may have heart disease.",
      "Ask your GP to prescribe a statin.",
      "Consider medication changes.",
      "This treatment is working.",
    ]) {
      expect(sanitizeNarration(bad)).toBeNull();
    }
  });

  it("rejects runaway output (> 600 chars)", () => {
    expect(sanitizeNarration("x".repeat(601))).toBeNull();
  });
});
