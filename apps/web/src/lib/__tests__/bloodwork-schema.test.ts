/**
 * Unit tests for the bloodwork input schemas — the `values`/`manualValues`
 * arrays are capped so a single request can't force an unbounded amount of
 * server-side work (DoS amplification: the confirm handler touches the DB per
 * distinct code).
 */
import { describe, expect, it } from "vitest";
import {
  BloodworkConfirmInput,
  BloodworkUploadInput,
  MAX_BLOODWORK_MEDIA_DECODED_BYTES,
} from "@/lib/models";

/** A syntactically valid base64 string whose DECODED size is `bytes`. */
function base64OfDecodedBytes(bytes: number): string {
  // 3 decoded bytes → 4 base64 chars (no padding). Round up to a multiple of 3
  // so we can use unpadded base64 (every char in [A-Za-z0-9+/] is valid).
  const groups = Math.ceil(bytes / 3);
  return "A".repeat(groups * 4);
}

const value = (i: number) => ({ code: `m_${i}`, value: i });

describe("BloodworkConfirmInput.values cap", () => {
  it("accepts up to 100 values", () => {
    const ok = BloodworkConfirmInput.safeParse({
      uploadId: "upload_1",
      values: Array.from({ length: 100 }, (_, i) => value(i)),
      takenAt: "2026-07-01",
    });
    expect(ok.success).toBe(true);
  });

  it("rejects more than 100 values", () => {
    const tooMany = BloodworkConfirmInput.safeParse({
      uploadId: "upload_1",
      values: Array.from({ length: 101 }, (_, i) => value(i)),
      takenAt: "2026-07-01",
    });
    expect(tooMany.success).toBe(false);
  });

  it("still requires at least one value", () => {
    const empty = BloodworkConfirmInput.safeParse({
      uploadId: "upload_1",
      values: [],
      takenAt: "2026-07-01",
    });
    expect(empty.success).toBe(false);
  });
});

describe("BloodworkUploadInput.manualValues cap", () => {
  it("rejects more than 100 manual values", () => {
    const tooMany = BloodworkUploadInput.safeParse({
      kind: "manual",
      manualValues: Array.from({ length: 101 }, (_, i) => ({
        code: `m_${i}`,
        value: i,
        unit: "mg/dL",
      })),
    });
    expect(tooMany.success).toBe(false);
  });
});

describe("BloodworkUploadInput.media (real-OCR bytes) validation", () => {
  // "PNG" → "UE5H" (valid, tiny, decodes to 3 bytes).
  const smallImage = { mime: "image/png", base64: "UE5H" };
  const smallPdf = {
    mime: "application/pdf",
    base64: Buffer.from("%PDF-1.4").toString("base64"),
  };

  it("accepts a valid small image", () => {
    const ok = BloodworkUploadInput.safeParse({
      kind: "photo",
      fileName: "labs.png",
      media: smallImage,
    });
    expect(ok.success).toBe(true);
  });

  it("accepts a valid small PDF", () => {
    const ok = BloodworkUploadInput.safeParse({
      kind: "pdf",
      fileName: "labs.pdf",
      media: smallPdf,
    });
    expect(ok.success).toBe(true);
  });

  it("keeps media optional (absent body still valid)", () => {
    const ok = BloodworkUploadInput.safeParse({ kind: "photo", fileName: "x.jpg" });
    expect(ok.success).toBe(true);
  });

  it("rejects a disallowed mime type", () => {
    const bad = BloodworkUploadInput.safeParse({
      kind: "photo",
      fileName: "x.gif",
      media: { mime: "image/gif", base64: "UE5H" },
    });
    expect(bad.success).toBe(false);
  });

  it("rejects malformed base64", () => {
    const bad = BloodworkUploadInput.safeParse({
      kind: "photo",
      fileName: "x.png",
      media: { mime: "image/png", base64: "not base64!!" },
    });
    expect(bad.success).toBe(false);
  });

  it("rejects media whose decoded size exceeds the cap", () => {
    const oversize = base64OfDecodedBytes(MAX_BLOODWORK_MEDIA_DECODED_BYTES + 1024);
    const bad = BloodworkUploadInput.safeParse({
      kind: "photo",
      fileName: "huge.png",
      media: { mime: "image/png", base64: oversize },
    });
    expect(bad.success).toBe(false);
  });

  it("accepts media right at the decoded-size cap", () => {
    const atCap = base64OfDecodedBytes(MAX_BLOODWORK_MEDIA_DECODED_BYTES);
    const ok = BloodworkUploadInput.safeParse({
      kind: "photo",
      fileName: "big.png",
      media: { mime: "image/png", base64: atCap },
    });
    expect(ok.success).toBe(true);
  });
});
