import type { Metadata } from "next";
import { routeMetadata } from "@/lib/seo";
import Link from "next/link";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";

export const metadata: Metadata = routeMetadata({
  path: "/science",
  title: "Science",
  description:
    "The logic is deterministic. The AI only narrates. Rules written from peer-reviewed literature decide every clinical call — never a language model. That's our safety posture, and our trust story.",
});

const PILLARS = [
  {
    tag: "01 · DETERMINISTIC",
    title: "Rules, not vibes",
    body: "Every threshold, flag and escalation is a rule written by our clinical team from the literature. Given the same inputs, you get the same output, every time — auditable and versioned.",
  },
  {
    tag: "02 · CLINICIAN-REVIEWED",
    title: "A doctor signs off",
    body: "A registered clinician reviews every panel before release. Critical values are routed to them for action, never handled by the coach or the model.",
  },
  {
    tag: "03 · YOUR BASELINE",
    title: "Read against you",
    body: "Population reference ranges are wide and blunt. We track each marker against your own history and flag change using Reference Change Value, so ‘normal’ doesn’t hide a real trend.",
  },
  {
    tag: "04 · TRANSPARENT AI",
    title: "The model only explains",
    body: "The AI turns the rule output into plain English and answers your questions, grounded strictly in your numbers and the rules. It cannot set a threshold or overrule the clinician.",
  },
];

const MARKERS = [
  {
    name: "ApoB",
    why: "Counts every atherogenic particle, not just the cholesterol they carry. A better predictor of cardiovascular risk than standard LDL-C, and the marker we lead with for heart health.",
  },
  {
    name: "Lp(a)",
    why: "Largely genetic and measured once in a lifetime. A high Lp(a) meaningfully changes your risk picture and is invisible to a standard cholesterol panel.",
  },
  {
    name: "HbA1c & fasting insulin",
    why: "Together they catch metabolic drift years before glucose alone would. We watch the trend against your activity and sleep, not a single reading.",
  },
  {
    name: "hs-CRP",
    why: "A sensitive marker of low-grade inflammation. Fused with your HRV and recovery data, it separates a training load from a genuine inflammatory signal.",
  },
];

const VERDICT_PILLS = [
  {
    label: "REAL IMPROVEMENT",
    className: "bg-[rgba(52,160,124,0.16)] text-vitality-light",
  },
  {
    label: "WITHIN NOISE",
    className: "bg-[rgba(255,255,255,0.08)] text-muted-dark",
  },
  {
    label: "NEEDS RETEST",
    className: "bg-[rgba(217,154,78,0.18)] text-[#E8B36A]",
  },
];

