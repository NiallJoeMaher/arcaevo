import type { Metadata } from "next";
import { routeMetadata } from "@/lib/seo";
import Link from "next/link";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";

export const metadata: Metadata = routeMetadata({
  path: "/how-it-works",
  title: "How it works",
  description:
    "From a drop of blood to a two-line plan. Four steps: you test, we fuse and interpret, you get a short list of what to change, and at your next test we tell you whether it worked.",
});

const STEPS = [
  {
    n: "01",
    title: "Order & test",
    body: "Pick a finger-prick kit posted to your door, or book an in-home venous draw where a phlebotomist comes to you. Fasting reminders arrive on your Watch the night before.",
    meta: "15–80 MARKERS · IRELAND-WIDE · 5–7 DAY TURNAROUND",
  },
  {
    n: "02",
    title: "Fuse & interpret",
    body: "Your results are matched to your wearable history and read against your own baseline, not just the population range. A registered clinician signs off every panel before you see it.",
    meta: "DETERMINISTIC RULES · CLINICIAN-REVIEWED",
  },
  {
    n: "03",
    title: "Get your two levers",
    body: "Not forty numbers — a ranked shortlist. Usually one or two changes that move the markers that matter most for you right now, written in plain English by the coach.",
    meta: "PRIORITISED · PERSONAL · ACTIONABLE",
  },
  {
    n: "04",
    title: "Close the loop",
    body: "Log the change. At your next test we compare against Reference Change Value and tell you plainly: real improvement, within noise, or needs a retest. No guessing whether it worked.",
    meta: "“DID IT WORK?” VERDICTS · RCV-BASED",
  },
];

const OUTPUTS = [
  {
    t: "A single Health Score",
    d: "One number that captures where you stand, with the biological age it implies and what moved it since last time.",
  },
  {
    t: "Every marker, in its optimal band",
    d: "Not just ‘normal’ — the tighter optimal range, with a plain-English note on why each marker matters.",
  },
  {
    t: "Five-systems view",
    d: "Cardiovascular, metabolic, nutrients, inflammation and hormonal — each rated optimal, watch or discuss.",
  },
  {
    t: "A coach that knows your data",
    d: "Ask anything about your results. Answers are grounded in your numbers and the rules, never invented.",
  },
];

function FusionExplainerChart() {
  return (
    <div className="rounded-card bg-[rgba(255,255,255,0.05)] p-[26px]">
      <div className="mb-2 font-mono text-[11px] tracking-[0.1em] text-muted-dark-soft">
        hs-CRP vs HRV · 12 MONTHS
      </div>
      <svg viewBox="0 0 300 150" aria-hidden="true" className="block h-auto w-full">
        <rect x="0" y="58" width="300" height="40" rx="6" fill="rgba(52,160,124,0.16)" />
        <polyline
          points="6,110 56,104 106,86 156,90 206,70 256,52 294,44"
          fill="none"
          stroke="#34A07C"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <polyline
          points="20,74 90,66 160,104 230,98 288,118"
          fill="none"
          stroke="#F4F1EA"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <circle cx="20" cy="74" r="4.5" fill="#D99A4E" />
        <circle cx="90" cy="66" r="4.5" fill="#D99A4E" />
        <circle cx="160" cy="104" r="4.5" fill="#34A07C" />
        <circle cx="230" cy="98" r="4.5" fill="#34A07C" />
        <circle cx="288" cy="118" r="4.5" fill="#34A07C" />
      </svg>
      <div className="mt-[14px] rounded-xl bg-[rgba(52,160,124,0.14)] p-[13px] text-[13px] leading-[1.5] text-vitality-faint">
        As HRV climbed back to baseline,{" "}
        <strong className="text-white">hs-CRP fell 2.1 → 0.6</strong>. Same
        story, told once.
      </div>
    </div>
  );
}

