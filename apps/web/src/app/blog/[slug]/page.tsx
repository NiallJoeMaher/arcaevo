import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";
import {
  articleSlugs,
  getArticle,
  type ArticleBlock,
} from "@/content/articles";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

type Props = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return articleSlugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = getArticle(slug);
  if (!post) return {};
  return {
    title: post.title,
    description: post.answer,
  };
}

function ArticleBlockView({ block }: { block: ArticleBlock }) {
  switch (block.type) {
    case "heading":
      return (
        <h2 className="mb-[14px] mt-9 font-serif text-[28px] font-normal tracking-[-0.01em]">
          {block.text}
        </h2>
      );
    case "paragraph":
      return (
        <p className="mb-5 mt-0 text-[17px] leading-[1.75] text-[#3E4842]">
          {block.text}
        </p>
      );
    case "callout":
      return (
        <div className="mb-6 mt-2 rounded-2xl bg-ink px-6 py-[22px] text-base leading-[1.6] text-vitality-faint">
          {block.text}
        </div>
      );
    case "list":
      return (
        <ul className="mb-[22px] mt-0 list-disc pl-[22px]">
          {block.items.map((item) => (
            <li
              key={item}
              className="mb-[10px] text-[16.5px] leading-[1.7] text-[#3E4842]"
            >
              {item}
            </li>
          ))}
        </ul>
      );
    default: {
      const _exhaustive: never = block;
      return _exhaustive;
    }
  }
}

export default async function ArticlePage({ params }: Props) {
  const { slug } = await params;
  const post = getArticle(slug);
  if (!post) notFound();

  const related = post.related
    .map((r) => getArticle(r))
    .filter((r) => r !== undefined);

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.answer,
    author: { "@type": "Organization", name: post.author },
    publisher: { "@type": "Organization", name: "Arcaevo" },
    mainEntityOfPage: `${SITE_URL}/blog/${post.slug}`,
    url: `${SITE_URL}/blog/${post.slug}`,
  };

  // Every article title is a question with a direct answer block (AEO).
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: post.title,
        acceptedAnswer: { "@type": "Answer", text: post.answer },
      },
    ],
  };

  return (
    <div className="w-full overflow-x-hidden bg-bone font-sans text-ink">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(articleJsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(faqJsonLd).replace(/</g, "\\u003c"),
        }}
      />

      <SiteNav active="blog" />

      <main>
        {/* BREADCRUMB */}
        <nav
          aria-label="Breadcrumb"
          className="mx-auto max-w-[720px] px-10 pt-6 font-mono text-[11px] tracking-[0.06em] text-caption"
        >
          <Link href="/" className="text-caption no-underline">
            HOME
          </Link>{" "}
          /{" "}
          <Link href="/blog" className="text-caption no-underline">
            JOURNAL
          </Link>{" "}
          / <span className="text-forest">{post.cat}</span>
        </nav>

        {/* HEADER + BODY */}
        <article className="mx-auto max-w-[720px] px-10 pb-10 pt-6">
          <span className="font-mono text-[11px] tracking-[0.12em] text-forest">
            {post.cat} · {post.read}
          </span>
          <h1 className="mb-[22px] mt-4 font-serif text-[clamp(32px,4.4vw,48px)] font-normal leading-[1.08] tracking-[-0.015em]">
            {post.title}
          </h1>
          <div className="flex items-center gap-3 border-b border-hairline-mid pb-6">
            <div className="h-9 w-9 rounded-full bg-[linear-gradient(135deg,#5FB592,#1E5C45)]" />
            <div>
              <div className="text-sm font-semibold">{post.author}</div>
              <div className="text-[12.5px] text-caption">{post.date}</div>
            </div>
          </div>

          {/* DIRECT ANSWER (AEO) */}
          <div className="my-7 rounded-card-sm border border-hairline border-l-[3px] border-l-forest bg-surface px-6 py-[22px]">
            <div className="mb-[10px] font-mono text-[10px] tracking-[0.12em] text-forest">
              THE SHORT ANSWER
            </div>
            <p className="m-0 text-[17px] leading-[1.6] text-ink">
              {post.answer}
            </p>
          </div>

          {/* BODY */}
          {post.blocks.map((block, i) => (
            <ArticleBlockView key={i} block={block} />
          ))}

          {/* KEY TAKEAWAYS */}
          <div className="my-8 rounded-[18px] border border-hairline-soft bg-surface p-[26px]">
            <div className="mb-[14px] font-mono text-[11px] tracking-[0.1em] text-forest">
              KEY TAKEAWAYS
            </div>
            <div className="flex flex-col gap-[10px]">
              {post.takeaways.map((t) => (
                <div key={t} className="flex items-start gap-[11px]">
                  <span className="shrink-0 text-[15px] text-vitality">✓</span>
                  <span className="text-[15px] leading-[1.55] text-[#3E4842]">
                    {t}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </article>

        {/* CTA */}
        <section className="mx-auto max-w-[720px] px-10 pb-10">
          <div className="rounded-card-lg bg-forest p-10 text-center text-white">
            <h3 className="mb-[10px] mt-0 font-serif text-[28px] font-normal">
              See it in your own numbers.
            </h3>
            <p className="mb-[22px] mt-0 text-[15px] text-vitality-faint">
              {post.ctaSub}
            </p>
            <Link
              href="/pricing"
              className="inline-block rounded-pill bg-bone-white px-7 py-[13px] font-semibold text-ink no-underline"
            >
              Order your first test
            </Link>
          </div>
        </section>

        {/* RELATED */}
        <section className="mx-auto max-w-[720px] px-10 pb-20">
          <div className="mb-[14px] font-mono text-[11px] tracking-[0.1em] text-caption">
            KEEP READING
          </div>
          <div className="flex flex-col gap-[10px]">
            {related.map((r) => (
              <Link
                key={r.slug}
                href={`/blog/${r.slug}`}
                className="flex items-center justify-between gap-4 rounded-card-sm border border-hairline-soft bg-surface px-[22px] py-[18px] text-inherit no-underline"
              >
                <span className="text-[15.5px] font-semibold">{r.title}</span>
                <span className="shrink-0 font-semibold text-forest">→</span>
              </Link>
            ))}
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
