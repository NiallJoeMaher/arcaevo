import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";
import { compareIndex, compareIndexMeta } from "@/content/compare";
import { routeMetadata } from "@/lib/seo";

export const metadata: Metadata = routeMetadata({
  path: "/compare",
  title: "Compare — Arcaevo vs the rest of at-home health testing",
  description:
    "Honest, side-by-side comparisons. Most services are brilliant at collecting biomarkers and stop there. Here's how Arcaevo's interpretation layer — fusion, your-baseline flagging, and the “did it work?” loop — stacks up against each one.",
});

export default function ComparePage() {
  return (
    <div className="w-full overflow-x-hidden bg-bone font-sans text-ink">
      <SiteNav active="compare" />

      <main>
        {/* HERO */}
        <section className="mx-auto max-w-[900px] px-10 pb-6 pt-[72px]">
          <div className="mb-5 font-mono text-xs tracking-[0.14em] text-forest">
            {compareIndexMeta.kicker}
          </div>
          <h1 className="mb-[22px] mt-0 font-serif text-[clamp(38px,5vw,56px)] font-normal leading-[1.05] tracking-[-0.015em]">
            {compareIndexMeta.title}
          </h1>
          <p className="m-0 max-w-[60ch] text-[19px] leading-[1.6] text-muted">
            {compareIndexMeta.intro}
          </p>
        </section>

        {/* ARCAEVO SUMMARY ROW */}
        <section className="mx-auto max-w-[1000px] px-10 pb-2 pt-6">
          <div className="grid gap-5 rounded-card bg-ink px-[30px] py-[26px] text-bone-white md:grid-cols-3">
            {compareIndexMeta.summary.map((card) => (
              <div key={card.kicker}>
                <div className="mb-2 font-mono text-[10px] tracking-[0.1em] text-vitality-light">
                  {card.kicker}
                </div>
                <div className="text-[15px] font-semibold">{card.title}</div>
                <div className="mt-1 text-[13px] text-muted-dark">
                  {card.sub}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* COMPETITOR GRID */}
        <section className="mx-auto max-w-[1000px] px-10 pb-20 pt-8">
          <div className="grid gap-4 md:grid-cols-2">
            {compareIndex.map((c) => (
              <Link
                key={c.slug}
                href={`/compare/${c.slug}`}
                className="flex flex-col gap-3 rounded-[18px] border border-hairline-soft bg-surface p-6 text-inherit no-underline"
              >
                <div className="flex items-center justify-between">
                  <div className="text-[19px] font-bold tracking-[-0.01em]">
                    Arcaevo vs {c.name}
                  </div>
                  <span className="text-sm font-semibold text-forest">
                    Read →
                  </span>
                </div>
                <div className="text-sm leading-[1.55] text-muted">
                  {c.tagline}
                </div>
                <div className="mt-[2px] flex flex-wrap gap-2">
                  <span className="rounded-pill bg-[rgba(28,38,32,0.05)] px-[10px] py-1 font-mono text-[10px] text-muted">
                    {c.market}
                  </span>
                  <span className="rounded-pill bg-[rgba(30,92,69,0.1)] px-[10px] py-1 font-mono text-[10px] text-forest">
                    {c.edge}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
