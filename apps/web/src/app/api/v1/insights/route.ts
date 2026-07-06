/**
 * GET /api/v1/insights — bearer: plain-language insight strings derived from
 * the member's latest RCV verdicts.
 *
 * Deterministic rules decide the verdicts (lib/rcv.ts); these strings are
 * fixed templates. AI-NARRATION SLOT (now WIRED — src/lib/ai-narration.ts):
 * when AI_NARRATION_ENABLED=true + AWS creds exist, Claude Haiku on Bedrock
 * rewrites the `text` of an ELIGIBLE insight in warmer language — but it
 * ONLY narrates the deterministic verdict, never changes it. The rewrite
 * ships as an ADDITIVE `narration?: string` next to the untouched template
 * `text` (iOS decoders ignore extra keys), is cache-first (a miss enqueues
 * background generation and ships the template — this GET never waits on the
 * model), and flagged/watch values are NEVER narrated ("flagged values go to
 * a clinician, not a chatbot" — isNarrationEligible reuses isWatchMarker).
 * Feature off / any failure ⇒ this payload is byte-identical to before.
 *
 * FUSION (docs/IMPROVEMENT_REVIEW.md #2): the response also carries a real,
 * COMPUTED `fusion` insight when the member's own data supports one — a blood
 * marker that improved beyond its RCV between two lab draws, paired with a
 * wearable metric that shifted beneficially over the same weeks (lib/fusion.ts,
 * the first real reader of `wearableSignals`). `null` when there isn't the
 * data — never fabricated. Added as a SEPARATE top-level key so existing
 * decoders of `insights`/`disclaimer` are unaffected.
 *
 * Wellness language only — never diagnosis.
 */
import { requireConsentedMember } from "@/lib/consent-guard";
import { collections } from "@/lib/db";
import { percentChange } from "@/lib/rcv";
import { computeFusionInsight } from "@/lib/fusion";
import { isNarrationEligible, resolveNarrations } from "@/lib/ai-narration";
import type { NarrationInput } from "@/lib/vendors/ai-narration";
import type { BiomarkerReading } from "@/lib/models";

const DISCLAIMER =
  "Not a medical device. Not a diagnosis. Consult a doctor.";

export async function GET(req: Request) {
  const auth = await requireConsentedMember(req);
  if (auth.denied) return auth.denied;

  const [readings, rules, labReadings, wearables] = await Promise.all([
    collections
      .biomarkerReadings()
      .then((c) =>
        c
          .find({ memberId: auth.member._id, clinicianReviewed: true })
          .sort({ takenAt: 1 })
          .toArray()
      ),
    collections.biomarkerRules().then((c) => c.find().toArray()),
    // Fusion blood side: LAB readings only (self_reported never counts).
    collections
      .biomarkerReadings()
      .then((c) =>
        c.find({ memberId: auth.member._id, source: "lab" }).toArray()
      ),
    // Fusion wearable side: the first real reader of wearable_signals.
    collections
      .wearableSignals()
      .then((c) => c.find({ memberId: auth.member._id }).toArray()),
  ]);
  const ruleByCode = new Map(rules.map((r) => [r.code, r]));

  // Group chronologically per marker; insight = latest reading vs its prior.
  const byCode = new Map<string, BiomarkerReading[]>();
  for (const r of readings) {
    const list = byCode.get(r.code) ?? [];
    list.push(r);
    byCode.set(r.code, list);
  }

  interface InsightItem {
    code: string;
    name: string;
    verdict: string;
    text: string;
    takenAt: Date;
    /** Additive: cached AI rewrite of `text` (absent when none — iOS-safe). */
    narration?: string;
  }
  // Insight + (when guardrail-eligible) the PII-free facts for AI narration.
  const built: Array<{
    insight: InsightItem;
    narrationInput: NarrationInput | null;
  }> = [];

  for (const [code, series] of byCode) {
    const latest = series[series.length - 1];
    if (!latest.rcvVerdict || series.length < 2) continue;
    const prior = series[series.length - 2];
    const rule = ruleByCode.get(code);
    const name = rule?.name ?? code;
    const deltaPct = Math.abs(Math.round(percentChange(prior.value, latest.value)));

    // Deterministic templates — ALWAYS shipped as `text`; the AI narration
    // (when enabled + cached) rides alongside as `narration`, never replaces.
    let text: string;
    switch (latest.rcvVerdict) {
      case "improved":
        text = `Your ${name} moved ${deltaPct}% in the right direction since your last test — bigger than your normal day-to-day variation, so this looks like a real change. Whatever you changed, it's working.`;
        break;
      case "worsened":
        text = `Your ${name} moved ${deltaPct}% in the wrong direction since your last test — beyond your normal variation, so it's worth paying attention to at your next check-in.`;
        break;
      default:
        text = `Your ${name} is within your personal baseline band. A ${deltaPct}% shift is inside your normal variation — no real change, and that's fine.`;
    }

    // GUARDRAIL: only non-flagged insights may be narrated — a worsened
    // verdict or a harmful out-of-band value is clinician territory, never a
    // chatbot's. Eligible facts are rule metadata + numbers ONLY (no PII).
    const eligible =
      rule !== undefined && isNarrationEligible(latest, rule.direction);

    built.push({
      insight: {
        code,
        name,
        verdict: latest.rcvVerdict,
        text,
        takenAt: latest.takenAt,
      },
      narrationInput: eligible
        ? {
            code,
            name,
            unit: latest.unit,
            direction: rule.direction,
            verdict: latest.rcvVerdict,
            priorValue: prior.value,
            currentValue: latest.value,
            deltaPct,
            templateText: text,
          }
        : null,
    });
  }

  // Stable order: improved first (celebrate wins), then worsened, then flat.
  const rank = { improved: 0, worsened: 1, no_real_change: 2 } as const;
  built.sort(
    (a, b) =>
      rank[a.insight.verdict as keyof typeof rank] -
        rank[b.insight.verdict as keyof typeof rank] ||
      a.insight.code.localeCompare(b.insight.code)
  );

  // Attach CACHED narrations (one indexed read; zero when the feature is
  // off). Misses enqueue background generation and ship the template — this
  // await is a cache lookup, never a model call. Fail-safe all-null on error.
  const narrations = await resolveNarrations(
    built.map((b) => b.narrationInput)
  );
  const insights = built.map((b, i) => {
    const narration = narrations[i];
    return narration ? { ...b.insight, narration } : b.insight;
  });

  // Real, computed fusion insight (or null) — the one non-canned card.
  const fusion = computeFusionInsight({
    readings: labReadings.map((r) => ({
      code: r.code,
      value: r.value,
      takenAt: r.takenAt,
      source: r.source,
    })),
    wearables: wearables.map((w) => ({
      type: w.type,
      value: w.value,
      date: w.date,
    })),
    rules: rules.map((r) => ({
      code: r.code,
      name: r.name,
      unit: r.unit,
      rcvPercent: r.rcvPercent,
      direction: r.direction,
    })),
  });

  return Response.json({ insights, fusion, disclaimer: DISCLAIMER });
}
