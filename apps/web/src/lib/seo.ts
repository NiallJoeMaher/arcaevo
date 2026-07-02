/**
 * SEO/AEO helpers: site URL, canonical builder, JSON-LD serializer and
 * shared schema.org objects (Organization, membership Product).
 *
 * Facts (name, location, tagline, prices) come verbatim from the design
 * handoff / site footer — nothing invented.
 */

/** Public site origin. Mirrors metadataBase in src/app/layout.tsx. */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

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

/** Shared Organization JSON-LD (details from the site footer copy). */
export const organizationJsonLd: Record<string, unknown> = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Arcaevo",
  legalName: "Arcaevo Health",
  url: SITE_URL,
  description:
    "The interpretation layer for your health. Bloods fused with wearables, read off your own baseline. Dublin, Ireland.",
  address: {
    "@type": "PostalAddress",
    addressLocality: "Dublin",
    addressCountry: "IE",
  },
  sameAs: [],
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
