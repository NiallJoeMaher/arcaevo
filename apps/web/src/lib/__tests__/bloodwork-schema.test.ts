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
  isAcceptableMedia,
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

describe("BloodworkUploadInput.media shape (NEW contract: shape-only, no policy)", () => {
  // Media POLICY (mime/size/base64) is NO LONGER a 400 in the schema — it moved
  // to isAcceptableMedia + a graceful manual-entry fallback in the route. The
  // schema now only checks the basic { mime, base64 } SHAPE so the body parses
  // and every media problem degrades to manual entry rather than a raw 400.
  const smallImage = { mime: "image/png", base64: "UE5H" };

  it("accepts a well-formed media shape", () => {
    const ok = BloodworkUploadInput.safeParse({
      kind: "photo",
      fileName: "labs.png",
      media: smallImage,
    });
    expect(ok.success).toBe(true);
  });

  it("keeps media optional (absent body still valid)", () => {
    const ok = BloodworkUploadInput.safeParse({ kind: "photo", fileName: "x.jpg" });
    expect(ok.success).toBe(true);
  });

  it("PARSES a disallowed mime (shape-only — policy is enforced in the route now)", () => {
    const ok = BloodworkUploadInput.safeParse({
      kind: "photo",
      fileName: "x.gif",
      media: { mime: "image/gif", base64: "UE5H" },
    });
    expect(ok.success).toBe(true);
  });

  it("PARSES malformed base64 (shape-only — policy is enforced in the route now)", () => {
    const ok = BloodworkUploadInput.safeParse({
      kind: "photo",
      fileName: "x.png",
      media: { mime: "image/png", base64: "not base64!!" },
    });
    expect(ok.success).toBe(true);
  });

  it("PARSES oversize media (shape-only — policy is enforced in the route now)", () => {
    const oversize = base64OfDecodedBytes(MAX_BLOODWORK_MEDIA_DECODED_BYTES + 1024);
    const ok = BloodworkUploadInput.safeParse({
      kind: "photo",
      fileName: "huge.png",
      media: { mime: "image/png", base64: oversize },
    });
    expect(ok.success).toBe(true);
  });

  it("rejects a structurally broken media shape (mime/base64 not strings)", () => {
    const bad = BloodworkUploadInput.safeParse({
      kind: "photo",
      fileName: "x.png",
      media: { mime: 123, base64: null },
    });
    expect(bad.success).toBe(false);
  });
});

describe("isAcceptableMedia (real-OCR media POLICY — pure, reused by the route)", () => {
  it("accepts a valid small image", () => {
    expect(isAcceptableMedia({ mime: "image/png", base64: "UE5H" })).toBe(true);
  });

  it("accepts a valid small PDF", () => {
    expect(
      isAcceptableMedia({
        mime: "application/pdf",
        base64: Buffer.from("%PDF-1.4").toString("base64"),
      })
    ).toBe(true);
  });

  it("rejects a disallowed mime type", () => {
    expect(isAcceptableMedia({ mime: "image/gif", base64: "UE5H" })).toBe(false);
  });

  it("rejects malformed base64", () => {
    expect(
      isAcceptableMedia({ mime: "image/png", base64: "not base64!!" })
    ).toBe(false);
  });

  it("rejects empty base64", () => {
    expect(isAcceptableMedia({ mime: "image/png", base64: "" })).toBe(false);
  });

  it("rejects media whose decoded size exceeds the cap", () => {
    const oversize = base64OfDecodedBytes(MAX_BLOODWORK_MEDIA_DECODED_BYTES + 1024);
    expect(isAcceptableMedia({ mime: "image/png", base64: oversize })).toBe(false);
  });

  it("accepts media right at the decoded-size cap", () => {
    const atCap = base64OfDecodedBytes(MAX_BLOODWORK_MEDIA_DECODED_BYTES);
    expect(isAcceptableMedia({ mime: "image/png", base64: atCap })).toBe(true);
  });
});
