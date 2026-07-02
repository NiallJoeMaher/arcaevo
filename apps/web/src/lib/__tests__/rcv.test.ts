/**
 * Unit tests for src/lib/rcv.ts — the deterministic RCV verdict + baseline
 * band logic. Pure functions, tested behaviorally against the product rules:
 *
 * - |Δ%| ≤ RCV        → "no_real_change" (within expected variation)
 * - beyond RCV, moved in the beneficial direction → "improved"
 * - beyond RCV, moved in the harmful direction    → "worsened"
 * - baseline band = mean(series) ± RCV%
 */
import { describe, expect, it } from "vitest";
import {
  computeBaselineBand,
  computeRcvVerdict,
  isWithinBand,
  percentChange,
  type RcvRuleLike,
} from "@/lib/rcv";

const lower: RcvRuleLike = { rcvPercent: 20, direction: "lower_is_better" };
const higher: RcvRuleLike = { rcvPercent: 20, direction: "higher_is_better" };

describe("percentChange", () => {
  it("computes signed percent change from prior to current", () => {
    expect(percentChange(100, 110)).toBe(10);
    expect(percentChange(100, 75)).toBe(-25);
    expect(percentChange(80, 80)).toBe(0);
  });

  it("guards against zero prior (returns 0, no division blow-up)", () => {
    expect(percentChange(0, 50)).toBe(0);
    expect(percentChange(0, -50)).toBe(0);
    expect(percentChange(0, 0)).toBe(0);
  });

  it("uses the magnitude of prior so the sign reflects direction of movement", () => {
    // -100 → -90 moved UP by 10% of |prior|.
    expect(percentChange(-100, -90)).toBe(10);
    expect(percentChange(-100, -120)).toBe(-20);
  });
});

describe("computeRcvVerdict", () => {
  it("returns no_real_change when |Δ%| is within the RCV", () => {
    expect(computeRcvVerdict(100, 110, lower)).toBe("no_real_change");
    expect(computeRcvVerdict(100, 90, lower)).toBe("no_real_change");
    expect(computeRcvVerdict(100, 119, higher)).toBe("no_real_change");
    expect(computeRcvVerdict(100, 81, higher)).toBe("no_real_change");
  });

  it("treats a change of exactly the RCV as no_real_change (inclusive boundary)", () => {
    expect(computeRcvVerdict(100, 120, lower)).toBe("no_real_change");
    expect(computeRcvVerdict(100, 80, lower)).toBe("no_real_change");
    expect(computeRcvVerdict(100, 120, higher)).toBe("no_real_change");
    expect(computeRcvVerdict(100, 80, higher)).toBe("no_real_change");
  });

  describe('direction: "lower_is_better" (e.g. ApoB, LDL-C, hs-CRP)', () => {
    it("a real drop is improved", () => {
      expect(computeRcvVerdict(100, 79, lower)).toBe("improved");
      expect(computeRcvVerdict(1.2, 0.8, lower)).toBe("improved");
    });
    it("a real rise is worsened", () => {
      expect(computeRcvVerdict(100, 121, lower)).toBe("worsened");
      expect(computeRcvVerdict(0.8, 1.2, lower)).toBe("worsened");
    });
  });

  describe('direction: "higher_is_better" (e.g. HDL-C, vitamin D)', () => {
    it("a real rise is improved", () => {
      expect(computeRcvVerdict(100, 121, higher)).toBe("improved");
      expect(computeRcvVerdict(50, 70, higher)).toBe("improved");
    });
    it("a real drop is worsened", () => {
      expect(computeRcvVerdict(100, 79, higher)).toBe("worsened");
      expect(computeRcvVerdict(70, 50, higher)).toBe("worsened");
    });
  });

  it("zero prior always yields no_real_change (guarded percent change)", () => {
    expect(computeRcvVerdict(0, 999, lower)).toBe("no_real_change");
    expect(computeRcvVerdict(0, 999, higher)).toBe("no_real_change");
    expect(computeRcvVerdict(0, 0, lower)).toBe("no_real_change");
  });
});

describe("computeBaselineBand", () => {
  it("returns null for an empty series", () => {
    expect(computeBaselineBand([], 20)).toBeNull();
  });

  it("builds mean ± RCV% for a single-element series", () => {
    expect(computeBaselineBand([100], 10)).toEqual({ low: 90, high: 110 });
  });

  it("builds mean ± RCV% for a multi-reading series", () => {
    // mean(90, 100, 110) = 100 → ±20% = [80, 120]
    expect(computeBaselineBand([90, 100, 110], 20)).toEqual({
      low: 80,
      high: 120,
    });
  });

  it("is order-independent (uses the mean)", () => {
    expect(computeBaselineBand([110, 90, 100], 20)).toEqual(
      computeBaselineBand([90, 100, 110], 20)
    );
  });

  it("rounds band edges to 2 decimal places", () => {
    // mean(1.0, 1.1) = 1.05 → ±9.9% margin = 0.10395 → [0.95, 1.15]
    expect(computeBaselineBand([1.0, 1.1], 9.9)).toEqual({
      low: 0.95,
      high: 1.15,
    });
  });

  it("keeps low ≤ high for negative means (margin uses |mean|)", () => {
    expect(computeBaselineBand([-100], 10)).toEqual({ low: -110, high: -90 });
  });

  it("zero RCV collapses the band to the mean", () => {
    expect(computeBaselineBand([5, 15], 0)).toEqual({ low: 10, high: 10 });
  });
});

describe("isWithinBand", () => {
  const band = { low: 80, high: 120 };

  it("is true strictly inside the band", () => {
    expect(isWithinBand(100, band)).toBe(true);
  });

  it("is inclusive at both edges", () => {
    expect(isWithinBand(80, band)).toBe(true);
    expect(isWithinBand(120, band)).toBe(true);
  });

  it("is false outside the band", () => {
    expect(isWithinBand(79.99, band)).toBe(false);
    expect(isWithinBand(120.01, band)).toBe(false);
  });
});
