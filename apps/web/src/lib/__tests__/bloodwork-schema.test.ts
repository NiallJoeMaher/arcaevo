/**
 * Unit tests for the bloodwork input schemas — the `values`/`manualValues`
 * arrays are capped so a single request can't force an unbounded amount of
 * server-side work (DoS amplification: the confirm handler touches the DB per
 * distinct code).
 */
import { describe, expect, it } from "vitest";
import { BloodworkConfirmInput, BloodworkUploadInput } from "@/lib/models";

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
