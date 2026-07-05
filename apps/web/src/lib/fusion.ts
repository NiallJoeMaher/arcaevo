/**
 * Fusion insight — the first REAL reader of `wearableSignals`.
 *
 * Arcaevo's whole differentiator is fusing Apple Watch data with blood
 * biomarkers. Everywhere else that story is a mock (docs/IMPROVEMENT_REVIEW.md
 * #2). This module computes a GENUINE co-movement from a member's own stored
 * data: a blood marker that changed **beyond its RCV** (beneficially) between
 * two lab draws, paired with a wearable metric whose mean shifted — in its own
 * beneficial direction — over the same window.
 *
 * Design rules (all enforced here, all unit-tested):
 *  - **Pure + deterministic.** No I/O, no clocks, no randomness. The route
 *    hands in readings + wearables + rules; this decides.
 *  - **Deterministic rules decide; AI only narrates.** The "is this beyond your
 *    own noise" test is `computeRcvVerdict` (lib/rcv.ts) — never re-implemented,
 *    never hardcoded here. RCV thresholds are used exactly as configured (a
 *    web↔iOS reconciliation is pending; we don't touch them).
 *  - **Lab only for the blood side.** Self-reported ("hollow gold") values are
 *    excluded — consistent with the ingestion rule and the clinician-claim
 *    promise. A marker needs ≥2 LAB draws or it can't co-move.
 *  - **Never fabricate.** Returns `null` cleanly when there isn't enough data
 *    (no beyond-RCV improvement, or no overlapping wearable coverage).
 *  - **Association, not causation.** The narration says two things moved in the
 *    same weeks — with an explicit caveat that it isn't proof or medical advice.
 *
 * NB (out of scope now): iOS currently draws its fusion timeline from demo
 * fixtures. It should eventually consume THIS same server computation so the
 * wrist and the web tell one story — a follow-up, not this change.
 */
import { computeRcvVerdict, percentChange } from "@/lib/rcv";
import type { RcvVerdict, RuleDirection } from "@/lib/models";

/** The four wearable metrics v1 stores (models.ts WearableSignalType). */
export type FusionWearableMetric = "hrv" | "rhr" | "sleep" | "vo2max";

/** Minimal lab-reading shape the fusion needs (a subset of BiomarkerReading). */
export interface FusionReading {
  code: string;
  value: number;
  takenAt: Date;
  /** "lab" | "self_reported" — only "lab" feeds the blood side. */
  source: string;
}

/** Minimal wearable shape (a subset of WearableSignal). */
export interface FusionWearable {
  type: FusionWearableMetric;
  value: number;
  /** Day-granularity key, "YYYY-MM-DD". */
  date: string;
}

/** Minimal rule shape (a subset of BiomarkerRule). */
export interface FusionRule {
  code: string;
  name: string;
  unit: string;
  rcvPercent: number;
  direction: RuleDirection;
}

/** How each wearable metric reads to a human + which way is "better". */
const WEARABLE_META: Record<
  FusionWearableMetric,
  { label: string; unit: string; direction: RuleDirection }
> = {
  hrv: { label: "heart-rate variability", unit: "ms", direction: "higher_is_better" },
  rhr: { label: "resting heart rate", unit: "bpm", direction: "lower_is_better" },
  sleep: { label: "sleep", unit: "h", direction: "higher_is_better" },
  vo2max: { label: "VO₂ max", unit: "ml/kg/min", direction: "higher_is_better" },
};

export interface FusionWearableShift {
  metric: FusionWearableMetric;
  label: string;
  unit: string;
  direction: RuleDirection;
  /** Mean over the earlier half of the window's coverage. */
  earlierMean: number;
  /** Mean over the later half. */
  laterMean: number;
  /** laterMean − earlierMean (signed, in the metric's own units). */
  delta: number;
  /** |delta| / |earlierMean| — the shift as a fraction of baseline. */
  relShift: number;
  /** Points used per half (earlier, later are equal ±1). */
  points: number;
}

export interface FusionInsight {
  kind: "fusion";
  /** The blood side — a real beyond-RCV improvement between two lab draws. */
  marker: {
    code: string;
    name: string;
    unit: string;
    prior: number;
    current: number;
    priorTakenAt: Date;
    currentTakenAt: Date;
    rcvPercent: number;
    /** |percent change|, rounded — always > rcvPercent for an improvement. */
    deltaPercent: number;
    verdict: RcvVerdict; // always "improved" for a surfaced fusion
  };
  /** Calendar window the two draws (and the wearable means) span. */
  window: { start: Date; end: Date };
  /** The strongest co-moving wearable metric (primary, narrated). */
  wearable: FusionWearableShift;
  /** Any other wearable metrics that also co-moved beneficially, strongest first. */
  otherWearables: FusionWearableShift[];
  /** Plain-language, wellness-framed narration of the co-movement. */
  text: string;
  /** Honest association-not-causation caveat (never diagnosis/advice). */
  caveat: string;
}