export default function HowItWorksPage() {
  return (
    <div className="w-full overflow-x-hidden bg-bone font-sans text-ink">
      <SiteNav active="how" />

      <main>
        {/* HERO */}
        <section className="mx-auto max-w-[900px] px-10 pb-12 pt-[72px] text-center">
          <div className="mb-5 font-mono text-xs tracking-[0.14em] text-forest">
            HOW IT WORKS
          </div>
          <h1 className="mb-[22px] mt-0 font-serif text-[clamp(38px,5vw,58px)] font-normal leading-[1.04] tracking-[-0.015em]">
            From a drop of blood to a two-line plan.
          </h1>
          <p className="mx-auto my-0 max-w-[56ch] text-[19px] leading-[1.55] text-muted">
            Four steps. You test, we fuse and interpret, you get a short list
            of what to change, and at your next test we tell you whether it
            worked.
          </p>
        </section>

        {/* STEP DETAIL */}
        <section className="mx-auto flex max-w-[1000px] flex-col gap-5 px-10 pb-10 pt-8">
          {STEPS.map((step) => (
            <div
              key={step.n}
              className="grid items-start gap-7 rounded-card-lg border border-hairline-soft bg-surface p-[34px] md:grid-cols-[120px_1fr]"
            >
              <div className="font-serif text-[64px] leading-[0.9] text-forest">
                {step.n}
              </div>
              <div>
                <h2 className="mb-[10px] mt-0 text-2xl font-bold tracking-[-0.01em]">
                  {step.title}
                </h2>
                <p className="mb-4 mt-0 max-w-[62ch] text-base leading-[1.6] text-muted">
                  {step.body}
                </p>
                <div className="font-mono text-xs tracking-[0.04em] text-forest">
                  {step.meta}
                </div>
              </div>
            </div>
          ))}
        </section>

        {/* FUSION EXPLAINER */}
        <section className="mt-10 bg-ink px-10 py-20 text-bone-white">
          <div className="mx-auto grid max-w-[1000px] items-center gap-12 lg:grid-cols-2">
            <div>
              <div className="mb-4 font-mono text-xs tracking-[0.14em] text-vitality-light">
                THE FUSION ENGINE
              </div>
              <h2 className="mb-[18px] mt-0 font-serif text-4xl font-normal tracking-[-0.01em]">
                Bloods explain the trend. Wearables explain the blood.
              </h2>
              <p className="mb-4 mt-0 text-base leading-[1.6] text-muted-dark">
                A single blood draw is a snapshot. Your wearable is a film. We
                overlay them so a spike in hs-CRP lines up with the week your
                HRV collapsed — and a rising HbA1c sits next to your falling
                step count.
              </p>
              <p className="m-0 text-base leading-[1.6] text-muted-dark">
                Deterministic rules — written from the clinical literature —
                decide every call. The AI only turns those rules into plain
                English. It can&apos;t invent a threshold.
              </p>
              <Link
                href="/science"
                className="mt-[22px] inline-block font-semibold text-vitality-light no-underline"
              >
                How the rules engine works →
              </Link>
            </div>
            <FusionExplainerChart />
          </div>
        </section>

        {/* WHAT YOU GET */}
        <section className="px-10 py-20">
          <div className="mx-auto max-w-[1000px]">
            <h2 className="mb-9 mt-0 text-center font-serif text-4xl font-normal tracking-[-0.01em]">
              What lands in your app
            </h2>
            <div className="grid gap-[18px] md:grid-cols-2">
              {OUTPUTS.map((output) => (
                <div
                  key={output.t}
                  className="rounded-[18px] border border-hairline-soft bg-surface p-6"
                >
                  <h3 className="mb-2 mt-0 text-[17px] font-bold">
                    {output.t}
                  </h3>
                  <p className="m-0 text-[14.5px] leading-[1.55] text-muted">
                    {output.d}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-11 text-center">
              <Link
                href="/pricing"
                className="inline-block rounded-pill bg-forest px-[30px] py-[15px] text-base font-semibold text-white no-underline"
              >
                Choose your test →
              </Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
