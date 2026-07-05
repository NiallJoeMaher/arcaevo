/**
 * Unit tests for src/lib/fusion.ts — the real (computed, not canned) fusion
 * insight. Behavioral, pure, no DB. Covers the four contract guarantees:
 *
 *  - a genuine co-movement is detected on the seed's ApoB↓ / RHR↓ story shape
 *  - `null` when there isn't enough data (never fabricated)
 *  - the "beyond noise" test is RCV (a within-RCV change never surfaces)
 *  - the blood side ignores self_reported readings
 */
import { describe, expect, it } from "vitest";
import {
  computeFusionInsight,
  type FusionReading,
  type FusionRule,
  type FusionWearable,
} from "@/lib/fusion";

const d = (iso: string): Date => new Date(`${iso}T09:00:00.000Z`);

const RULES: FusionRule[] = [
  { code: "apob", name: "ApoB", unit: "g/L", rcvPercent: 10, direction: "lower_is_better" },
  { code: "ldl_c", name: "LDL-C", unit: "mmol/L", rcvPercent: 17, direction: "lower_is_better" },
  { code: "hdl_c", name: "HDL-C", unit: "mmol/L", rcvPercent: 12, direction: "higher_is_better" },
];

/** lab reading helper */
function lab(code: string, value: number, iso: string): FusionReading {
  return { code, value, takenAt: d(iso), source: "lab" };
}

/** Six RHR points (falling — beneficial) inside Feb–Apr. */
const RHR: FusionWearable[] = [
  { type: "rhr", value: 64, date: "2026-02-05" },
  { type: "rhr", value: 63, date: "2026-02-20" },
  { type: "rhr", value: 62, date: "2026-03-05" },
  { type: "rhr", value: 60, date: "2026-03-25" },
  { type: "rhr", value: 58, date: "2026-04-10" },
  { type: "rhr", value: 57, date: "2026-04-25" },
];
/** Six HRV points (rising — beneficial), weaker relative shift than RHR. */
const HRV: FusionWearable[] = [
  { type: "hrv", value: 44, date: "2026-02-05" },
  { type: "hrv", value: 45, date: "2026-02-20" },
  { type: "hrv", value: 45, date: "2026-03-05" },
  { type: "hrv", value: 46, date: "2026-03-25" },
  { type: "hrv", value: 47, date: "2026-04-10" },
  { type: "hrv", value: 47, date: "2026-04-25" },
];

describe("computeFusionInsight — the seed's ApoB↓ / RHR↓ story", () => {
  const readings = [lab("apob", 1.15, "2026-01-15"), lab("apob", 0.94, "2026-05-15")];
  const insight = computeFusionInsight({
    readings,
    wearables: [...RHR, ...HRV],
    rules: RULES,
  });

  it("detects a real co-movement", () => {
    expect(insight).not.toBeNull();
    expect(insight!.kind).toBe("fusion");
  });

  it("uses the beyond-RCV blood improvement as the marker", () => {
    expect(insight!.marker.code).toBe("apob");
    expect(insight!.marker.verdict).toBe("improved");
    expect(insight!.marker.prior).toBe(1.15);
    expect(insight!.marker.current).toBe(0.94);
    // −18% is beyond the 10% RCV.
    expect(insight!.marker.deltaPercent).toBe(18);
    expect(insight!.marker.rcvPercent).toBe(10);
  });

  it("pairs it with the strongest co-moving wearable (RHR fell)", () => {
    expect(insight!.wearable.metric).toBe("rhr");
    expect(insight!.wearable.direction).toBe("lower_is_better");
    expect(insight!.wearable.delta).toBeLessThan(0); // fell
    expect(insight!.wearable.earlierMean).toBeGreaterThan(insight!.wearable.laterMean);
  });

  it("surfaces the other co-mover (HRV rose) too", () => {
    const metrics = insight!.otherWearables.map((w) => w.metric);
    expect(metrics).toContain("hrv");
    const hrv = insight!.otherWearables.find((w) => w.metric === "hrv")!;
    expect(hrv.delta).toBeGreaterThan(0); // rose
  });

  it("spans the real window and carries the honest caveat", () => {
    expect(insight!.window.start).toEqual(d("2026-01-15"));
    expect(insight!.window.end).toEqual(d("2026-05-15"));
    expect(insight!.caveat).toMatch(/not proof|not medical advice/i);
    expect(insight!.text).toContain("1.15 → 0.94");
    expect(insight!.text).toContain("resting heart rate");
  });
});

