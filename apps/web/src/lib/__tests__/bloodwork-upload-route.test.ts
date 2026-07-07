/**
 * POST /api/v1/uploads/bloodwork × real-OCR wiring (mocked db + consent guard +
 * extraction factory, insights-narration-route.test.ts style). Proves:
 *
 *  - creds + media + photo → the real vendor runs; its ValidationResult is
 *    mapped into the persisted `extracted[]` + confirm payload (flagged carried,
 *    `unreadableCount` surfaced), sourceName ← fileName, documentDate null;
 *  - a vendor read the validator flagged but could not attach a trusted
 *    confidence to is still BLOCKED at confirm (persisted confidence < threshold);
 *  - an EMPTY vendor result → honest `manualEntryRequired`, nothing persisted;
 *  - Art.9: the base64 media is NEVER persisted (no raw-image field) or logged;
 *  - NO creds (factory null) → the mock/manual path is byte-shape unchanged
 *    (no `unreadableCount` key) — e2e parity;
 *  - vendor present but NO media bytes → mock path (vendor never invoked);
 *  - oversize media → 400 before any handler work.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Doc = { _id: string; [k: string]: unknown };

class FakeCollection {
  docs: Doc[] = [];
  async insertOne(doc: Doc) {
    this.docs.push(doc);
    return { insertedId: doc._id };
  }
}

const store: Record<string, FakeCollection> = {};
function col(name: string): FakeCollection {
  return (store[name] ??= new FakeCollection());
}

vi.mock("@/lib/db", () => ({
  PRIMARY_READ: { readPreference: "primary" },
  collections: { bloodworkUploads: async () => col("bloodwork_uploads") },
}));

vi.mock("@/lib/consent-guard", () => ({
  requireConsentedMember: async () => ({ member: { _id: "mem_test" } }),
}));

const getVendor = vi.fn();
vi.mock("@/lib/ai-extraction", () => ({
  getExtractionVendor: () => getVendor(),
}));

import { POST } from "@/app/api/v1/uploads/bloodwork/route";

const SMALL_IMAGE_B64 = Buffer.from("PNGDATA").toString("base64");

function req(body: Record<string, unknown>) {
  return new Request("http://localhost/api/v1/uploads/bloodwork", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer x" },
    body: JSON.stringify(body),
  });
}

let errorSpy: ReturnType<typeof vi.spyOn>;
let logSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  for (const k of Object.keys(store)) delete store[k];
  getVendor.mockReset();
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("real-OCR path (creds + media)", () => {
  it("maps the vendor result into persisted extracted[] + confirm payload with unreadableCount", async () => {
    const extract = vi.fn().mockResolvedValue({
      extracted: [
        {
          code: "apob",
          name: "ApoB",
          unit: "g/L",
          value: 0.95,
          confidence: 0.96,
          alternatives: null,
          flagged: false,
        },
        {
          code: "ferritin",
          name: "Ferritin",
          unit: "µg/L",
          value: 41,
          confidence: 0.55,
          alternatives: [41, 47],
          flagged: true,
        },
      ],
      droppedUnknown: ["unobtanium"],
      droppedInvalid: 1,
    });
    getVendor.mockReturnValue({ extract });

    const res = await POST(
      req({
        kind: "photo",
        fileName: "labs.png",
        media: { mime: "image/png", base64: SMALL_IMAGE_B64 },
      })
    );

    expect(res.status).toBe(201);
    const body = await res.json();

    expect(extract).toHaveBeenCalledWith({ mime: "image/png", base64: SMALL_IMAGE_B64 });
    expect(body.markersFound).toBe(2);
    // 1 unknown code + 1 invalid reading couldn't be read.
    expect(body.unreadableCount).toBe(2);
    expect(body.sourceName).toBe("labs.png"); // no OCR of source → fileName
    expect(body.documentDate).toBeNull(); // no OCR of date → member sets at confirm
    expect(body.flagged.map((f: { code: string }) => f.code)).toEqual(["ferritin"]);
    expect(body.flagged[0].question).toContain("41");
    expect(body.flagged[0].question).toContain("47");
    expect(
      body.values.find((v: { code: string }) => v.code === "ferritin").lowConfidence
    ).toBe(true);

    // Persisted doc carries the validated numeric readings only.
    const doc = col("bloodwork_uploads").docs[0];
    expect(doc.status).toBe("pending_confirmation");
    expect((doc.extracted as unknown[]).length).toBe(2);
    expect((doc.extracted as Array<{ code: string; confidence: number }>)[1]).toMatchObject({
      code: "ferritin",
      confidence: 0.55,
    });

    // Art.9: the base64 media never lands in Mongo and is never logged.
    expect(doc.media).toBeUndefined();
    const serialized = JSON.stringify(doc);
    expect(serialized).not.toContain(SMALL_IMAGE_B64);
    const allLogs = [...errorSpy.mock.calls, ...logSpy.mock.calls]
      .flat()
      .map((a) => String(a))
      .join(" ");
    expect(allLogs).not.toContain(SMALL_IMAGE_B64);
  });

  it("blocks a flagged read whose confidence the validator could not trust (persist < threshold)", async () => {
    const extract = vi.fn().mockResolvedValue({
      // validateExtraction sets confidence=1 + flagged=true when it cannot trust
      // the model's confidence. That MUST still block at confirm.
      extracted: [
        {
          code: "apob",
          name: "ApoB",
          unit: "g/L",
          value: 0.95,
          confidence: 1,
          alternatives: null,
          flagged: true,
        },
      ],
      droppedUnknown: [],
      droppedInvalid: 0,
    });
    getVendor.mockReturnValue({ extract });

    const res = await POST(
      req({
        kind: "photo",
        fileName: "labs.png",
        media: { mime: "image/png", base64: SMALL_IMAGE_B64 },
      })
    );
    const body = await res.json();

    expect(body.flagged.map((f: { code: string }) => f.code)).toEqual(["apob"]);
    const doc = col("bloodwork_uploads").docs[0];
    const persisted = (doc.extracted as Array<{ confidence: number }>)[0];
    expect(persisted.confidence).toBeLessThan(0.9);
  });

  it("vendor.extract THROWING degrades to manual entry (never a 500)", async () => {
    // The vendor is documented never-throw, but a future regression must still
    // fail safe: the member sees manual entry, not a 500 mid-upload.
    const extract = vi.fn().mockRejectedValue(new Error("transport regression"));
    getVendor.mockReturnValue({ extract });

    const res = await POST(
      req({
        kind: "photo",
        fileName: "labs.png",
        media: { mime: "image/png", base64: SMALL_IMAGE_B64 },
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.manualEntryRequired).toBe(true);
    expect(body.values).toEqual([]);
    expect(col("bloodwork_uploads").docs).toHaveLength(0);
  });

  it("EMPTY vendor result → honest manualEntryRequired, nothing persisted", async () => {
    const extract = vi.fn().mockResolvedValue({
      extracted: [],
      droppedUnknown: ["x", "y"],
      droppedInvalid: 0,
    });
    getVendor.mockReturnValue({ extract });

    const res = await POST(
      req({
        kind: "photo",
        fileName: "labs.png",
        media: { mime: "image/png", base64: SMALL_IMAGE_B64 },
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.manualEntryRequired).toBe(true);
    expect(body.values).toEqual([]);
    expect(body.unreadableCount).toBe(2);
    expect(col("bloodwork_uploads").docs).toHaveLength(0);
  });
});

describe("mock/manual parity (no creds)", () => {
  it("no vendor + photo + fileName → mock path, NO unreadableCount key", async () => {
    getVendor.mockReturnValue(null);

    const res = await POST(req({ kind: "photo", fileName: "scan.jpg" }));
    expect(res.status).toBe(201);
    const body = await res.json();

    expect("unreadableCount" in body).toBe(false); // mock response unchanged
    expect(typeof body.documentDate).toBe("string"); // mock reads a date
    expect(body.markersFound).toBeGreaterThan(0);
    expect(col("bloodwork_uploads").docs).toHaveLength(1);
  });

  it("vendor present but NO media → mock path, vendor never invoked", async () => {
    const extract = vi.fn();
    getVendor.mockReturnValue({ extract });

    const res = await POST(req({ kind: "photo", fileName: "scan.jpg" }));
    expect(res.status).toBe(201);
    expect(extract).not.toHaveBeenCalled();
    // The route never even asks for a vendor without media bytes.
    expect(getVendor).not.toHaveBeenCalled();
  });

  it("manual entry still persists confidence-1 values", async () => {
    getVendor.mockReturnValue(null);
    const res = await POST(
      req({ kind: "manual", manualValues: [{ code: "apob", value: 0.9, unit: "g/L" }] })
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.markersFound).toBe(1);
    expect("unreadableCount" in body).toBe(false);
  });

  it("kind:manual carrying a media field ignores it: no vendor, no base64 persisted", async () => {
    const extract = vi.fn();
    getVendor.mockReturnValue({ extract });

    const res = await POST(
      req({
        kind: "manual",
        manualValues: [{ code: "apob", value: 0.9, unit: "g/L" }],
        media: { mime: "image/png", base64: SMALL_IMAGE_B64 },
      })
    );

    expect(res.status).toBe(201);
    // The manual path never touches the real vendor / factory.
    expect(getVendor).not.toHaveBeenCalled();
    expect(extract).not.toHaveBeenCalled();
    // Art.9: the ignored media never lands in Mongo.
    const doc = col("bloodwork_uploads").docs[0];
    expect(doc.media).toBeUndefined();
    expect(JSON.stringify(doc)).not.toContain(SMALL_IMAGE_B64);
  });
});

describe("body limits", () => {
  it("oversize media → 400 before any work", async () => {
    // Just over 3 MiB decoded → base64 well over the cap.
    const oversize = "A".repeat(Math.ceil((3 * 1024 * 1024 + 4096) / 3) * 4);
    const res = await POST(
      req({
        kind: "photo",
        fileName: "huge.png",
        media: { mime: "image/png", base64: oversize },
      })
    );
    expect(res.status).toBe(400);
    expect(col("bloodwork_uploads").docs).toHaveLength(0);
  });
});
