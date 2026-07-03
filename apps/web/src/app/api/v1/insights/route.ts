/**
 * GET /api/v1/insights — bearer: plain-language insight strings derived from
 * the member's latest RCV verdicts.
 *
 * Deterministic rules decide the verdicts (lib/rcv.ts); these strings are
 * fixed templates. AI-NARRATION SLOT: in production, Claude would rewrite the
 * `text` of each insight in warmer, member-specific language — but it would
 * ONLY narrate the deterministic verdict, never change it.
 *
 * Wellness language only — never diagnosis.
 */
import { requireConsentedMember } from "@/lib/consent-guard";
import { collections } from "@/lib/db";
import { percentChange } from "@/lib/rcv";
import type { BiomarkerReading } from "@/lib/models";

const DISCLAIMER =
  "Not a medical device. Not a diagnosis. Consult a doctor.";

export async function GET(req: Request) {
  const auth = await requireConsentedMember(req);
  if (auth.denied) return auth.denied;

  const [readings, rules] = await Promise.all([
    collections
      .biomarkerReadings()
      .then((c) =>
        c
          .find({ memberId: auth.member._id, clinicianReviewed: true })
          .sort({ takenAt: 1 })
          .toArray()
      ),
    collections.biomarkerRules().then((c) => c.find().toArray()),
  ]);
  const ruleByCode = new Map(rules.map((r) => [r.code, r]));

  // Group chronologically per marker; insight = latest reading vs its prior.
  const byCode = new Map<string, BiomarkerReading[]>();
  for (const r of readings) {
    const list = byCode.get(r.code) ?? [];
    list.push(r);
    byCode.set(r.code, list);
  }

  const insights: {
    code: string;
    name: string;
    verdict: string;
    text: string;
    takenAt: Date;
  }[] = [];

  for (const [code, series] of byCode) {
    const latest = series[series.length - 1];
    if (!latest.rcvVerdict || series.length < 2) continue;
    const prior = series[series.length - 2];
    const rule = ruleByCode.get(code);
    const name = rule?.name ?? code;
    const deltaPct = Math.abs(Math.round(percentChange(prior.value, latest.value)));

    // Deterministic templates — the AI narration slot would rewrite `text`.
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

    insights.push({
      code,
      name,
      verdict: latest.rcvVerdict,
      text,
      takenAt: latest.takenAt,
    });
  }

  // Stable order: improved first (celebrate wins), then worsened, then flat.
  const rank = { improved: 0, worsened: 1, no_real_change: 2 } as const;
  insights.sort(
    (a, b) =>
      rank[a.verdict as keyof typeof rank] - rank[b.verdict as keyof typeof rank] ||
      a.code.localeCompare(b.code)
  );

  return Response.json({ insights, disclaimer: DISCLAIMER });
}