describe("computeFusionInsight — picks the strongest blood marker", () => {
  it("prefers the marker furthest beyond its RCV", () => {
    // apob −18% / rcv 10 → exceedance 1.8; ldl −18% / rcv 17 → ~1.06.
    const readings = [
      lab("apob", 1.15, "2026-01-15"),
      lab("apob", 0.94, "2026-05-15"),
      lab("ldl_c", 3.5, "2026-01-15"),
      lab("ldl_c", 2.86, "2026-05-15"),
    ];
    const insight = computeFusionInsight({
      readings,
      wearables: [...RHR, ...HRV],
      rules: RULES,
    });
    expect(insight!.marker.code).toBe("apob");
  });
});

describe("computeFusionInsight — returns null (never fabricates)", () => {
  it("null when a marker has only one lab draw", () => {
    expect(
      computeFusionInsight({
        readings: [lab("apob", 1.15, "2026-01-15")],
        wearables: [...RHR, ...HRV],
        rules: RULES,
      })
    ).toBeNull();
  });

  it("null when there is no wearable coverage at all", () => {
    expect(
      computeFusionInsight({
        readings: [lab("apob", 1.15, "2026-01-15"), lab("apob", 0.94, "2026-05-15")],
        wearables: [],
        rules: RULES,
      })
    ).toBeNull();
  });

  it("null when wearable coverage does not overlap the draw window", () => {
    const after: FusionWearable[] = RHR.map((w) => ({ ...w, date: "2026-06-15" }));
    expect(
      computeFusionInsight({
        readings: [lab("apob", 1.15, "2026-01-15"), lab("apob", 0.94, "2026-05-15")],
        wearables: after,
        rules: RULES,
      })
    ).toBeNull();
  });

  it("null when the wearable shift is within noise (< min rel shift)", () => {
    const flat: FusionWearable[] = [
      { type: "rhr", value: 60.0, date: "2026-02-05" },
      { type: "rhr", value: 60.1, date: "2026-02-20" },
      { type: "rhr", value: 59.9, date: "2026-03-05" },
      { type: "rhr", value: 60.0, date: "2026-03-25" },
      { type: "rhr", value: 59.9, date: "2026-04-10" },
      { type: "rhr", value: 60.0, date: "2026-04-25" },
    ];
    expect(
      computeFusionInsight({
        readings: [lab("apob", 1.15, "2026-01-15"), lab("apob", 0.94, "2026-05-15")],
        wearables: flat,
        rules: RULES,
      })
    ).toBeNull();
  });

  it("null when the wearable moved the HARMFUL way (RHR rose)", () => {
    const rising: FusionWearable[] = RHR.map((w, i) => ({
      ...w,
      value: 57 + i, // now increasing → worse for RHR
    }));
    expect(
      computeFusionInsight({
        readings: [lab("apob", 1.15, "2026-01-15"), lab("apob", 0.94, "2026-05-15")],
        wearables: rising,
        rules: RULES,
      })
    ).toBeNull();
  });
});

describe("computeFusionInsight — RCV is the beyond-noise test", () => {
  it("null when the blood change is within the marker's RCV", () => {
    // 1.15 → 1.10 is −4.3%, inside the 10% RCV → no real change.
    expect(
      computeFusionInsight({
        readings: [lab("apob", 1.15, "2026-01-15"), lab("apob", 1.1, "2026-05-15")],
        wearables: [...RHR, ...HRV],
        rules: RULES,
      })
    ).toBeNull();
  });

  it("null when the blood change is beyond RCV but the WRONG direction", () => {
    // 1.0 → 1.3 is +30% for a lower-is-better marker → worsened, not surfaced.
    expect(
      computeFusionInsight({
        readings: [lab("apob", 1.0, "2026-01-15"), lab("apob", 1.3, "2026-05-15")],
        wearables: [...RHR, ...HRV],
        rules: RULES,
      })
    ).toBeNull();
  });
});

describe("computeFusionInsight — ignores self_reported on the blood side", () => {
  it("does not count a self_reported reading toward the ≥2 lab-draw rule", () => {
    const readings: FusionReading[] = [
      lab("apob", 0.94, "2026-05-15"),
      { code: "apob", value: 1.15, takenAt: d("2026-01-15"), source: "self_reported" },
    ];
    // Only one LAB draw → cannot co-move → null.
    expect(
      computeFusionInsight({ readings, wearables: [...RHR, ...HRV], rules: RULES })
    ).toBeNull();
  });

  it("does not let a self_reported prior manufacture an improvement", () => {
    // Two LAB draws are within RCV (no improvement). A self_reported earlier
    // extreme WOULD flip earliest→latest to 'improved' if counted — it must not.
    const readings: FusionReading[] = [
      lab("apob", 0.95, "2026-01-15"),
      lab("apob", 0.94, "2026-05-15"),
      { code: "apob", value: 1.3, takenAt: d("2025-12-01"), source: "self_reported" },
    ];
    expect(
      computeFusionInsight({ readings, wearables: [...RHR, ...HRV], rules: RULES })
    ).toBeNull();
  });
});
