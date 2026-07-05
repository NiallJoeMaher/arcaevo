/**
 * SEO/AEO helpers: site URL, canonical builder, JSON-LD serializer and
 * shared schema.org objects (Organization, WebSite, membership Product).
 *
 * Facts (name, location, tagline, prices) come verbatim from the design
 * handoff / site footer — nothing invented.
 *
 * NOTE: NEXT_PUBLIC_SITE_URL MUST be set in Vercel prod (all environments).
 * If unset, canonicals/OG/JSON-LD/sitemap fall back to http://localhost:3000.
 */

import type { Metadata } from "next";

/** Public site origin. Mirrors metadataBase in src/app/layout.tsx. */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/** BCP-47 locale for the (currently only) live market: Ireland English. */
export const SITE_LOCALE = "en-IE";
/** OpenGraph locale form of SITE_LOCALE. */
export const OG_LOCALE = "en_IE";

/** Absolute canonical URL for a path ("/", "/pricing", ...). */
export function canonicalUrl(path: string = "/"): string {
  return new URL(path, SITE_URL).toString();
}

/**
 * Serialize an object for a <script type="application/ld+json"> block.
 * Escapes "<" to prevent script-tag injection via content strings.
 */
export function jsonLd(obj: Record<string, unknown>): string {
  return JSON.stringify(obj).replace(/</g, "\\u003c");
}

/**
 * hreflang scaffolding. en-IE is the only live locale today; x-default points
 * at it. en-GB / en-US slots are intentionally left out until localized routes
 * exist (don't fabricate locale URLs) — add them here when they ship.
 */
export function hreflangFor(path: string): Record<string, string> {
  const url = canonicalUrl(path);
  return {
    "en-IE": url,
    "x-default": url,
  };
}

/**
 * Build the shared SEO surface for a route: canonical + hreflang alternates,
 * OpenGraph (siteName/locale/url/type) and Twitter card. Because Next.js merges
 * metadata *shallowly* (nested `openGraph`/`alternates` from a page fully
 * replace the layout's), every content route calls this so it never drops the
 * site-wide OG/locale defaults.
 */
export function routeMetadata(opts: {
  path: string;
  title?: string;
  description?: string;
  type?: "website" | "article";
  /** Article only: ISO 8601 publish date. */
  publishedTime?: string;
  /** Article only: ISO 8601 last-modified date. */
  modifiedTime?: string;
  /** Article only: author names. */
  authors?: string[];
}): Metadata {
  const {
    path,
    title,
    description,
    type = "website",
    publishedTime,
    modifiedTime,
    authors,
  } = opts;
  const url = canonicalUrl(path);

  const openGraph: Metadata["openGraph"] =
    type === "article"
      ? {
          type: "article",
          siteName: "Arcaevo",
          locale: OG_LOCALE,
          url,
          title,
          description,
          publishedTime,
          modifiedTime,
          authors,
        }
      : {
          type: "website",
          siteName: "Arcaevo",
          locale: OG_LOCALE,
          url,
          title,
          description,
        };

  return {
    ...(title !== undefined ? { title } : {}),
    ...(description !== undefined ? { description } : {}),
    alternates: {
      canonical: path,
      languages: hreflangFor(path),
    },
    openGraph,
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

/** Build a BreadcrumbList JSON-LD node from ordered [name, path] pairs. */
export function breadcrumbJsonLd(
  items: { name: string; path: string }[]
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: canonicalUrl(it.path),
    })),
  };
}

/** Build a FAQPage JSON-LD node from question/answer pairs. */
export function faqPageJsonLd(
  faqs: { q: string; a: string }[]
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}

/** Shared Organization JSON-LD (details from the site footer copy). */
export const organizationJsonLd: Record<string, unknown> = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Arcaevo",
  legalName: "Arcaevo Health",
  url: SITE_URL,
  logo: canonicalUrl("/opengraph-image"),
  description:
    "The interpretation layer for your health. Bloods fused with wearables, read off your own baseline. Dublin, Ireland.",
  address: {
    "@type": "PostalAddress",
    addressLocality: "Dublin",
    addressCountry: "IE",
  },
  areaServed: "IE",
  // No verified social profiles yet — intentionally empty (do not fabricate).
  sameAs: [],
};

/**
 * Site-wide WebSite JSON-LD node (knowledge-graph entity).
 * No SearchAction: there is no on-site search yet — add one when search ships.
 */
export const websiteJsonLd: Record<string, unknown> = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Arcaevo",
  url: SITE_URL,
  inLanguage: SITE_LOCALE,
  publisher: { "@type": "Organization", name: "Arcaevo" },
};

/**
 * Membership Product JSON-LD with the three annual plans as Offers.
 * Prices verbatim: Fusion €119/yr · Essential €329/yr · Performance €399/yr.
 */
export const membershipProductJsonLd: Record<string, unknown> = {
  "@context": "https://schema.org",
  "@type": "Product",
  name: "Arcaevo Membership",
  description:
    "One annual membership. Tests included. Blood testing fused with your Apple Watch, read off your own baseline.",
  brand: {
    "@type": "Brand",
    name: "Arcaevo",
  },
  url: canonicalUrl("/pricing"),
  offers: [
    {
      "@type": "Offer",
      name: "Fusion",
      description: "Your watch & your own bloodwork",
      price: "119",
      priceCurrency: "EUR",
      url: canonicalUrl("/pricing"),
      availability: "https://schema.org/InStock",
    },
    {
      "@type": "Offer",
      name: "Essential",
      description: "Two blood tests a year, twice-yearly tracking",
      price: "329",
      priceCurrency: "EUR",
      url: canonicalUrl("/pricing"),
      availability: "https://schema.org/InStock",
    },
    {
      "@type": "Offer",
      name: "Performance",
      description: "The deep venous panel, nurse included",
      price: "399",
      priceCurrency: "EUR",
      url: canonicalUrl("/pricing"),
      availability: "https://schema.org/InStock",
    },
  ],
};