export default function SciencePage() {
  return (
    <div className="w-full overflow-x-hidden bg-bone font-sans text-ink">
      <SiteNav active="science" />

      <main>
        {/* HERO */}
        <section className="mx-auto max-w-[900px] px-[22px] md:px-10 pb-10 pt-[72px]">
          <div className="mb-5 font-mono text-xs tracking-[0.14em] text-forest">
            SCIENCE &amp; EVIDENCE
          </div>
          <h1 className="mb-[22px] mt-0 font-serif text-[clamp(38px,5vw,56px)] max-md:text-[clamp(34px,9.5vw,42px)] font-normal leading-[1.05] tracking-[-0.015em]">
            The logic is deterministic. The AI only narrates.
          </h1>
          <p className="m-0 max-w-[60ch] text-[19px] leading-[1.55] text-muted">
            Rules written from peer-reviewed literature decide every clinical
            call — never a language model. The AI rewrites them into plain
            English and answers your questions, but it can&apos;t invent a
            threshold. That&apos;s our safety posture, and our trust story.
          </p>
        </section>

        {/* PILLARS */}
        <section className="mx-auto max-w-[1100px] px-[22px] md:px-10 pb-5 pt-6">
          <div className="grid gap-[18px] md:grid-cols-2">
            {PILLARS.map((pillar) => (
              <div
                key={pillar.tag}
                data-reveal=""
                className="rounded-card border border-hairline-soft bg-surface p-7"
              >
                <div className="mb-[14px] font-mono text-[11px] tracking-[0.1em] text-forest">
                  {pillar.tag}
                </div>
                <h2 className="mb-[10px] mt-0 text-xl font-bold tracking-[-0.01em]">
                  {pillar.title}
                </h2>
                <p className="m-0 text-[15px] leading-[1.6] text-muted">
                  {pillar.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* RCV EXPLAINER */}
        <section className="mt-10 bg-ink px-[22px] md:px-10 py-20 text-bone-white">
          <div className="mx-auto max-w-[1000px]">
            <div className="mb-4 font-mono text-xs tracking-[0.14em] text-vitality-light">
              REFERENCE CHANGE VALUE
            </div>
            <h2
              data-reveal=""
              className="mb-[18px] mt-0 max-w-[22ch] font-serif text-4xl font-normal tracking-[-0.01em]"
            >
              Was it a real change, or was it just noise?
            </h2>
            <p className="mb-7 mt-0 max-w-[64ch] text-base leading-[1.65] text-muted-dark">
              Every test has analytical variation (the lab) and biological
              variation (you, day to day). A number that ticks from 56 to 58
              hasn&apos;t necessarily moved. Reference Change Value is the
              threshold a marker must cross before we&apos;ll call the
              difference real — so we never celebrate noise or scare you with
              it.
            </p>
            <div className="grid items-center gap-6 rounded-2xl bg-[rgba(255,255,255,0.05)] p-[26px] md:grid-cols-2">
              <div className="font-mono text-lg leading-[2] text-vitality-faint">
                RCV = √2 · Z · √(CVa² + CVi²)
              </div>
              <div className="text-[13.5px] leading-[1.7] text-muted-dark">
                <strong className="text-bone-white">CVa</strong> — analytical
                variation of the assay
                <br />
                <strong className="text-bone-white">CVi</strong> — your
                within-person biological variation
                <br />
                <strong className="text-bone-white">Z</strong> — confidence
                (1.96 for 95%)
              </div>
            </div>
            <div className="mt-[22px] flex flex-wrap gap-3">
              {VERDICT_PILLS.map((pill) => (
                <span
                  key={pill.label}
                  className={`rounded-pill px-[13px] py-[7px] font-mono text-[11px] ${pill.className}`}
                >
                  {pill.label}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* EVIDENCE / MARKERS */}
        <section className="px-[22px] md:px-10 py-20">
          <div className="mx-auto max-w-[1000px]">
            <h2
              data-reveal=""
              className="mb-3 mt-0 font-serif text-[34px] font-normal tracking-[-0.01em]"
            >
              Why these markers
            </h2>
            <p className="mb-8 mt-0 max-w-[60ch] text-base text-muted">
              We prioritise markers with the strongest outcome evidence over
              the familiar ones. A few examples of the reasoning behind the
              panel:
            </p>
            <div className="flex flex-col gap-[14px]">
              {MARKERS.map((marker) => (
                <div
                  key={marker.name}
                  data-reveal=""
                  className="grid items-baseline gap-5 rounded-2xl border border-hairline-soft bg-surface px-6 py-[22px] md:grid-cols-[160px_1fr]"
                >
                  <div className="text-base font-bold">{marker.name}</div>
                  <p className="m-0 text-[14.5px] leading-[1.6] text-muted">
                    {marker.why}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* SAFETY BAR */}
        <section className="border-t border-hairline-soft bg-surface px-[22px] md:px-10 py-[60px]">
          <div className="mx-auto max-w-[900px] text-center">
            <h2
              data-reveal=""
              className="mb-[14px] mt-0 font-serif text-[30px] font-normal"
            >
              Wellness &amp; optimisation — not diagnosis
            </h2>
            <p className="mx-auto mb-[22px] mt-0 max-w-[60ch] text-[15.5px] leading-[1.6] text-muted">
              Arcaevo is built for healthy people who want to stay that way.
              When a result crosses a clinical threshold, we don&apos;t coach
              it — we flag it to our reviewing clinician and tell you, plainly,
              to see your GP. Read our clinical safety statement for the full
              escalation policy.
            </p>
            <Link
              href="/legal/clinical-safety"
              className="inline-block rounded-pill border border-ink px-[26px] py-[13px] font-semibold text-ink no-underline"
            >
              Clinical safety statement →
            </Link>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
