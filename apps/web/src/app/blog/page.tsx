import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";
import { blogFeatured, blogIndexCards, blogIndexMeta } from "@/content/articles";
import { routeMetadata } from "@/lib/seo";

export const metadata: Metadata = routeMetadata({
  path: "/blog",
  title: "The Journal — clear answers about your health data",
  description: blogIndexMeta.intro,
});

export default function BlogPage() {
  return (
    <div className="w-full overflow-x-hidden bg-bone font-sans text-ink">
      <SiteNav active="blog" />

      <main>
        {/* HERO */}
        <section className="mx-auto max-w-[1000px] px-10 pb-6 pt-[72px]">
          <div className="mb-5 font-mono text-xs tracking-[0.14em] text-forest">
            {blogIndexMeta.kicker}
          </div>
          <h1 className="mb-[18px] mt-0 font-serif text-[clamp(38px,5vw,56px)] font-normal leading-[1.05] tracking-[-0.015em]">
            {blogIndexMeta.title}
          </h1>
          <p className="m-0 max-w-[58ch] text-lg leading-[1.6] text-muted">
            {blogIndexMeta.intro}
          </p>
        </section>

        {/* FEATURED */}
        <section className="mx-auto max-w-[1000px] px-10 pb-3 pt-6">
          <Link
            href={`/blog/${blogFeatured.slug}`}
            data-reveal=""
            className="grid overflow-hidden rounded-card-xl bg-ink text-inherit no-underline md:grid-cols-[1.1fr_0.9fr] md:gap-8"
          >
            <div className="p-10">
              <span className="font-mono text-[11px] tracking-[0.1em] text-vitality-light">
                {blogFeatured.cat} · FEATURED
              </span>
              <h2 className="mb-[14px] mt-4 font-serif text-[34px] font-normal leading-[1.1] tracking-[-0.01em] text-bone-white">
                {blogFeatured.title}
              </h2>
              <p className="mb-5 mt-0 text-[15.5px] leading-[1.6] text-muted-dark">
                {blogFeatured.excerpt}
              </p>
              <span className="text-[14.5px] font-semibold text-vitality-light">
                Read the article →
              </span>
            </div>
            <div className="flex min-h-[240px] items-center justify-center bg-[linear-gradient(135deg,#1E5C45,#34A07C)]">
              <svg viewBox="0 0 200 120" className="h-auto w-[70%]" aria-hidden="true">
                <rect
                  x="0"
                  y="46"
                  width="200"
                  height="30"
                  rx="6"
                  fill="rgba(255,255,255,0.16)"
                />
                <polyline
                  points="6,86 46,80 86,60 126,64 166,44 194,34"
                  fill="none"
                  stroke="#F4F1EA"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
                <circle cx="46" cy="80" r="5" fill="#fff" />
                <circle cx="126" cy="64" r="5" fill="#fff" />
                <circle cx="194" cy="34" r="5" fill="#fff" />
              </svg>
            </div>
          </Link>
        </section>

        {/* GRID */}
        <section className="mx-auto max-w-[1000px] px-10 pb-20 pt-6">
          <div className="grid gap-[18px] md:grid-cols-3">
            {blogIndexCards.map((p) => (
              <Link
                key={p.slug}
                href={`/blog/${p.slug}`}
                data-reveal=""
                className="flex flex-col overflow-hidden rounded-[18px] border border-hairline-soft bg-surface text-inherit no-underline"
              >
                <div
                  className="flex h-[120px] items-center justify-center"
                  style={{ background: p.bg }}
                >
                  <span className="font-serif text-[44px] text-[rgba(255,255,255,0.9)]">
                    {p.glyph}
                  </span>
                </div>
                <div className="p-[22px]">
                  <span className="font-mono text-[10px] tracking-[0.1em] text-forest">
                    {p.cat}
                  </span>
                  <h3 className="mb-2 mt-[10px] text-lg font-bold leading-[1.25] tracking-[-0.01em]">
                    {p.title}
                  </h3>
                  <p className="mb-3 mt-0 text-[13.5px] leading-[1.55] text-muted">
                    {p.excerpt}
                  </p>
                  <span className="font-mono text-[11px] text-caption">
                    {p.read}
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