export interface FusionOptions {
  /** Minimum wearable points required IN EACH HALF of the window. */
  minPointsPerHalf?: number;
  /** Minimum |delta|/baseline for a wearable shift to count (filters noise). */
  minRelShift?: number;
}

const DEFAULTS: Required<FusionOptions> = {
  minPointsPerHalf: 3,
  minRelShift: 0.02, // 2% — below this a "shift" is indistinguishable from drift
};

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const CAVEAT =
  "This is an association from your own data over the same weeks — not proof " +
  "that one caused the other, and not medical advice. It's a wellness insight, " +
  "not a diagnosis.";

/**
 * Compute the single strongest fusion insight for a member, or `null`.
 *
 * @param params.readings   the member's biomarker readings (any source — this
 *                          function filters to `source === "lab"`).
 * @param params.wearables  the member's wearable signals.
 * @param params.rules      biomarker rule metadata (name/unit/RCV/direction).
 */
export function computeFusionInsight(params: {
  readings: FusionReading[];
  wearables: FusionWearable[];
  rules: FusionRule[];
  options?: FusionOptions;
}): FusionInsight | null {
  const opts = { ...DEFAULTS, ...params.options };
  const ruleByCode = new Map(params.rules.map((r) => [r.code, r]));

  // --- Blood side: LAB readings only, grouped + sorted chronologically. ------
  const labByCode = new Map<string, FusionReading[]>();
  for (const r of params.readings) {
    if (r.source !== "lab") continue; // self_reported never feeds the blood side
    const list = labByCode.get(r.code) ?? [];
    list.push(r);
    labByCode.set(r.code, list);
  }

  // Candidate improvements: markers whose earliest→latest lab change is a real,
  // beneficial move beyond the marker's RCV.
  interface Candidate {
    rule: FusionRule;
    prior: FusionReading; // earliest
    current: FusionReading; // latest
    deltaPercentAbs: number;
    /** How far beyond RCV, as a ratio (>1). Ranks the blood side. */
    exceedance: number;
  }
  const candidates: Candidate[] = [];
  for (const [code, series] of labByCode) {
    if (series.length < 2) continue; // needs ≥2 lab draws
    const rule = ruleByCode.get(code);
    if (!rule) continue;
    const sorted = [...series].sort(
      (a, b) => a.takenAt.getTime() - b.takenAt.getTime()
    );
    const prior = sorted[0];
    const current = sorted[sorted.length - 1];
    const verdict = computeRcvVerdict(prior.value, current.value, rule);
    if (verdict !== "improved") continue; // only beyond-RCV wins co-move
    const deltaPercentAbs = Math.abs(percentChange(prior.value, current.value));
    candidates.push({
      rule,
      prior,
      current,
      deltaPercentAbs,
      exceedance: rule.rcvPercent > 0 ? deltaPercentAbs / rule.rcvPercent : 0,
    });
  }
  if (candidates.length === 0) return null;

  // --- Rank the fusion pairs. For each blood improvement, measure every
  // wearable metric's shift over the SAME window and keep the beneficial ones.
  interface Ranked {
    candidate: Candidate;
    primary: FusionWearableShift;
    others: FusionWearableShift[];
    /** exceedance × relShift — the combined co-movement strength. */
    score: number;
  }
  let best: Ranked | null = null;

  for (const c of candidates) {
    const shifts = beneficialWearableShifts(
      params.wearables,
      c.prior.takenAt,
      c.current.takenAt,
      opts
    );
    if (shifts.length === 0) continue;
    const [primary, ...others] = shifts;
    const score = c.exceedance * primary.relShift;
    // Deterministic tie-break: higher score, then marker code, then metric.
    if (
      best === null ||
      score > best.score ||
      (score === best.score &&
        (c.rule.code < best.candidate.rule.code ||
          (c.rule.code === best.candidate.rule.code &&
            primary.metric < best.primary.metric)))
    ) {
      best = { candidate: c, primary, others, score };
    }
  }
  if (best === null) return null;

  return buildInsight(best.candidate, best.primary, best.others);
}

