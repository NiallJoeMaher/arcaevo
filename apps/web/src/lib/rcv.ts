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

/** Minimal shape of a stored reading needed to build an ingest baseline. */
export interface IngestHistoryReading {
  value: number;
  takenAt: Date;
  source: string; // "lab" | "self_reported"
}

/**
 * Select the baseline `series` and the chronologically-prior reading for a NEW
 * reading being ingested. This is the single place that enforces three
 * correctness rules the ingest routes previously got wrong:
 *
 *  1. **A reading is never in its own baseline.** Only readings STRICTLY BEFORE
 *     the incoming reading's `takenAt` feed the band it's compared against.
 *  2. **Sources never mix.** Lab and self-reported baselines are kept separate,
 *     so a self-reported "hollow gold" value can't pollute the clinician-track
 *     lab baseline/band (and vice-versa). Only same-`source` readings count.
 *  3. **Backfill-correct.** An older reading uploaded after the fact is
 *     verdicted against what came before IT chronologically — never against
 *     today's most-recent reading.
 *
 * `history` may be in any order; it is filtered and sorted here. The incoming
 * reading itself must NOT be included in `history`.
 */
export function baselineInputsForIngest(
  history: IngestHistoryReading[],
  incoming: { takenAt: Date; source: string }
): { prior: IngestHistoryReading | null; series: number[] } {
  const incomingMs = incoming.takenAt.getTime();
  const priorReadings = history
    .filter(
      (h) => h.source === incoming.source && h.takenAt.getTime() < incomingMs
    )
    .sort((a, b) => a.takenAt.getTime() - b.takenAt.getTime());
  return {
    prior: priorReadings.at(-1) ?? null,
    series: priorReadings.map((h) => h.value),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
