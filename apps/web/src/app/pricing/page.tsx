import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "One annual membership. Tests included. Billed once a year, so your tests are covered upfront — the first one ships or gets booked the day you join. Fusion €119/yr · Essential €329/yr · Performance €399/yr.",
};

const COMPARISON_ROWS: {
  feature: string;
  a: string;
  b: string;
  c: string;
  header?: boolean;
}[] = [
  { feature: "", a: "Fusion", b: "Essential", c: "Performance", header: true },
  { feature: "Price per year", a: "€119", b: "€329", c: "€399" },
  {
    feature: "Included tests / year",
    a: "Bring your own",
    b: "2 finger-prick",
    c: "1 venous",
  },
  {
    feature: "Markers",
    a: "Any you upload",
    b: "Full panel + recheck",
    c: "80+",
  },
  { feature: "Nurse to your home", a: "—", b: "—", c: "✓ Dublin" },
  { feature: "Apple Watch fusion & baselines", a: "✓", b: "✓", c: "✓" },
  { feature: "“Did it work?” loop", a: "✓", b: "✓", c: "✓" },
  {
    feature: "Clinician-reviewed results",
    a: "—",
    b: "✓",
    c: "✓ Priority",
  },
  { feature: "EU data residency", a: "✓", b: "✓", c: "✓" },
];

const MARKET_CARDS = [
  {
    name: "Arcaevo Essential",
    price: "€329/yr",
    note: "2 tests, Apple Watch fusion, EU data, iOS + Watch app",
  },
  {
    name: "Function Health",
    price: "$365/yr",
    note: "US-only, US data, no wearable fusion",
  },
  {
    name: "Ultrahuman Blood Vision",
    price: "$499+/yr",
    note: "Plus $99 entry test — locked to their ring",
  },
  {
    name: "Superpower",
    price: "$199/yr",
    note: "US, web-only — no mobile or watch app",
  },
  {
    name: "WHOOP Advanced Labs",
    price: "$199–599",
    note: "On top of WHOOP membership; their hardware only",
  },
  {
    name: "Zoe",
    price: "£150–300",
    note: "Gut & glucose focus, upfront test fee",
  },
  {
    name: "Neko Health",
    price: "£299/scan",
    note: "Clinic body scan, per visit, waitlisted",
  },
  {
    name: "Randox Health",
    price: "~€480",
    note: "Clinic panel, PDF results, no interpretation layer",
  },
];

const FAQS = [
  {
    q: "Why annual billing?",
    a: "Because your tests are real-world cost — kits, labs, nurses. Paying once a year covers them upfront, which is exactly why your first test ships or gets booked the day you join instead of weeks later. It also matches the product: baselines and “did it work?” verdicts only emerge over months, not weeks.",
  },
  {
    q: "Is there a monthly option?",
    a: "Not at launch. Monthly billing is on the roadmap — but the honest truth is the product works over time: two tests, a baseline, and a retest verdict take most of a year. Annual keeps the price lower and the incentives straight.",
  },
  {
    q: "What's the difference between the baseline panel and the recheck?",
    a: "Your baseline is the full panel — the complete picture across metabolic, cardiovascular, hormonal, inflammation and nutrient markers. The recheck is a lighter panel focused on the markers most worth tracking between baselines: the ones that were out of range, and the ones you're actively working on.",
  },
  {
    q: "Can I test more often than twice a year?",
    a: "Yes — that's the quarterly upgrade. Add €130 to Essential for four tests a year (two full baselines, two rechecks), or buy single add-ons anytime: €99 for a full finger-prick panel, €69 for a recheck, €199 for an extra venous draw with nurse visit.",
  },
  {
    q: "Are phlebotomy or postage fees extra?",
    a: "No. Every price shown includes the kit or nurse visit, postage both ways, lab processing, clinician sign-off and full app access. No surprise line items.",
  },
  {
    q: "What's the refund policy?",
    a: "Full refund any time before your kit ships or your draw is booked. Once a sample has been processed, that test can't be refunded — lab work is real-world cost. You can cancel anytime, keep access until the end of your paid year, and export or delete all your data on the way out.",
  },
];