/**
 * Wearable metrics that shifted BENEFICIALLY over [start, end], strongest first.
 *
 * The window is the span between the two blood draws. We take the metric's
 * points whose date falls in that window, split them by their median into an
 * earlier and later half, and compare the two means. A shift counts only when
 * it moves in the metric's beneficial direction AND exceeds `minRelShift` (so
 * day-to-day noise doesn't register as a trend).
 */
function beneficialWearableShifts(
  wearables: FusionWearable[],
  start: Date,
  end: Date,
  opts: Required<FusionOptions>
): FusionWearableShift[] {
  const startDay = isoDay(start);
  const endDay = isoDay(end);
  const lo = startDay <= endDay ? startDay : endDay;
  const hi = startDay <= endDay ? endDay : startDay;

  const shifts: FusionWearableShift[] = [];
  for (const metric of Object.keys(WEARABLE_META) as FusionWearableMetric[]) {
    const meta = WEARABLE_META[metric];
    const points = wearables
      .filter((w) => w.type === metric && w.date >= lo && w.date <= hi)
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    // Need enough coverage on BOTH sides of the median to compare halves.
    if (points.length < opts.minPointsPerHalf * 2) continue;

    const mid = Math.floor(points.length / 2);
    const earlier = points.slice(0, mid);
    const later = points.slice(points.length - mid); // symmetric halves
    const earlierMean = mean(earlier.map((p) => p.value));
    const laterMean = mean(later.map((p) => p.value));
    const delta = laterMean - earlierMean;
    if (earlierMean === 0) continue;

    const movedUp = delta > 0;
    const beneficial =
      meta.direction === "higher_is_better" ? movedUp : delta < 0;
    if (!beneficial) continue;

    const relShift = Math.abs(delta) / Math.abs(earlierMean);
    if (relShift < opts.minRelShift) continue;

    shifts.push({
      metric,
      label: meta.label,
      unit: meta.unit,
      direction: meta.direction,
      earlierMean: round1(earlierMean),
      laterMean: round1(laterMean),
      delta: round1(delta),
      relShift,
      points: mid,
    });
  }
  // Strongest relative shift first; deterministic tie-break by metric name.
  shifts.sort((a, b) => b.relShift - a.relShift || (a.metric < b.metric ? -1 : 1));
  return shifts;
}

function buildInsight(
  c: {
    rule: FusionRule;
    prior: FusionReading;
    current: FusionReading;
    deltaPercentAbs: number;
  },
  primary: FusionWearableShift,
  others: FusionWearableShift[]
): FusionInsight {
  const { rule, prior, current } = c;
  const markerVerb = rule.direction === "lower_is_better" ? "fell" : "rose";
  const wearAbsDelta = round1(Math.abs(primary.delta));
  const wearWord = primary.delta < 0 ? "lower" : "higher";

  const win = `${MONTHS[prior.takenAt.getUTCMonth()]}` +
    ` and ${MONTHS[current.takenAt.getUTCMonth()]}`;

  let text =
    `Between your ${win} panels, your ${rule.name} ${markerVerb} ` +
    `${fmt(prior.value)} → ${fmt(current.value)} ${rule.unit} — a real change, ` +
    `beyond your test-to-test noise. Over the same weeks, your ${primary.label} ` +
    `averaged about ${wearAbsDelta} ${primary.unit} ${wearWord} ` +
    `(${primary.earlierMean} → ${primary.laterMean} ${primary.unit}).`;

  if (others.length > 0) {
    const also = joinList(
      others.map((o) => `${o.label} ${o.delta < 0 ? "fell" : "rose"}`)
    );
    text += ` In the same window your ${also} too.`;
  }

  return {
    kind: "fusion",
    marker: {
      code: rule.code,
      name: rule.name,
      unit: rule.unit,
      prior: prior.value,
      current: current.value,
      priorTakenAt: prior.takenAt,
      currentTakenAt: current.takenAt,
      rcvPercent: rule.rcvPercent,
      deltaPercent: Math.round(c.deltaPercentAbs),
      verdict: "improved",
    },
    window: { start: prior.takenAt, end: current.takenAt },
    wearable: primary,
    otherWearables: others,
    text,
    caveat: CAVEAT,
  };
}

// --- small pure helpers ------------------------------------------------------

function mean(xs: number[]): number {
  return xs.reduce((s, x) => s + x, 0) / xs.length;
}
/** "a", "a and b", "a, b and c". */
function joinList(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? "";
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
/** Trim trailing zeros so 0.94 stays 0.94 and 39 stays 39. */
function fmt(n: number): string {
  return String(n);
}
function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}
