import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";
import { compareIndex, getVersusPage, versusSlugs } from "@/content/compare";
import { canonicalUrl, routeMetadata } from "@/lib/seo";

type Props = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return versusSlugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = getVersusPage(slug);
  if (!page) return {};
  return routeMetadata({
    path: `/compare/${page.slug}`,
    title: `Arcaevo vs ${page.name}: which should you choose?`,
    description: page.answer,
  });
}

export default async function VersusPage({ params }: Props) {
  const { slug } = await params;
  const page = getVersusPage(slug);
  if (!page) notFound();

  const others = compareIndex.filter((c) => c.slug !== page.slug);

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: page.faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: canonicalUrl("/") },
      {
        "@type": "ListItem",
        position: 2,
        name: "Compare",
        item: canonicalUrl("/compare"),
      },
      {
        "@type": "ListItem",
        position: 3,
        name: `Arcaevo vs ${page.name}`,
        item: canonicalUrl(`/compare/${page.slug}`),
      },
    ],
  };

  return (
    <div className="w-full overflow-x-hidden bg-bone font-sans text-ink">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(faqJsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbJsonLd).replace(/</g, "\\u003c"),
        }}
      />

      <SiteNav active="compare" />

      <main>
        {/* BREADCRUMB */}
        <nav
          aria-label="Breadcrumb"
          className="mx-auto max-w-[900px] px-10 pt-6 font-mono text-[11px] tracking-[0.06em] text-caption"
        >
          <Link href="/" className="text-caption no-underline">
            HOME
          </Link>{" "}
          /{" "}
          <Link href="/compare" className="text-caption no-underline">
            COMPARE
          </Link>{" "}
          / <span className="text-forest">{page.name.toUpperCase()}</span>
        </nav>

        {/* HERO / DIRECT ANSWER (AEO) */}
        <section className="mx-auto max-w-[900px] px-10 pb-8 pt-7">
          <h1 className="mb-[22px] mt-0 font-serif text-[clamp(34px,4.6vw,52px)] font-normal leading-[1.05] tracking-[-0.015em]">
            Arcaevo vs {page.name}: which should you choose?
          </h1>
          <div className="rounded-card-sm border border-hairline border-l-[3px] border-l-forest bg-surface px-6 py-[22px]">
            <div className="mb-[10px] font-mono text-[10px] tracking-[0.12em] text-forest">
              THE SHORT ANSWER
            </div>
            <p className="m-0 text-[17px] leading-[1.6] text-ink">
              {page.answer}
            </p>
          </div>
        </section>

        {/* AT A GLANCE TABLE */}
        <section className="mx-auto max-w-[1000px] px-10 pb-2 pt-4">
          <h2
            data-reveal=""
            className="mb-5 mt-0 font-serif text-[30px] font-normal tracking-[-0.01em]"
          >
            At a glance
          </h2>
          <div
            data-reveal=""
            className="overflow-hidden rounded-card border border-hairline-soft bg-surface"
          >
            <table className="w-full table-fixed border-collapse text-left">
              <colgroup>
                <col className="w-[38%]" />
                <col className="w-[31%]" />
                <col className="w-[31%]" />
              </colgroup>
              <thead>
                <tr className="bg-ink text-bone-white">
                  <th
                    scope="col"
                    className="px-6 py-4 font-mono text-[11px] font-normal tracking-[0.08em] text-muted-dark-soft"
                  >
                    DIMENSION
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-4 text-sm font-bold text-vitality-light"
                  >
                    Arcaevo
                  </th>
                  <th scope="col" className="px-6 py-4 text-sm font-bold">
                    {page.name}
                  </th>
                </tr>
              </thead>
              <tbody>
                {page.rows.map((r) => (
                  <tr
                    key={r.dim}
                    className="border-b border-[rgba(28,38,32,0.07)] align-top"
                  >
                    <th
                      scope="row"
                      className="px-6 py-[15px] text-[13.5px] font-semibold text-muted"
                    >
                      {r.dim}
                    </th>
                    <td className="px-6 py-[15px] text-[13.5px] font-semibold text-forest">
                      {r.us}
                    </td>
                    <td className="px-6 py-[15px] text-[13.5px] text-muted">
                      {r.them}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* WHERE EACH WINS */}
        <section className="mx-auto max-w-[1000px] px-10 py-11">
          <div className="grid gap-[18px] md:grid-cols-2">
            <div className="rounded-card bg-ink p-7 text-bone-white">
              <div className="mb-[14px] font-mono text-[11px] tracking-[0.1em] text-vitality-light">
                WHERE ARCAEVO WINS
              </div>
              <div className="flex flex-col gap-3">
                {page.usWins.map((w) => (
                  <div key={w} className="flex items-start gap-[11px]">
                    <span className="shrink-0 text-[15px] text-vitality">✓</span>
                    <span className="text-[14.5px] leading-[1.5] text-[#CFD6CF]">
                      {w}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            {/* Versus.dc.html reveals only this light card — the dark
                "where Arcaevo wins" card stays static. */}
            <div
              data-reveal=""
              className="rounded-card border border-hairline-soft bg-surface p-7"
            >
              <div className="mb-[14px] font-mono text-[11px] tracking-[0.1em] text-[#A66A1F]">
                WHERE {page.name.toUpperCase()} WINS
              </div>
              <div className="flex flex-col gap-3">
                {page.themWins.map((w) => (
                  <div key={w} className="flex items-start gap-[11px]">
                    <span className="shrink-0 text-[15px] text-amber">◆</span>
                    <span className="text-[14.5px] leading-[1.5] text-muted">
                      {w}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* NARRATIVE */}
        <section className="mx-auto max-w-[820px] px-10 pb-6 pt-2">
          <h2
            data-reveal=""
            className="mb-4 mt-0 font-serif text-[30px] font-normal tracking-[-0.01em]"
          >
            The honest take
          </h2>
          {page.paras.map((p) => (
            <p
              key={p}
              className="mb-[18px] mt-0 text-[16.5px] leading-[1.7] text-[#3E4842]"
            >
              {p}
            </p>
          ))}
        </section>

        {/* FAQ (AEO) */}
        <section className="mx-auto max-w-[820px] px-10 pb-10 pt-6">
          <h2
            data-reveal=""
            className="mb-[18px] mt-0 font-serif text-[30px] font-normal tracking-[-0.01em]"
          >
            People also ask
          </h2>
          <div className="border-t border-hairline-mid">
            {page.faqs.map((f) => (
              <div
                key={f.q}
                className="border-b border-hairline-mid px-1 py-5"
              >
                <h3 className="mb-2 mt-0 text-base font-semibold">{f.q}</h3>
                <p className="m-0 text-[14.5px] leading-[1.6] text-muted">
                  {f.a}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA + OTHER COMPARISONS */}
        <section className="mx-auto max-w-[1000px] px-10 pb-10 pt-4">
          <div className="mb-10 rounded-card-lg bg-forest px-10 py-11 text-center text-white">
            <h3 className="mb-[10px] mt-0 font-serif text-[30px] font-normal">
              See the difference in your own numbers.
            </h3>
            <p className="mb-[22px] mt-0 text-[15px] text-vitality-faint">
              Start with a single test — no membership needed.
            </p>
            <Link
              href="/pricing"
              className="inline-block rounded-pill bg-bone-white px-[30px] py-[14px] font-semibold text-ink no-underline"
            >
              Order your first test
            </Link>
          </div>
          <div className="mb-[14px] font-mono text-[11px] tracking-[0.1em] text-caption">
            MORE COMPARISONS
          </div>
          <div className="flex flex-wrap gap-[10px]">
            {others.map((o) => (
              <Link
                key={o.slug}
                href={`/compare/${o.slug}`}
                className="rounded-pill border border-hairline bg-surface px-[18px] py-[10px] text-[13.5px] font-semibold text-ink no-underline"
              >
                vs {o.name}
              </Link>
            ))}
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
