import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";
import {
  jsonLd,
  organizationJsonLd,
  membershipProductJsonLd,
  routeMetadata,
} from "@/lib/seo";
import { getServerMessages } from "@/i18n/server";

export const metadata: Metadata = routeMetadata({ path: "/" });

/* ── Hero visual: health-score ring + ApoB band + insight chip ── */

function HeroScoreCard() {
  return (
    <div
      aria-hidden="true"
      className="rounded-card-xl bg-ink p-[26px] text-bone-white shadow-hero-card"
    >
      <div className="mb-[22px] flex items-center gap-[18px]">
        <svg viewBox="0 0 120 120" className="h-24 w-24">
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
        <div className="-ml-[84px] w-24 text-center">
          <div className="font-mono text-[30px] font-medium leading-none">
            81
          </div>
          <div className="text-[9px] tracking-[0.08em] text-muted-dark-soft">
            HEALTH SCORE
          </div>
        </div>
        <div className="ml-1">
          <div className="text-[13px] text-muted-dark-soft">Up 4 pts</div>
          <div className="text-[13px] text-muted-dark-soft">this quarter</div>
        </div>
      </div>
      <div className="mb-3 rounded-2xl bg-[rgba(255,255,255,0.06)] p-[15px]">
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-sm font-semibold">ApoB</span>
          <span className="font-mono text-[13px]">0.74 g/L</span>
        </div>
        <div className="relative h-[9px] rounded-pill bg-[linear-gradient(90deg,#E8C58A_0%,#E8C58A_16%,#9AD3B8_30%,#9AD3B8_70%,#E8C58A_84%,#E8C58A_100%)]">
          <div className="absolute left-[40%] top-1/2 h-[14px] w-[14px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white" />
        </div>
      </div>
      <div className="flex items-center gap-[10px] rounded-2xl bg-[rgba(52,160,124,0.16)] p-[14px]">
        <span className="text-base text-vitality-light">✦</span>
        <span className="text-[13px] text-[#BFE6D3]">
          HRV down 15% on baseline → focus: walk after dinner
        </span>
      </div>
    </div>
  );
}

/* ── Differentiator card visuals (inline SVG/CSS, decorative) ── */

function FusionChart() {
  return (
    <svg
      viewBox="0 0 240 70"
      aria-hidden="true"
      className="mb-[18px] h-[60px] w-full"
    >
      <rect x="0" y="26" width="240" height="22" rx="4" fill="rgba(52,160,124,0.16)" />
      <polyline
        points="6,52 66,46 126,34 186,24 232,18"
        fill="none"
        stroke="#34A07C"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <polyline
        points="18,40 90,34 162,52 224,48"
        fill="none"
        stroke="#F4F1EA"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <circle cx="18" cy="40" r="4" fill="#F4F1EA" />
      <circle cx="162" cy="52" r="4" fill="#F4F1EA" />
    </svg>
  );
}

function BaselineBars() {
  const bars = [
    { height: "38%", highlight: false },
    { height: "52%", highlight: false },
    { height: "44%", highlight: false },
    { height: "70%", highlight: true },
    { height: "60%", highlight: false },
    { height: "48%", highlight: false },
  ];
  return (
    <div
      aria-hidden="true"
      className="mb-[18px] flex h-[60px] items-end gap-[5px]"
    >
      {bars.map((bar, i) => (
        <div
          key={i}
          style={{ height: bar.height }}
          className={`flex-1 rounded-[3px] ${
            bar.highlight ? "bg-vitality" : "bg-[rgba(255,255,255,0.15)]"
          }`}
        />
      ))}
    </div>
  );
}

function LoopVisual() {
  return (
    <div
      aria-hidden="true"
      className="mb-[18px] flex h-[60px] items-center gap-2"
    >
      <span className="font-mono text-sm text-muted-dark">0.92</span>
      <span className="text-lg text-vitality">→</span>
      <span className="font-mono text-lg font-semibold text-white">0.74</span>
      <span className="ml-auto rounded-pill bg-[rgba(52,160,124,0.2)] px-[9px] py-1 font-mono text-[9px] text-vitality-light">
        REAL ✓
      </span>
    </div>
  );
}

