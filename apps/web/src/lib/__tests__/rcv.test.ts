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
  baselineInputsForIngest,
  computeBaselineBand,
  computeRcvVerdict,
  isWithinBand,
  percentChange,
  type IngestHistoryReading,
  type RcvRuleLike,
} from "@/lib/rcv";

const d = (iso: string): Date => new Date(iso);

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

/**
 * Ingestion-time correctness (the three real-route bugs from the Tech-CEO
 * review §3/§7). baselineInputsForIngest is the single source of truth both the
 * LGC webhook and the upload/confirm route now call, so proving it here is a
 * regression guard for both routes.
 */
describe("baselineInputsForIngest — ingestion correctness", () => {
  const reading = (
    value: number,
    iso: string,
    source: string
  ): IngestHistoryReading => ({ value, takenAt: d(iso), source });

  it("bug (a): excludes the incoming reading from its OWN baseline", () => {
    // Two prior lab readings; ingesting a third today. The band must be built
    // from the two priors only — the incoming value must not be in its series.
    const history = [
      reading(100, "2026-01-01", "lab"),
      reading(120, "2026-03-01", "lab"),
    ];
    const { prior, series } = baselineInputsForIngest(history, {
      takenAt: d("2026-06-01"),
      source: "lab",
    });
    expect(series).toEqual([100, 120]); // NOT [100, 120, <incoming>]
    expect(prior?.value).toBe(120);
    // With no history at all, a first reading has an empty baseline (null band),
    // never a band drawn around itself.
    const first = baselineInputsForIngest([], {
      takenAt: d("2026-06-01"),
      source: "lab",
    });
    expect(first.series).toEqual([]);
    expect(first.prior).toBeNull();
    expect(computeBaselineBand(first.series, 20)).toBeNull();
  });

  it("bug (b): self-reported values never pollute the lab baseline/prior", () => {
    // A self-reported (hollow-gold) value sits chronologically between two lab
    // draws. When a NEW lab result lands, the self-reported value must be
    // excluded from both the lab prior and the lab baseline series.
    const history = [
      reading(40, "2026-01-01", "lab"),
      reading(999, "2026-02-01", "self_reported"), // must be ignored for lab
      reading(44, "2026-03-01", "lab"),
    ];
    const { prior, series } = baselineInputsForIngest(history, {
      takenAt: d("2026-06-01"),
      source: "lab",
    });
    expect(series).toEqual([40, 44]); // 999 self-reported is excluded
    expect(prior?.value).toBe(44); // prior is the last LAB reading, not 999
  });

  it("bug (b, mirror): lab values never pollute a self-reported baseline", () => {
    const history = [
      reading(40, "2026-01-01", "lab"),
      reading(50, "2026-02-01", "self_reported"),
    ];
    const { prior, series } = baselineInputsForIngest(history, {
      takenAt: d("2026-06-01"),
      source: "self_reported",
    });
    expect(series).toEqual([50]);
    expect(prior?.value).toBe(50);
  });

  it("bug (c): backfilled old bloodwork is verdicted against the prior in TIME, not today's reading", () => {
    // History already holds an old (2024) and a recent (2026) self-reported
    // reading. The member now backfills a 2025 reading that sits BETWEEN them.
    // Its prior must be the 2024 reading — never the chronologically-later 2026
    // one — and the 2026 value must not be in its baseline.
    const history = [
      reading(30, "2024-01-01", "self_reported"),
      reading(80, "2026-01-01", "self_reported"),
    ];
    const { prior, series } = baselineInputsForIngest(history, {
      takenAt: d("2025-06-01"),
      source: "self_reported",
    });
    expect(prior?.value).toBe(30); // the 2024 reading, not the 2026 one
    expect(series).toEqual([30]); // 2026 (later) reading excluded

    // And the resulting verdict is computed against that correct prior.
    const rule: RcvRuleLike = { rcvPercent: 20, direction: "higher_is_better" };
    expect(computeRcvVerdict(prior!.value, 45, rule)).toBe("improved"); // 30→45
  });

  it("history order does not matter (filtered + sorted internally)", () => {
    const history = [
      reading(120, "2026-03-01", "lab"),
      reading(100, "2026-01-01", "lab"),
    ];
    const { prior, series } = baselineInputsForIngest(history, {
      takenAt: d("2026-06-01"),
      source: "lab",
    });
    expect(series).toEqual([100, 120]);
    expect(prior?.value).toBe(120);
  });
});