export default function PricingPage() {
  return (
    <div className="w-full overflow-x-hidden bg-bone font-sans text-ink">
      <SiteNav active="pricing" />

      <main>
        {/* HERO */}
        <section className="mx-auto max-w-[900px] px-10 pb-10 pt-[72px] text-center">
          <div className="mb-5 font-mono text-xs tracking-[0.14em] text-forest">
            MEMBERSHIP &amp; PRICING
          </div>
          <h1 className="mb-5 mt-0 font-serif text-[clamp(38px,5vw,58px)] font-normal leading-[1.04] tracking-[-0.015em]">
            One annual membership. Tests included.
          </h1>
          <p className="mx-auto mb-2 mt-0 max-w-[54ch] text-[19px] leading-[1.55] text-muted">
            Billed once a year, so your tests are covered upfront — the first
            one ships or gets booked the day you join. Cancel anytime and keep
            access until your year ends.
          </p>
        </section>

        {/* PLANS */}
        <section className="mx-auto max-w-[1100px] px-10 pb-4">
          <div className="grid items-stretch gap-[22px] md:grid-cols-3">
            <div className="flex flex-col rounded-card-lg border border-hairline bg-surface p-8">
              <div className="mb-[6px] text-[19px] font-bold">Fusion</div>
              <div className="mb-[22px] text-[13px] text-caption">
                Your watch &amp; your own bloodwork
              </div>
              <div className="font-serif text-[52px] leading-none">
                €119
                <span className="font-sans text-base text-caption">/yr</span>
              </div>
              <div className="mt-2 font-mono text-[12.5px] text-caption">
                ≈ €10/MO · NO TESTS TO SHIP
              </div>
              <div className="my-[22px] h-px bg-hairline" />
              <div className="flex-1 text-[14.5px] leading-[2] text-muted">
                ✓ Syncs Apple Watch &amp; Apple Health
                <br />
                ✓ Upload or enter any past bloodwork
                <br />
                ✓ Personal baselines &amp; top-3 insights
                <br />✓ Experiments &amp; the &ldquo;did it work?&rdquo; loop
                <br />✓ EU-hosted · export or delete anytime
              </div>
              <Link
                href="/contact"
                className="mt-[22px] block rounded-pill border border-ink p-[13px] text-center font-semibold text-ink no-underline"
              >
                Start Fusion
              </Link>
            </div>

            <div className="relative flex flex-col rounded-card-lg bg-ink p-8 text-bone-white shadow-card-dark">
              <div className="absolute right-6 top-6 rounded-pill bg-vitality px-[9px] py-1 font-mono text-[10px] tracking-[0.06em] text-[#04130D]">
                MOST POPULAR
              </div>
              <div className="mb-[6px] text-[19px] font-bold">Essential</div>
              <div className="mb-[22px] text-[13px] text-muted-dark-soft">
                Two blood tests a year, twice-yearly tracking
              </div>
              <div className="font-serif text-[52px] leading-none">
                €329
                <span className="font-sans text-base text-muted-dark-soft">
                  /yr
                </span>
              </div>
              <div className="mt-2 font-mono text-[12.5px] text-muted-dark-soft">
                ≈ €27/MO · FIRST KIT SHIPS TODAY
              </div>
              <div className="my-[22px] h-px bg-hairline-dark" />
              <div className="flex-1 text-[14.5px] leading-[2] text-[#CFD6CF]">
                ✓ Full baseline panel + a lighter recheck
                <br />
                ✓ Finger-prick kits to your door
                <br />
                ✓ Every result clinician-reviewed
                <br />
                ✓ Retest verdicts on what you changed
                <br />✓ Everything in Fusion
              </div>
              <Link
                href="/contact"
                className="mt-[22px] block rounded-pill bg-bone-white p-[13px] text-center font-semibold text-ink no-underline"
              >
                Start Essential
              </Link>
            </div>

            <div className="flex flex-col rounded-card-lg border border-hairline bg-surface p-8">
              <div className="mb-[6px] text-[19px] font-bold">Performance</div>
              <div className="mb-[22px] text-[13px] text-caption">
                The deep venous panel, nurse included
              </div>
              <div className="font-serif text-[52px] leading-none">
                €399
                <span className="font-sans text-base text-caption">/yr</span>
              </div>
              <div className="mt-2 font-mono text-[12.5px] text-caption">
                ≈ €33/MO · BOOK YOUR NURSE TODAY
              </div>
              <div className="my-[22px] h-px bg-hairline" />
              <div className="flex-1 text-[14.5px] leading-[2] text-muted">
                ✓ 1 venous panel · 80+ markers
                <br />
                ✓ Dublin mobile phlebotomy — we come to you
                <br />
                ✓ Hormones &amp; advanced lipids included
                <br />
                ✓ Priority clinician review
                <br />✓ Everything in Essential
              </div>
              <Link
                href="/contact"
                className="mt-[22px] block rounded-pill border border-ink p-[13px] text-center font-semibold text-ink no-underline"
              >
                Start Performance
              </Link>
            </div>
          </div>
          <p className="mb-0 mt-5 text-center text-[13px] text-caption">
            Every price includes kits or the nurse visit, postage both ways,
            lab processing, clinician sign-off and full app access. No hidden
            phlebotomy fees.
          </p>
        </section>

        {/* CADENCE UPGRADE */}
        <section className="mx-auto max-w-[1100px] px-10 pb-2 pt-12">
          <div className="rounded-card-lg bg-ink p-10 text-bone-white">
            <div className="grid items-center gap-10 md:grid-cols-[1fr_1.3fr]">
              <div>
                <div className="mb-[14px] font-mono text-[11px] tracking-[0.14em] text-vitality-light">
                  TEST CADENCE
                </div>
                <h2 className="mb-3 mt-0 font-serif text-[34px] font-normal tracking-[-0.01em]">
                  Twice a year is the rhythm. Quarterly is the upgrade.
                </h2>
                <p className="m-0 text-[15px] leading-[1.6] text-muted-dark">
                  Essential&apos;s two tests match how most markers actually
                  move. Training hard, running a protocol, or just impatient?
                  Step up to quarterly tracking — lighter rechecks between your
                  baselines, priced as a bundle so you never buy kits one by
                  one.
                </p>
              </div>
              <div className="flex flex-col gap-[10px]">
                <div className="flex items-center justify-between gap-4 rounded-card-sm bg-[rgba(255,255,255,0.06)] px-5 py-4">
                  <div>
                    <div className="text-[15px] font-bold">
                      Twice-yearly{" "}
                      <span className="ml-[6px] font-mono text-[9px] font-normal tracking-[0.08em] text-vitality-light">
                        INCLUDED
                      </span>
                    </div>
                    <div className="text-[12.5px] text-muted-dark-soft">
                      Full baseline + recheck — in every Essential year
                    </div>
                  </div>
                  <div className="font-mono text-sm text-vitality-light">
                    €0
                  </div>
                </div>
                <div className="flex items-center justify-between gap-4 rounded-card-sm border border-[rgba(52,160,124,0.35)] bg-[rgba(52,160,124,0.14)] px-5 py-4">
                  <div>
                    <div className="text-[15px] font-bold">Track quarterly</div>
                    <div className="text-[12.5px] text-muted-dark-soft">
                      4 tests a year — adds two rechecks to Essential
                    </div>
                  </div>
                  <div className="font-mono text-sm">
                    +€130
                    <span className="text-[11px] text-muted-dark-soft">
                      /yr
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-4 rounded-card-sm bg-[rgba(255,255,255,0.06)] px-5 py-4">
                  <div>
                    <div className="text-[15px] font-bold">Single add-ons</div>
                    <div className="text-[12.5px] text-muted-dark-soft">
                      Any plan, any time — no bundle needed
                    </div>
                  </div>
                  <div className="text-right font-mono text-[12.5px] text-[#CFD6CF]">
                    €99 full · €69 recheck
                    <br />
                    €199 venous
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* COMPARISON TABLE */}
        <section className="mx-auto max-w-[1100px] px-10 py-12">
          <h2 className="mb-7 mt-0 text-center font-serif text-[32px] font-normal tracking-[-0.01em]">
            Compare the plans
          </h2>
          <div className="overflow-hidden rounded-card border border-hairline-soft bg-surface">
            {COMPARISON_ROWS.map((row, i) => (
              <div
                key={i}
                className="grid grid-cols-[1.6fr_1fr_1fr_1fr] items-center gap-3 border-b border-[rgba(28,38,32,0.07)] px-6 py-4"
              >
                <span
                  className={`text-[14.5px] text-ink ${
                    row.header ? "font-bold" : "font-medium"
                  }`}
                >
                  {row.feature}
                </span>
                <span className="text-center text-[13.5px] text-muted">
                  {row.a}
                </span>
                <span className="text-center text-[13.5px] font-semibold text-forest">
                  {row.b}
                </span>
                <span className="text-center text-[13.5px] text-muted">
                  {row.c}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* MARKET CONTEXT */}
        <section className="mx-auto max-w-[1100px] px-10 pb-12 pt-2">
          <div className="mb-6 text-center">
            <h2 className="mb-2 mt-0 font-serif text-[30px] font-normal tracking-[-0.01em]">
              Where €329 sits in the market
            </h2>
            <p className="m-0 text-[15px] text-muted">
              Premium, competitive — and the only EU-native membership that
              fuses blood with your Apple Watch.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {MARKET_CARDS.map((card) => (
              <div
                key={card.name}
                className="rounded-card-sm border border-hairline-soft bg-surface px-[18px] py-4"
              >
                <div className="flex items-baseline justify-between gap-[10px]">
                  <span className="text-[13.5px] font-bold">{card.name}</span>
                  <span className="font-mono text-xs text-forest">
                    {card.price}
                  </span>
                </div>
                <div className="mt-[5px] text-xs leading-[1.45] text-caption">
                  {card.note}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 text-center">
            <Link
              href="/compare"
              className="text-[15px] font-semibold text-forest no-underline"
            >
              Full side-by-side comparisons →
            </Link>
          </div>
        </section>

        {/* FAQ */}
        <section className="mx-auto max-w-[760px] px-10 pb-20 pt-6">
          <h2 className="mb-5 mt-0 text-center font-serif text-[30px] font-normal">
            Pricing questions
          </h2>
          <div className="border-t border-hairline-mid">
            {FAQS.map((faq) => (
              <div
                key={faq.q}
                className="border-b border-hairline-mid px-1 py-5"
              >
                <h3 className="mb-2 mt-0 text-base font-semibold">{faq.q}</h3>
                <p className="m-0 text-[14.5px] leading-[1.6] text-muted">
                  {faq.a}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-8 text-center">
            <Link
              href="/help"
              className="text-[15px] font-semibold text-forest no-underline"
            >
              More in the Help centre →
            </Link>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