function EuPills() {
  const pills = ["DUBLIN REGION", "GDPR-NATIVE", "CONSENT YOU CONTROL"];
  return (
    <div className="mb-[18px] flex h-[60px] flex-wrap items-center gap-2">
      {pills.map((pill) => (
        <span
          key={pill}
          className="rounded-pill border border-[rgba(127,211,174,0.3)] px-3 py-[7px] font-mono text-[10px] tracking-[0.08em] text-vitality-light"
        >
          {pill}
        </span>
      ))}
    </div>
  );
}

function WatchVisual() {
  return (
    <div
      aria-hidden="true"
      className="mb-[18px] flex h-[60px] items-center gap-[14px]"
    >
      <div className="h-[60px] w-[52px] shrink-0 rounded-[14px] border-2 border-[rgba(255,255,255,0.18)] bg-black px-[7px] py-2">
        <div className="mb-[3px] text-[6px] font-semibold text-vitality">
          Arcaevo
        </div>
        <div className="font-mono text-[13px] font-medium leading-none text-bone-white">
          +4
        </div>
        <div className="mt-[2px] text-[5px] text-muted-dark-soft">
          VS BASELINE
        </div>
      </div>
      <div className="flex flex-col gap-[6px]">
        <span className="font-mono text-[10px] text-muted-dark">
          BASELINE COMPLICATION
        </span>
        <span className="font-mono text-[10px] text-muted-dark">
          ONE-TAP QUICK-LOG
        </span>
        <span className="font-mono text-[10px] text-muted-dark">
          NEXT-TEST COUNTDOWN
        </span>
      </div>
    </div>
  );
}

/* ── Credibility: honest trust signals a brand-new health brand can make.
   No testimonials, ratings or member counts — every line below is verifiable
   today (method, EU residency, clinician sign-off, the hardware you own). ── */
const TRUST_SIGNALS: {
  index: string;
  label: string;
  title: string;
  body: ReactNode;
}[] = [
  {
    index: "01",
    label: "YOUR OWN BASELINE",
    title: "Judged against your own noise",
    body: (
      <>
        Every result is read against your own biological baseline and the
        test&rsquo;s own margin of error — the Reference Change Value — not a
        one-size population range. If a shift is smaller than the noise, we say
        so instead of alarming you.
      </>
    ),
  },
  {
    index: "02",
    label: "CLINICIAN-REVIEWED",
    title: "A registered clinician signs every panel",
    body: (
      <>
        Before a result reaches you, a registered clinician reviews and signs it
        off. Wellness insight, never diagnosis — and if something warrants your
        GP, we say so plainly.
      </>
    ),
  },
  {
    index: "03",
    label: "EU-NATIVE BY DESIGN",
    title: "Hosted, encrypted, and yours to delete",
    body: (
      <>
        Your data lives in the EU under GDPR, encrypted, and processed only with
        consent you can withdraw. Export everything, or delete everything, in a
        tap — no email, no wait.
      </>
    ),
  },
  {
    index: "04",
    label: "WELLNESS, NOT DIAGNOSIS",
    title: "Honest about what we are",
    body: (
      <>
        Arcaevo is a wellness membership, not a medical device. We publish our
        method, show the workings behind every insight, and tell you at your
        next test whether a change actually worked — or was just noise.
      </>
    ),
  },
  {
    index: "05",
    label: "FOUNDING COHORT",
    title: "Brand new, and honest about it",
    body: (
      <>
        We&rsquo;re just getting started — so no borrowed testimonials or
        invented ratings. Join the founding cohort in Dublin and help shape what
        we build next.
      </>
    ),
  },
  {
    index: "06",
    label: "NO NEW HARDWARE",
    title: "The Apple Watch you already own",
    body: (
      <>
        No €200 ring, no proprietary band. An at-home finger-prick and the watch
        on your wrist — that&rsquo;s the whole kit, working from day one.
      </>
    ),
  },
];

