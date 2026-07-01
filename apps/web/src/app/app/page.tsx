import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";

export const metadata: Metadata = {
  title: "The app",
  description:
    "Your trends, in your pocket and on your wrist. Bloods fused with sleep, HRV and VO₂max on one timeline. The phone leads with synthesis; the Watch shows only the one action that matters now.",
};

const FEATURES = [
  {
    tag: "HOME",
    t: "Lead with synthesis",
    d: "Not forty numbers on arrival — one Health Score, one focus, and the top three things to do first, ranked for you.",
  },
  {
    tag: "FUSION",
    t: "One timeline for everything",
    d: "Blood draws plotted over the wearable signal that explains them. See the story, not two disconnected charts.",
  },
  {
    tag: "COACH",
    t: "Ask your data anything",
    d: "A conversational coach grounded in your results and the rules. ‘Why not statins?’, ‘What’s ApoB?’ — answered plainly.",
  },
  {
    tag: "LOOP",
    t: "“Did it work?” verdicts",
    d: "Log a change; at your next test we tell you whether the marker really moved, or whether it was within test noise.",
  },
  {
    tag: "WATCH",
    t: "One action on the wrist",
    d: "A baseline complication, one-tap quick-log for supplements and workouts, and a next-test countdown — never a dashboard squeezed onto a watch face.",
  },
  {
    tag: "PRIVACY",
    t: "Export or delete in a tap",
    d: "Your data, EU-hosted and never sold. Share a clinician PDF with your GP, or erase everything permanently, whenever you like.",
  },
];

function PhoneMock() {
  return (
    <div className="h-[470px] w-[230px] rounded-[40px] bg-ink p-2 shadow-[0_30px_60px_-30px_rgba(28,38,32,0.55)]">
      <div className="h-full w-full overflow-hidden rounded-[33px] bg-ink px-[18px] pt-6 text-bone-white">
        <div className="mb-[14px] font-mono text-[10px] tracking-[0.1em] text-muted-dark-soft">
          GOOD MORNING, AOIFE
        </div>
        <div className="mb-[18px] flex items-center gap-[14px]">
          <svg viewBox="0 0 120 120" className="h-[86px] w-[86px]">
            <circle
              cx="60"
              cy="60"
              r="50"
              fill="none"
              stroke="rgba(255,255,255,0.1)"
              strokeWidth="10"
            />
            <circle
              cx="60"
              cy="60"
              r="50"
              fill="none"
              stroke="#34A07C"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray="314"
              strokeDashoffset="60"
              transform="rotate(-90 60 60)"
            />
          </svg>
          <div className="-ml-[74px] w-[86px] text-center">
            <div className="font-mono text-[26px] font-medium leading-none">
              81
            </div>
            <div className="text-[8px] text-muted-dark-soft">HEALTH SCORE</div>
          </div>
        </div>
        <div className="mb-[10px] rounded-[14px] bg-[rgba(255,255,255,0.06)] p-[13px]">
          <div className="mb-[6px] font-mono text-[9px] tracking-[0.1em] text-muted-dark-soft">
            FOCUS THIS WEEK
          </div>
          <div className="text-sm font-semibold leading-[1.3]">
            Add a 20-min walk after dinner
          </div>
        </div>
        <div className="rounded-[14px] bg-[rgba(255,255,255,0.06)] p-[13px]">
          <div className="mb-2 font-mono text-[9px] tracking-[0.1em] text-muted-dark-soft">
            VO₂ MAX + APOB
          </div>
          <svg viewBox="0 0 220 60" className="h-12 w-full">
            <polyline
              points="6,50 46,46 86,36 126,38 166,26 200,18 214,14"
              fill="none"
              stroke="#34A07C"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <polyline
              points="6,36 46,38 86,40 126,34 166,36 200,42 214,46"
              fill="none"
              stroke="#D99A4E"
              strokeWidth="2.5"
              strokeDasharray="2 4"
              strokeLinecap="round"
            />
          </svg>
        </div>
      </div>
    </div>
  );
}

