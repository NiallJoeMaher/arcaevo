import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";
import { helpCategories, helpGroups } from "@/content/help";
import {
  jsonLd,
  routeMetadata,
  faqPageJsonLd,
  breadcrumbJsonLd,
} from "@/lib/seo";
import HelpAccordion from "./HelpAccordion";

export const metadata: Metadata = routeMetadata({
  path: "/help",
  title: "Help centre",
  description:
    "How can we help? Answers on testing & samples, results & the app, billing & membership, and privacy & data. Our team replies within one working day — clinical questions go to our medical team.",
});

export default function HelpPage() {
  const faqJsonLd = faqPageJsonLd(
    helpGroups.flatMap((g) => g.items.map((i) => ({ q: i.q, a: i.a })))
  );
  const breadcrumbList = breadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: "Help centre", path: "/help" },
  ]);

  return (
    <div className="w-full overflow-x-hidden bg-bone font-sans text-ink">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(faqJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbList) }}
      />

      <SiteNav />

      <main>
        {/* HERO */}
        <section className="mx-auto max-w-[820px] px-10 pb-8 pt-[72px] text-center">
          <div className="mb-5 font-mono text-xs tracking-[0.14em] text-forest">
            HELP CENTRE
          </div>
          <h1 className="mb-[22px] mt-0 font-serif text-[clamp(38px,5vw,54px)] font-normal leading-[1.05] tracking-[-0.015em]">
            How can we help?
          </h1>
          <div className="mx-auto flex max-w-[520px] items-center gap-[10px] rounded-pill border border-hairline-mid bg-surface px-[22px] py-[14px]">
            <span className="text-base text-[#9AA39C]">⌕</span>
            <span className="text-[15px] text-[#9AA39C]">
              Search articles — testing, results, billing, privacy…
            </span>
          </div>
        </section>

        {/* CATEGORY CHIPS */}
        <section className="mx-auto max-w-[900px] px-10 pb-2 pt-4">
          <div className="flex flex-wrap justify-center gap-[10px]">
            {helpCategories.map((c) => (
              <span
                key={c}
                className="rounded-pill border border-hairline bg-surface px-4 py-[9px] font-mono text-xs text-muted"
              >
                {c}
              </span>
            ))}
          </div>
        </section>

        {/* FAQ ACCORDION */}
        <section className="mx-auto max-w-[820px] px-10 pb-[60px] pt-9">
          <HelpAccordion groups={helpGroups} />

          <div className="mt-5 rounded-card-lg bg-forest px-10 py-11 text-center text-white">
            <h3 className="mb-[10px] mt-0 font-serif text-[28px] font-normal">
              Still stuck?
            </h3>
            <p className="mb-[22px] mt-0 text-[15px] text-vitality-faint">
              Our team replies within one working day — clinical questions go
              to our medical team.
            </p>
            <Link
              href="/contact"
              className="inline-block rounded-pill bg-bone-white px-7 py-[13px] font-semibold text-ink no-underline"
            >
              Contact support
            </Link>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