export default async function Home() {
  // Reading request headers here opts this page into per-request (dynamic)
  // rendering so US visitors get American spelling; EU/IE visitors get the
  // en-IE default. See docs/LOCALIZATION.md for the static-vs-dynamic trade-off.
  const { locale, m } = await getServerMessages();
  const h = m.home;
  return (
    <div className="w-full overflow-x-hidden bg-bone font-sans text-ink">
      <SiteNav active="home" locale={locale} />

      <main>
        {/* HERO */}
        <section className="mx-auto max-w-[1180px] px-10 pb-[72px] pt-16">
          <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
            <div>
              <div className="mb-[22px] font-mono text-xs tracking-[0.14em] text-forest">
                {h.hero.eyebrow}
              </div>
              <h1 className="mb-[22px] mt-0 font-serif text-[clamp(40px,5.4vw,62px)] font-normal leading-[1.02] tracking-[-0.015em]">
                {h.hero.title}
              </h1>
              <p className="mb-[34px] mt-0 max-w-[46ch] text-[19px] leading-[1.55] text-muted">
                {h.hero.lead}
              </p>
              <div className="flex flex-wrap items-center gap-[14px]">
                <Link
                  href="/pricing"
                  className="rounded-pill bg-forest px-7 py-[15px] text-base font-semibold text-white no-underline"
                >
                  {h.hero.ctaPrimary}
                </Link>
                <Link
                  href="/how-it-works"
                  className="text-[15px] font-semibold text-ink no-underline"
                >
                  {h.hero.ctaSecondary}
                </Link>
              </div>
              <div className="mt-[34px] flex flex-wrap gap-[10px] font-mono text-[11px] text-muted">
                <span className="rounded-pill border border-hairline-strong px-[14px] py-2">
                  {h.hero.badgeLabs}
                </span>
                <span className="rounded-pill border border-hairline-strong px-[14px] py-2">
                  {h.hero.badgeClinician}
                </span>
                <span className="rounded-pill border border-hairline-strong px-[14px] py-2">
                  {h.hero.badgeGdpr}
                </span>
              </div>
            </div>
            <HeroScoreCard />
          </div>
        </section>

        {/* LOGO STRIP / TRUST */}
        <section className="border-y border-hairline-soft bg-surface">
          <div className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-5 px-10 py-[26px]">
            <span className="font-mono text-[11px] tracking-[0.12em] text-caption">
              {h.logoStrip.builtFor}
            </span>
            <div className="flex flex-wrap items-baseline gap-[30px] text-base font-semibold text-muted">
              <span>{h.logoStrip.appleWatch}</span>
              <span>{h.logoStrip.appleHealth}</span>
              <span>{h.logoStrip.iphone}</span>
              <span className="text-[13px] font-medium text-[#6C756E]">
                {h.logoStrip.roadmap}
              </span>
            </div>
            <Link
              href="/science"
              className="font-mono text-[11px] tracking-[0.1em] text-forest no-underline"
            >
              {h.logoStrip.readScience}
            </Link>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="bg-surface px-10 py-[84px]">
          <div className="mx-auto max-w-[1180px]">
            <div className="mb-[54px] text-center">
              <div className="mb-[14px] font-mono text-xs tracking-[0.14em] text-forest">
                {h.howItWorks.eyebrow}
              </div>
              <h2 className="m-0 font-serif text-[42px] font-normal tracking-[-0.01em]">
                {h.howItWorks.title}
              </h2>
            </div>
            <div className="grid gap-7 md:grid-cols-3">
              <div>
                <div className="mb-4 font-mono text-[13px] text-forest">01</div>
                <h3 className="mb-[10px] mt-0 text-[21px] font-bold">
                  {h.howItWorks.step1Title}
                </h3>
                <p className="mb-4 mt-0 text-[15px] leading-[1.55] text-muted">
                  {h.howItWorks.step1Body}
                </p>
                <div className="flex gap-2">
                  <span className="rounded-pill bg-[rgba(28,38,32,0.05)] px-[10px] py-[5px] font-mono text-[11px] text-muted">
                    {h.howItWorks.step1PillA}
                  </span>
                  <span className="rounded-pill bg-[rgba(30,92,69,0.1)] px-[10px] py-[5px] font-mono text-[11px] text-forest">
                    {h.howItWorks.step1PillB}
                  </span>
                </div>
              </div>
              <div>
                <div className="mb-4 font-mono text-[13px] text-forest">02</div>
                <h3 className="mb-[10px] mt-0 text-[21px] font-bold">
                  {h.howItWorks.step2Title}
                </h3>
                <p className="m-0 text-[15px] leading-[1.55] text-muted">
                  {h.howItWorks.step2Body}
                </p>
              </div>
              <div>
                <div className="mb-4 font-mono text-[13px] text-forest">03</div>
                <h3 className="mb-[10px] mt-0 text-[21px] font-bold">
                  {h.howItWorks.step3Title}
                </h3>
                <p className="m-0 text-[15px] leading-[1.55] text-muted">
                  {h.howItWorks.step3Body}
                </p>
              </div>
            </div>
            <div className="mt-11 text-center">
              <Link
                href="/how-it-works"
                className="text-[15px] font-semibold text-forest no-underline"
              >
                {h.howItWorks.walkthrough}
              </Link>
            </div>
          </div>
        </section>

        {/* DIFFERENTIATORS */}
        <section className="bg-ink px-10 py-[84px] text-bone-white">
          <div className="mx-auto max-w-[1180px]">
            <div className="mb-[52px] max-w-[62ch]">
              <div className="mb-[14px] font-mono text-xs tracking-[0.14em] text-vitality-light">
                {h.differentiators.eyebrow}
              </div>
              <h2 className="mb-[14px] mt-0 font-serif text-[42px] font-normal tracking-[-0.01em]">
                {h.differentiators.title}
              </h2>
              <p className="m-0 text-base leading-[1.6] text-muted-dark">
                {h.differentiators.intro}
              </p>
            </div>
            <div className="grid gap-6 md:grid-cols-6">
              <div className="rounded-card bg-[rgba(255,255,255,0.05)] p-[26px] md:col-span-2">
                <div className="mb-[18px] font-mono text-[11px] tracking-[0.1em] text-vitality-light">
                  01 · FUSION
                </div>
                <FusionChart />
                <h3 className="mb-2 mt-0 text-lg font-bold">
                  Bloods &amp; your Apple Watch, one line
                </h3>
                <p className="m-0 text-sm leading-[1.55] text-muted-dark">
                  Your rising resting HR and your falling vitamin D, on the
                  same timeline. We connect the dots no one else does.
                </p>
              </div>
              <div className="rounded-card bg-[rgba(255,255,255,0.05)] p-[26px] md:col-span-2">
                <div className="mb-[18px] font-mono text-[11px] tracking-[0.1em] text-vitality-light">
                  02 · YOUR BASELINE
                </div>
                <BaselineBars />
                <h3 className="mb-2 mt-0 text-lg font-bold">
                  Off your own normal
                </h3>
                <p className="m-0 text-sm leading-[1.55] text-muted-dark">
                  &ldquo;Within range&rdquo; is useless. We flag what moved
                  against <em>your</em> history, beyond test noise — using
                  Reference Change Value.
                </p>
              </div>
              <div className="rounded-card bg-[rgba(255,255,255,0.05)] p-[26px] md:col-span-2">
                <div className="mb-[18px] font-mono text-[11px] tracking-[0.1em] text-vitality-light">
                  03 · THE LOOP
                </div>
                <LoopVisual />
                <h3 className="mb-2 mt-0 text-lg font-bold">
                  Did it actually work?
                </h3>
                <p className="m-0 text-sm leading-[1.55] text-muted-dark">
                  Log a change; we tie it to the marker and tell you, at your
                  next test, whether it really moved — or it was just noise.
                </p>
              </div>
              <div className="rounded-card bg-[rgba(255,255,255,0.05)] p-[26px] md:col-span-3">
                <div className="mb-[18px] font-mono text-[11px] tracking-[0.1em] text-vitality-light">
                  04 · EU-NATIVE
                </div>
                <EuPills />
                <h3 className="mb-2 mt-0 text-lg font-bold">
                  Your data never leaves the EU
                </h3>
                <p className="m-0 text-sm leading-[1.55] text-muted-dark">
                  Function, Superpower, Ultrahuman and WHOOP are US-based. Your
                  health data stays in Dublin, under explicit consent you can
                  withdraw — and export or delete in a tap.
                </p>
              </div>
              <div className="rounded-card bg-[rgba(255,255,255,0.05)] p-[26px] md:col-span-3">
                <div className="mb-[18px] font-mono text-[11px] tracking-[0.1em] text-vitality-light">
                  05 · ON YOUR WRIST
                </div>
                <WatchVisual />
                <h3 className="mb-2 mt-0 text-lg font-bold">
                  A real Apple Watch app
                </h3>
                <p className="m-0 text-sm leading-[1.55] text-muted-dark">
                  Most blood memberships have no watch app at all. We put your
                  baseline on your wrist — plus one-tap logging that feeds your
                  experiments.
                </p>
              </div>
            </div>
            <div className="mt-11 flex flex-wrap gap-5">
              <Link
                href="/compare"
                className="text-[15px] font-semibold text-vitality-light no-underline"
              >
                {h.differentiators.compareCta}
              </Link>
            </div>
          </div>
        </section>

        {/* PRICING TEASER */}
        <section className="px-10 py-[84px]">
          <div className="mx-auto max-w-[1180px]">
            <div className="mb-[52px] text-center">
              <div className="mb-[14px] font-mono text-xs tracking-[0.14em] text-forest">
                {h.pricingTeaser.eyebrow}
              </div>
              <h2 className="m-0 font-serif text-[42px] font-normal tracking-[-0.01em]">
                {h.pricingTeaser.title}
              </h2>
            </div>
            <div className="grid items-stretch gap-[22px] md:grid-cols-3">
              <Link
                href="/pricing"
                className="block rounded-card-lg border border-hairline bg-surface p-[30px] text-inherit no-underline"
              >
                <div className="mb-[6px] text-lg font-bold">Fusion</div>
                <div className="mb-5 text-[13px] text-caption">
                  Your watch &amp; your own bloodwork
                </div>
                <div className="font-serif text-[46px] leading-none">
                  €119
                  <span className="font-sans text-base text-caption">/yr</span>
                </div>
                <div className="my-[22px] h-px bg-hairline" />
                <div className="text-sm leading-[2] text-muted">
                  Apple Watch &amp; Health sync
                  <br />
                  Upload any past bloodwork
                  <br />
                  Baselines, insights &amp; the loop
                </div>
              </Link>
              <Link
                href="/pricing"
                className="relative block rounded-card-lg bg-ink p-[30px] text-bone-white no-underline shadow-card-dark"
              >
                <div className="absolute right-[22px] top-[22px] rounded-pill bg-vitality px-[9px] py-1 font-mono text-[10px] tracking-[0.06em] text-[#04130D]">
                  MOST POPULAR
                </div>
                <div className="mb-[6px] text-lg font-bold">Essential</div>
                <div className="mb-5 text-[13px] text-muted-dark-soft">
                  Two blood tests a year
                </div>
                <div className="font-serif text-[46px] leading-none">
                  €329
                  <span className="font-sans text-base text-muted-dark-soft">
                    /yr
                  </span>
                </div>
                <div className="my-[22px] h-px bg-hairline-dark" />
                <div className="text-sm leading-[2] text-[#CFD6CF]">
                  Full baseline + recheck kits
                  <br />
                  Clinician-reviewed results
                  <br />
                  Everything in Fusion
                </div>
              </Link>
              <Link
                href="/pricing"
                className="block rounded-card-lg border border-hairline bg-surface p-[30px] text-inherit no-underline"
              >
                <div className="mb-[6px] text-lg font-bold">Performance</div>
                <div className="mb-5 text-[13px] text-caption">
                  Deep venous panel, nurse included
                </div>
                <div className="font-serif text-[46px] leading-none">
                  €399
                  <span className="font-sans text-base text-caption">/yr</span>
                </div>
                <div className="my-[22px] h-px bg-hairline" />
                <div className="text-sm leading-[2] text-muted">
                  1 venous draw · 80+ markers
                  <br />
                  Dublin mobile phlebotomy
                  <br />
                  Everything in Essential
                </div>
              </Link>
            </div>
          </div>
        </section>

        {/* CREDIBILITY / TRUST */}
        <section className="bg-surface px-10 py-[84px]">
          <div className="mx-auto max-w-[1180px]">
            <div className="mb-[52px] max-w-[62ch]">
              <div className="mb-[14px] font-mono text-xs tracking-[0.14em] text-forest">
                {h.credibility.eyebrow}
              </div>
              <h2 className="mb-[14px] mt-0 font-serif text-[42px] font-normal tracking-[-0.01em]">
                {h.credibility.title}
              </h2>
              <p className="m-0 text-base leading-[1.6] text-muted">
                {h.credibility.intro}
              </p>
            </div>
            <div className="grid gap-6 md:grid-cols-3">
              {TRUST_SIGNALS.map((signal) => (
                <div
                  key={signal.index}
                  className="rounded-card-lg border border-hairline bg-bone p-[26px]"
                >
                  <div className="mb-[18px] font-mono text-[11px] tracking-[0.1em] text-forest">
                    {signal.index} · {signal.label}
                  </div>
                  <h3 className="mb-[10px] mt-0 text-lg font-bold">
                    {signal.title}
                  </h3>
                  <p className="m-0 text-sm leading-[1.55] text-muted">
                    {signal.body}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-11 flex flex-wrap gap-5">
              <Link
                href="/science"
                className="text-[15px] font-semibold text-forest no-underline"
              >
                {h.credibility.methodCta}
              </Link>
              <Link
                href="/legal/clinical-safety"
                className="text-[15px] font-semibold text-forest no-underline"
              >
                {h.credibility.safetyCta}
              </Link>
            </div>
          </div>
        </section>

        {/* FOUNDER + CTA */}
        <section className="px-10 pb-[90px] pt-5">
          <div className="mx-auto mb-16 max-w-[760px] text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand-mark.svg"
              alt=""
              aria-hidden="true"
              width={56}
              height={56}
              className="mx-auto mb-6 h-14 w-14 rounded-full"
            />
            <p className="mb-5 mt-0 font-serif text-[26px] leading-[1.4] tracking-[-0.005em] text-ink">
              {h.founder.quote}
            </p>
            <div className="font-mono text-sm text-caption">
              {h.founder.attribution}{" "}
              <Link href="/about" className="text-forest underline underline-offset-2">
                {h.founder.storyLink}
              </Link>
            </div>
          </div>
          <div className="mx-auto max-w-[900px] rounded-card-xl bg-forest px-10 py-14 text-center text-white">
            <h2 className="mb-3 mt-0 font-serif text-[38px] font-normal tracking-[-0.01em]">
              {h.finalCta.title}
            </h2>
            {/* Price-bearing line: contractual €119 stays hardcoded, never localized. */}
            <p className="mb-[26px] mt-0 text-base text-vitality-faint">
              Join Essential and your first kit ships today. Not ready to test?
              Fusion starts at €119 a year.
            </p>
            <div className="flex flex-wrap justify-center gap-[14px]">
              <Link
                href="/pricing"
                className="inline-block rounded-pill bg-bone-white px-8 py-[15px] text-base font-semibold text-ink no-underline"
              >
                {h.finalCta.plansBtn}
              </Link>
              <Link
                href="/help"
                className="inline-block rounded-pill border border-[rgba(255,255,255,0.4)] px-8 py-[15px] text-base font-semibold text-white no-underline"
              >
                {h.finalCta.helpBtn}
              </Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter locale={locale} />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(organizationJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(membershipProductJsonLd) }}
      />
    </div>
  );
}