function WatchMock() {
  return (
    <div className="mb-9 h-[146px] w-[120px] rounded-[34px] bg-ink p-2 shadow-[0_18px_36px_-20px_rgba(28,38,32,0.5)]">
      <div className="h-full w-full overflow-hidden rounded-[28px] bg-black px-3 pt-[14px] text-bone-white">
        <div className="mb-2 text-[10px] font-semibold text-vitality">
          Arcaevo
        </div>
        <div className="mb-[5px] font-mono text-[7px] tracking-[0.1em] text-muted-dark-soft">
          FOCUS
        </div>
        <div className="mb-[10px] text-[13px] font-semibold leading-[1.2]">
          Walk 20 min
        </div>
        <div className="rounded-[9px] bg-[rgba(52,160,124,0.16)] px-2 py-[6px] text-[9px] text-vitality-light">
          Targets HbA1c
        </div>
      </div>
    </div>
  );
}

export default function AppPage() {
  return (
    <div className="w-full overflow-x-hidden bg-bone font-sans text-ink">
      <SiteNav active="app" />

      <main>
        {/* HERO */}
        <section className="mx-auto grid max-w-[1180px] items-center gap-12 px-10 pb-10 pt-16 lg:grid-cols-2">
          <div>
            <div className="mb-5 font-mono text-xs tracking-[0.14em] text-forest">
              THE APP · iOS &amp; APPLE WATCH
            </div>
            <h1 className="mb-5 mt-0 font-serif text-[clamp(38px,5vw,56px)] font-normal leading-[1.04] tracking-[-0.015em]">
              Your trends, in your pocket and on your wrist.
            </h1>
            <p className="mb-7 mt-0 max-w-[44ch] text-lg leading-[1.6] text-muted">
              Bloods fused with sleep, HRV and VO₂max on one timeline. The
              phone leads with synthesis; the Watch shows only the one action
              that matters now.
            </p>
            <div className="mb-7 flex flex-wrap gap-[10px] font-mono text-xs text-muted">
              <span className="rounded-pill border border-hairline-strong px-[14px] py-2">
                Apple Watch
              </span>
              <span className="rounded-pill border border-hairline-strong px-[14px] py-2">
                Apple Health
              </span>
              <span className="rounded-pill border border-hairline-strong px-[14px] py-2">
                iPhone
              </span>
              <span className="rounded-pill border border-dashed border-[rgba(28,38,32,0.2)] px-[14px] py-2 text-[#9AA39C]">
                WHOOP · Oura · Garmin — soon
              </span>
            </div>
            <Link
              href="/pricing"
              className="inline-block rounded-pill bg-forest px-7 py-[15px] text-base font-semibold text-white no-underline"
            >
              Get started
            </Link>
          </div>
          <div
            aria-hidden="true"
            className="flex items-end justify-center gap-5"
          >
            <PhoneMock />
            <WatchMock />
          </div>
        </section>

        {/* FEATURE GRID */}
        <section className="px-10 py-[60px]">
          <div className="mx-auto max-w-[1100px]">
            <div className="grid gap-[18px] md:grid-cols-3">
              {FEATURES.map((feature) => (
                <div
                  key={feature.tag}
                  className="rounded-[18px] border border-hairline-soft bg-surface p-6"
                >
                  <div className="mb-3 font-mono text-[11px] tracking-[0.1em] text-forest">
                    {feature.tag}
                  </div>
                  <h3 className="mb-2 mt-0 text-[17px] font-bold">
                    {feature.t}
                  </h3>
                  <p className="m-0 text-sm leading-[1.55] text-muted">
                    {feature.d}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="px-10 pb-[90px] pt-5">
          <div className="mx-auto max-w-[900px] rounded-card-xl bg-forest px-10 py-14 text-center text-white">
            <h2 className="mb-3 mt-0 font-serif text-4xl font-normal tracking-[-0.01em]">
              Free to download. Yours the moment you test.
            </h2>
            <p className="mb-[26px] mt-0 text-base text-vitality-faint">
              The app comes with every plan — Fusion, Essential and
              Performance.
            </p>
            <Link
              href="/pricing"
              className="inline-block rounded-pill bg-bone-white px-8 py-[15px] text-base font-semibold text-ink no-underline"
            >
              See plans &amp; pricing
            </Link>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
