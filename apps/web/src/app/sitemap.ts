import type { MetadataRoute } from "next";
import { canonicalUrl } from "@/lib/seo";
import { versusSlugs, articleSlugs, legalNav } from "@/content";
import { getArticle, articleIsoDate } from "@/content/articles";

/**
 * Stable content-release date used as lastmod for pages that have no per-item
 * date. Bumped deliberately when the marketing content set changes — NOT
 * `new Date()` per build, which would emit a churny, low-trust lastmod.
 */
const CONTENT_RELEASE = new Date("2026-07-05");

/** Marketing routes (public). /admin and /api are intentionally excluded. */
const STATIC_ROUTES: {
  path: string;
  priority: number;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
}[] = [
  { path: "/", priority: 1, changeFrequency: "weekly" },
  { path: "/pricing", priority: 0.9, changeFrequency: "monthly" },
  { path: "/how-it-works", priority: 0.8, changeFrequency: "monthly" },
  { path: "/science", priority: 0.7, changeFrequency: "yearly" },
  { path: "/app", priority: 0.7, changeFrequency: "monthly" },
  { path: "/about", priority: 0.6, changeFrequency: "yearly" },
  { path: "/careers", priority: 0.5, changeFrequency: "monthly" },
  { path: "/contact", priority: 0.5, changeFrequency: "yearly" },
  { path: "/compare", priority: 0.8, changeFrequency: "monthly" },
  { path: "/blog", priority: 0.7, changeFrequency: "weekly" },
  { path: "/help", priority: 0.6, changeFrequency: "monthly" },
];

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    ...STATIC_ROUTES.map(({ path, priority, changeFrequency }) => ({
      url: canonicalUrl(path),
      lastModified: CONTENT_RELEASE,
      changeFrequency,
      priority,
    })),
    ...versusSlugs.map((slug) => ({
      url: canonicalUrl(`/compare/${slug}`),
      lastModified: CONTENT_RELEASE,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    ...articleSlugs.map((slug) => {
      const post = getArticle(slug);
      const iso = post ? articleIsoDate(post.date) : undefined;
      return {
        url: canonicalUrl(`/blog/${slug}`),
        lastModified: iso ? new Date(iso) : CONTENT_RELEASE,
        changeFrequency: "yearly" as const,
        priority: 0.6,
      };
    }),
    ...legalNav.map(({ slug }) => ({
      url: canonicalUrl(`/legal/${slug}`),
      lastModified: CONTENT_RELEASE,
      changeFrequency: "yearly" as const,
      priority: 0.3,
    })),
  ];
}
