/**
 * Bedrock vision transport (lib/ai/transports/bedrock-vision.ts) — the thin,
 * DI-mockable wrapper over AnthropicBedrockMantle's `messages.create`. All tests
 * use a FAKE injected client (a `vi.fn()` for `messages.create`), so nothing
 * here touches the network.
 *
 * The transport is deliberately DUMB: it builds an image OR pdf content block +
 * a user extraction instruction, passes `model`/`system` through, and returns
 * the response's text-block text (the raw JSON string) — or null on ANY failure
 * (throw/reject, timeout, missing/malformed text). JSON parsing, catalog
 * validation and the clinical guard all happen later (Task 5), never here.
 *
 * Behaviours proven:
 *  1. image media → an `image` base64 block + the extraction text; model/system
 *     pass through; timeout is forwarded to the SDK call options; returns text.
 *  2. application/pdf media → a `document` base64 block instead of an image.
 *  3. client throws / rejects → null (never throws into the caller).
 *  4. no text block / malformed response → null.
 *  5. a client that never resolves does not hang the caller (hard timeout → null).
 */
import { describe, expect, it, vi } from "vitest";
import { runVisionExtraction } from "@/lib/ai/transports/bedrock-vision";

const MODEL = "eu.anthropic.claude-haiku-4-5-20251001-v1:0";
const SYSTEM = "TRANSCRIBE-ONLY SYSTEM PROMPT SENTINEL";

/** Build a fake injected client whose `messages.create` is a vi.fn(). */
function fakeClient() {
  const create = vi.fn();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = { messages: { create } } as any;
  return { client, create };
}

/** A minimal Anthropic Messages response carrying a single text block. */
function textResponse(text: unknown) {
  return { content: [{ type: "text", text }] };
}

describe("runVisionExtraction — request shape", () => {
  it("sends an image base64 block + the extraction text and passes model/system through", async () => {
    const { client, create } = fakeClient();
    create.mockResolvedValueOnce(textResponse('{"values":[]}'));

    const out = await runVisionExtraction({
      client,
      modelId: MODEL,
      system: SYSTEM,
      media: { mime: "image/png", base64: "AAAAIMAGE" },
      timeoutMs: 5000,
    });

    expect(out).toBe('{"values":[]}');
    expect(create).toHaveBeenCalledTimes(1);

    const [body, options] = create.mock.calls[0];
    expect(body.model).toBe(MODEL);
    expect(body.system).toBe(SYSTEM);
    expect(body.max_tokens).toBe(1024);

    const content = body.messages[0].content;
    const image = content.find((b: { type: string }) => b.type === "image");
    expect(image.source).toEqual({
      type: "base64",
      media_type: "image/png",
      data: "AAAAIMAGE",
    });
    // No document block for an image, and the extraction instruction is present.
    expect(content.some((b: { type: string }) => b.type === "document")).toBe(false);
    expect(content.some((b: { type: string }) => b.type === "text")).toBe(true);

    // Behaviour 5 (a): the hard deadline is forwarded to the SDK call options.
    expect(options?.timeout).toBe(5000);
  });

  it("forwards a default timeout when timeoutMs is omitted", async () => {
    const { client, create } = fakeClient();
    create.mockResolvedValueOnce(textResponse("raw"));

    await runVisionExtraction({
      client,
      modelId: MODEL,
      system: SYSTEM,
      media: { mime: "image/jpeg", base64: "JJ" },
    });

    const [, options] = create.mock.calls[0];
    expect(typeof options?.timeout).toBe("number");
    expect(options.timeout).toBeGreaterThan(0);
  });

  it("sends a document base64 block (not an image) for application/pdf media", async () => {
    const { client, create } = fakeClient();
    create.mockResolvedValueOnce(textResponse("raw json"));

    const out = await runVisionExtraction({
      client,
      modelId: MODEL,
      system: SYSTEM,
      media: { mime: "application/pdf", base64: "JVBERIPDF" },
    });

    expect(out).toBe("raw json");

    const content = create.mock.calls[0][0].messages[0].content;
    const doc = content.find((b: { type: string }) => b.type === "document");
    expect(doc.source).toEqual({
      type: "base64",
      media_type: "application/pdf",
      data: "JVBERIPDF",
    });
    expect(content.some((b: { type: string }) => b.type === "image")).toBe(false);
    expect(content.some((b: { type: string }) => b.type === "text")).toBe(true);
  });
});

describe("runVisionExtraction — fail-safe null on every failure (never throws)", () => {
  it("returns null when the client rejects", async () => {
    const { client, create } = fakeClient();
    create.mockRejectedValueOnce(new Error("bedrock 500"));

    await expect(
      runVisionExtraction({
        client,
        modelId: MODEL,
        system: SYSTEM,
        media: { mime: "image/png", base64: "AAAA" },
      })
    ).resolves.toBeNull();
  });

  it("returns null when the client throws synchronously", async () => {
    const { client, create } = fakeClient();
    create.mockImplementationOnce(() => {
      throw new Error("sync boom");
    });

    await expect(
      runVisionExtraction({
        client,
        modelId: MODEL,
        system: SYSTEM,
        media: { mime: "image/png", base64: "AAAA" },
      })
    ).resolves.toBeNull();
  });

  it("returns null when the response has no text block", async () => {
    const { client, create } = fakeClient();
    create.mockResolvedValueOnce({ content: [{ type: "image" }] });

    await expect(
      runVisionExtraction({
        client,
        modelId: MODEL,
        system: SYSTEM,
        media: { mime: "image/png", base64: "AAAA" },
      })
    ).resolves.toBeNull();
  });

  it("returns null on an empty / missing content array", async () => {
    for (const bad of [{ content: [] }, {}, null, undefined]) {
      const { client, create } = fakeClient();
      create.mockResolvedValueOnce(bad);
      await expect(
        runVisionExtraction({
          client,
          modelId: MODEL,
          system: SYSTEM,
          media: { mime: "image/png", base64: "AAAA" },
        })
      ).resolves.toBeNull();
    }
  });

  it("returns null when the text block's text is not a string", async () => {
    const { client, create } = fakeClient();
    create.mockResolvedValueOnce(textResponse(1234));

    await expect(
      runVisionExtraction({
        client,
        modelId: MODEL,
        system: SYSTEM,
        media: { mime: "image/png", base64: "AAAA" },
      })
    ).resolves.toBeNull();
  });
});

describe("runVisionExtraction — hard timeout", () => {
  it("does not hang on a client that never resolves; returns null", async () => {
    const { client, create } = fakeClient();
    // A create() that never settles — only the transport's own deadline can win.
    create.mockReturnValueOnce(new Promise(() => {}));

    await expect(
      runVisionExtraction({
        client,
        modelId: MODEL,
        system: SYSTEM,
        media: { mime: "image/png", base64: "AAAA" },
        timeoutMs: 20,
      })
    ).resolves.toBeNull();
  });
});
