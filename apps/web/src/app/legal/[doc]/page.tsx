import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";
import { getLegalDoc, legalNav, legalSlugs } from "@/content/legal";
import { jsonLd, routeMetadata, breadcrumbJsonLd } from "@/lib/seo";

type Props = {
  params: Promise<{ doc: string }>;
};

export function generateStaticParams() {
  return legalSlugs.map((doc) => ({ doc }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { doc: slug } = await params;
  const doc = getLegalDoc(slug);
  if (!doc) return {};
  return routeMetadata({
    path: `/legal/${doc.slug}`,
    title: doc.title,
    description: doc.intro,
  });
}

export default async function LegalDocPage({ params }: Props) {
  const { doc: slug } = await params;
  const doc = getLegalDoc(slug);
  if (!doc) notFound();

  const breadcrumbList = breadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: "Trust & legal", path: "/legal" },
    { name: doc.title, path: `/legal/${doc.slug}` },
  ]);

  return (
    <div className="w-full overflow-x-hidden bg-bone font-sans text-ink">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbList) }}
      />
      <SiteNav />

      <main>
        <div className="mx-auto grid max-w-[1120px] items-start gap-12 px-[22px] md:px-10 pb-20 pt-10 lg:grid-cols-[250px_1fr]">
          {/* SIDEBAR */}
          <aside className="lg:sticky lg:top-24">
            <div className="mb-[14px] font-mono text-[11px] tracking-[0.1em] text-caption">
              TRUST &amp; LEGAL
            </div>
            <nav aria-label="Trust & legal" className="flex flex-col gap-[2px]">
              {legalNav.map((n) => (
                <Link
                  key={n.slug}
                  href={`/legal/${n.slug}`}
                  aria-current={n.slug === doc.slug ? "page" : undefined}
                  className={`block rounded-[9px] px-3 py-[9px] text-sm no-underline ${
                    n.slug === doc.slug
                      ? "bg-ink font-semibold text-bone-white"
                      : "font-medium text-muted"
                  }`}
                >
                  {n.label}
                </Link>
              ))}
            </nav>
            <div className="mt-6 rounded-card-sm border border-hairline-soft bg-surface p-[18px]">
              <div className="mb-[6px] text-[13px] font-semibold">
                Exercise your rights
              </div>
              <div className="mb-[10px] text-[12.5px] leading-[1.5] text-muted">
                Export or delete your data in the app, or email us.
              </div>
              <Link
                href="/contact"
                className="font-mono text-[11px] text-forest no-underline"
              >
                privacy@arcaevo.com →
              </Link>
            </div>
          </aside>

          {/* DOCUMENT */}
          <article>
            <div className="mb-3 font-mono text-[11px] tracking-[0.1em] text-forest">
              {doc.kicker}
            </div>
            <h1 className="mb-3 mt-0 font-serif text-[clamp(32px,4.4vw,46px)] max-md:text-[clamp(34px,9.5vw,42px)] font-normal leading-[1.08] tracking-[-0.015em]">
              {doc.title}
            </h1>
            <div className="mb-3 text-[13.5px] text-caption">{doc.updated}</div>
            <p className="mb-6 mt-0 border-b border-hairline-mid pb-6 text-[17px] leading-[1.65] text-[#3E4842]">
              {doc.intro}
            </p>

            {doc.sections.map((s) => (
              <section key={s.h} className="mb-7">
                <h2 className="mb-3 mt-0 text-xl font-bold tracking-[-0.01em]">
                  {s.h}
                </h2>
                {s.paras.map((p) => (
                  <p
                    key={p}
                    className="mb-[14px] mt-0 text-[15.5px] leading-[1.7] text-[#3E4842]"
                  >
                    {p}
                  </p>
                ))}
                {s.hasList && (
                  <ul className="mb-[14px] mt-0 list-disc pl-5">
                    {s.items.map((item) => (
                      <li
                        key={item}
                        className="mb-2 text-[15px] leading-[1.65] text-[#3E4842]"
                      >
                        {item}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}

            <div className="mt-9 border-t border-hairline-mid pt-5 text-[13px] leading-[1.6] text-caption">
              This document is current best-effort copy pending solicitor
              review and is not legal advice. Arcaevo is a product of Codú
              Limited (registered in Ireland, CRO [TODO: CRO number]), Dublin,
              Ireland — the data controller for GDPR purposes. Questions:{" "}
              <Link href="/contact" className="text-forest no-underline">
                privacy@arcaevo.com
              </Link>
              .
            </div>
          </article>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
