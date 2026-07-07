/**
 * Unit tests for the REAL Bedrock bloodwork OCR vendor — the composition of the
 * (separately tested) vision transport, the clinical-language output guard, and
 * the catalog-bounded validator into one `extract(media)` method.
 *
 * This suite does NOT re-test parse/validate/guard internals (they have their
 * own suites). It proves the COMPOSITION and its safety-critical ordering:
 *  - golden: a clean image yields catalog-bounded extracted values.
 *  - the clinical-language GUARD runs on the FULL raw text BEFORE any JSON parse,
 *    so a leaked diagnosis rejects the whole extraction (empty result).
 *  - every failure path (transport null, non-JSON prose) fails safe → empty.
 *  - JSON wrapped in prose/markdown fences is recovered via a braces fallback.
 *  - the PDF media path composes identically.
 *  - validateExtraction signals (droppedUnknown / flagged / droppedInvalid)
 *    propagate through unchanged.
 *
 * The transport is exercised through a fake `messages.create` (vi.fn), so the
 * vendor's own composition — not the network — is under test.
 */
import { describe, expect, it, vi } from "vitest";
import type { VisionClient } from "@/lib/ai/transports/bedrock-vision";
import { CANONICAL_BIOMARKER_RULES } from "@/lib/biomarker-rules";
import {
  catalogFromRules,
  type CatalogRule,
} from "@/lib/ai/bloodwork-extraction-schema";
import { createBedrockExtractionVendor } from "@/lib/vendors/ai-extraction.bedrock";

const catalog: CatalogRule[] = catalogFromRules(CANONICAL_BIOMARKER_RULES);
const MODEL_ID = "eu.anthropic.claude-haiku-4-5-20251001-v1:0";

const IMAGE = { mime: "image/jpeg", base64: "aW1hZ2UtYnl0ZXM=" };
const PDF = { mime: "application/pdf", base64: "cGRmLWJ5dGVz" };

/**
 * A fake vision client whose `messages.create` returns a single text block
 * carrying `text`. Cast to `VisionClient` — the vendor only reads the first
 * text block, so a minimal Message shape is sufficient.
 */
function clientReturning(text: string) {
  const create = vi.fn().mockResolvedValue({ content: [{ type: "text", text }] });
  const client = { messages: { create } } as unknown as VisionClient;
  return { client, create };
}

/** A fake client whose transport call rejects (network/timeout failure). */
function clientRejecting() {
  const create = vi.fn().mockRejectedValue(new Error("bedrock exploded"));
  const client = { messages: { create } } as unknown as VisionClient;
  return { client, create };
}

function makeVendor(client: VisionClient) {
  return createBedrockExtractionVendor({ client, modelId: MODEL_ID, catalog });
}

describe("createBedrockExtractionVendor().extract", () => {
  it("extracts catalog-bounded values from a clean image (golden path)", async () => {
    const { client, create } = clientReturning(
      JSON.stringify({
        values: [
          { code: "ferritin", value: 41, unit: "µg/L", confidence: 0.97 },
          { code: "apob", value: 0.95, unit: "g/L", confidence: 0.96 },
          { code: "hdl_c", value: 1.3, unit: "mmol/L", confidence: 0.95 },
        ],
      })
    );

    const result = await makeVendor(client).extract(IMAGE);

    expect(result.droppedUnknown).toEqual([]);
    expect(result.droppedInvalid).toBe(0);
    expect(result.extracted.map((v) => v.code)).toEqual(["ferritin", "apob", "hdl_c"]);
    expect(result.extracted[0]).toMatchObject({
      code: "ferritin",
      name: "Ferritin", // canonical, from the catalog
      unit: "µg/L",
      value: 41,
      flagged: false,
    });
    // The transport was called once with the injected model id.
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0]).toMatchObject({ model: MODEL_ID });
  });

  it("returns an empty result with no fabrication when the model finds no values", async () => {
    const { client } = clientReturning(JSON.stringify({ values: [] }));

    const result = await makeVendor(client).extract(IMAGE);

    expect(result).toEqual({ extracted: [], droppedUnknown: [], droppedInvalid: 0 });
  });

  it("rejects the WHOLE extraction when clinical language leaks, before parsing (guard-first)", async () => {
    // Well-formed values AND a diagnostic sentence in the same raw text. The
    // guard must run on the full text before the JSON parse, so nothing is
    // surfaced — proving the guard-before-parse ordering.
    const { client } = clientReturning(
      'You may have anaemia. {"values":[{"code":"ferritin","value":41,"unit":"µg/L","confidence":0.97}]}'
    );

    const result = await makeVendor(client).extract(IMAGE);

    expect(result).toEqual({ extracted: [], droppedUnknown: [], droppedInvalid: 0 });
  });

  it("fails safe to an empty result when the transport fails (client rejects)", async () => {
    const { client } = clientRejecting();

    const result = await makeVendor(client).extract(IMAGE);

    expect(result).toEqual({ extracted: [], droppedUnknown: [], droppedInvalid: 0 });
  });

  it("fails safe to an empty result on non-JSON prose", async () => {
    const { client } = clientReturning("I could not read this document at all.");

    const result = await makeVendor(client).extract(IMAGE);

    expect(result).toEqual({ extracted: [], droppedUnknown: [], droppedInvalid: 0 });
  });

  it("recovers JSON wrapped in prose / markdown fences via the braces fallback (no clinical language)", async () => {
    const { client } = clientReturning(
      "Here are the transcribed values:\n```json\n" +
        JSON.stringify({
          values: [{ code: "ferritin", value: 41, unit: "µg/L", confidence: 0.97 }],
        }) +
        "\n```\nThat is everything printed on the page."
    );

    const result = await makeVendor(client).extract(IMAGE);

    expect(result.extracted.map((v) => v.code)).toEqual(["ferritin"]);
    expect(result.extracted[0]).toMatchObject({ unit: "µg/L", value: 41, flagged: false });
  });

  it("composes identically for a PDF media path", async () => {
    const { client, create } = clientReturning(
      JSON.stringify({
        values: [{ code: "apob", value: 0.95, unit: "g/L", confidence: 0.96 }],
      })
    );

    const result = await makeVendor(client).extract(PDF);

    expect(result.extracted.map((v) => v.code)).toEqual(["apob"]);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("propagates validateExtraction signals: unknown codes, flagged reads, droppedInvalid", async () => {
    const { client } = clientReturning(
      JSON.stringify({
        values: [
          { code: "unobtanium", value: 3.2, unit: "mg/L", confidence: 0.99 }, // unknown
          { code: "ferritin", value: 41, unit: "µg/L", confidence: 0.55, alternatives: [41, 47] }, // low-confidence
          { code: "ferritin", value: 41, unit: "mg/L", confidence: 0.99 }, // known code, bad unit → invalid
        ],
      })
    );

    const result = await makeVendor(client).extract(IMAGE);

    expect(result.droppedUnknown).toEqual(["unobtanium"]);
    expect(result.droppedInvalid).toBe(1);
    expect(result.extracted.map((v) => v.code)).toEqual(["ferritin"]);
    expect(result.extracted[0].flagged).toBe(true);
    expect(result.extracted[0].alternatives).toEqual([41, 47]);
  });
});
