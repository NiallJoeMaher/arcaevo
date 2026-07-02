import type { MetadataRoute } from "next";
import { canonicalUrl } from "@/lib/seo";
import { versusSlugs, articleSlugs, legalNav } from "@/content";

/** Marketing routes (public). /admin and /api are intentionally excluded. */
const STATIC_ROUTES: { path: string; priority: number }[] = [
  { path: "/", priority: 1 },
  { path: "/pricing", priority: 0.9 },
  { path: "/how-it-works", priority: 0.8 },
  { path: "/science", priority: 0.7 },
  { path: "/app", priority: 0.7 },
  { path: "/about", priority: 0.6 },
  { path: "/careers", priority: 0.5 },
  { path: "/contact", priority: 0.5 },
  { path: "/compare", priority: 0.8 },
  { path: "/blog", priority: 0.7 },
  { path: "/help", priority: 0.6 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return [
    ...STATIC_ROUTES.map(({ path, priority }) => ({
      url: canonicalUrl(path),
      lastModified,
      changeFrequency: "monthly" as const,
      priority,
    })),
    ...versusSlugs.map((slug) => ({
      url: canonicalUrl(`/compare/${slug}`),
      lastModified,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    ...articleSlugs.map((slug) => ({
      url: canonicalUrl(`/blog/${slug}`),
      lastModified,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    ...legalNav.map(({ slug }) => ({
      url: canonicalUrl(`/legal/${slug}`),
      lastModified,
      changeFrequency: "yearly" as const,
      priority: 0.3,
    })),
  ];
}
