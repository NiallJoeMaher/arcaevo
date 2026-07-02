/**
 * RCV (Reference Change Value) logic — the deterministic heart of Arcaevo.
 *
 * "Deterministic rules decide; AI only narrates." A change between two
 * readings of the same biomarker only counts as *real* when it exceeds the
 * marker's RCV percentage (analytical + within-person biological variation).
 * Everything here is a pure function: no I/O, no clocks, no randomness —
 * unit-testable in isolation.
 */
import type { BaselineBand, RcvVerdict, RuleDirection } from "@/lib/models";

export interface RcvRuleLike {
  rcvPercent: number;
  direction: RuleDirection;
}

/**
 * Percent change from `prior` to `current`.
 * Returns 0 when prior is 0 (no meaningful relative change).
 */
export function percentChange(prior: number, current: number): number {
  if (prior === 0) return 0;
  return ((current - prior) / Math.abs(prior)) * 100;
}

/**
 * Verdict for `current` vs `prior` under a rule's RCV threshold.
 *
 * - |Δ%| ≤ rcvPercent          → "no_real_change" (within expected variation)
 * - Δ beneficial per direction → "improved"
 * - otherwise                  → "worsened"
 */
export function computeRcvVerdict(
  prior: number,
  current: number,
  rule: RcvRuleLike
): RcvVerdict {
  const delta = percentChange(prior, current);
  if (Math.abs(delta) <= rule.rcvPercent) return "no_real_change";
  const movedDown = delta < 0;
  const beneficial =
    rule.direction === "lower_is_better" ? movedDown : !movedDown;
  return beneficial ? "improved" : "worsened";
}

/**
 * Personal baseline band from a series of readings (chronological or not —
 * order doesn't matter, we use the mean).
 *
 * Band = mean ± RCV%: values inside the band are indistinguishable from the
 * member's own baseline; values outside it are real departures.
 * Returns null for an empty series.
 */
export function computeBaselineBand(
  series: number[],
  rcvPercent: number
): BaselineBand | null {
  if (series.length === 0) return null;
  const mean = series.reduce((sum, v) => sum + v, 0) / series.length;
  const margin = Math.abs(mean) * (rcvPercent / 100);
  return {
    low: round2(mean - margin),
    high: round2(mean + margin),
  };
}

/** Is a value inside a baseline band (inclusive)? */
export function isWithinBand(value: number, band: BaselineBand): boolean {
  return value >= band.low && value <= band.high;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
