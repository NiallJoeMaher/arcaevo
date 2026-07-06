/**
 * Unit tests for src/lib/seo.ts — the SEO/AEO metadata + JSON-LD helpers.
 * Covers canonical/hreflang, routeMetadata (canonical + OG + Twitter),
 * BreadcrumbList/FAQPage builders, and the article date parser.
 */
import { describe, expect, it } from "vitest";
import {
  SITE_URL,
  canonicalUrl,
  hreflangFor,
  routeMetadata,
  breadcrumbJsonLd,
  faqPageJsonLd,
  organizationJsonLd,
  websiteJsonLd,
} from "@/lib/seo";
import { articleIsoDate } from "@/content/articles";

describe("canonicalUrl", () => {
  it("resolves a path against SITE_URL", () => {
    expect(canonicalUrl("/pricing")).toBe(`${SITE_URL}/pricing`);
    expect(canonicalUrl("/")).toBe(`${SITE_URL}/`);
  });
});

describe("hreflangFor", () => {
  it("advertises en-US/en-GB/en-IE + x-default, all self-referencing", () => {
    const langs = hreflangFor("/blog");
    // Single URL structure: every locale negotiates from the same absolute URL.
    expect(langs["en-US"]).toBe(`${SITE_URL}/blog`);
    expect(langs["en-GB"]).toBe(`${SITE_URL}/blog`);
    expect(langs["en-IE"]).toBe(`${SITE_URL}/blog`);
    expect(langs["x-default"]).toBe(`${SITE_URL}/blog`);
  });
});

describe("routeMetadata", () => {
  it("sets a relative canonical, hreflang, and website OpenGraph by default", () => {
    const meta = routeMetadata({
      path: "/how-it-works",
      title: "How it works",
      description: "desc",
    });
    expect(meta.alternates?.canonical).toBe("/how-it-works");
    expect(meta.alternates?.languages?.["en-IE"]).toBe(
      `${SITE_URL}/how-it-works`
    );
    const og = meta.openGraph as Record<string, unknown>;
    expect(og.type).toBe("website");
    expect(og.siteName).toBe("Arcaevo");
    expect(og.locale).toBe("en_IE");
    expect(og.url).toBe(`${SITE_URL}/how-it-works`);
    expect((meta.twitter as Record<string, unknown>).card).toBe(
      "summary_large_image"
    );
  });

  it("emits article OpenGraph with timestamps and authors", () => {
    const meta = routeMetadata({
      path: "/blog/x",
      title: "X",
      description: "d",
      type: "article",
      publishedTime: "2026-06-01",
      modifiedTime: "2026-06-01",
      authors: ["The Arcaevo Team"],
    });
    const og = meta.openGraph as Record<string, unknown>;
    expect(og.type).toBe("article");
    expect(og.publishedTime).toBe("2026-06-01");
    expect(og.authors).toEqual(["The Arcaevo Team"]);
  });
});

describe("breadcrumbJsonLd", () => {
  it("builds an ordered BreadcrumbList with absolute items", () => {
    const bc = breadcrumbJsonLd([
      { name: "Home", path: "/" },
      { name: "Journal", path: "/blog" },
    ]) as {
      "@type": string;
      itemListElement: { position: number; name: string; item: string }[];
    };
    expect(bc["@type"]).toBe("BreadcrumbList");
    expect(bc.itemListElement).toHaveLength(2);
    expect(bc.itemListElement[0].position).toBe(1);
    expect(bc.itemListElement[1].item).toBe(`${SITE_URL}/blog`);
  });
});

describe("faqPageJsonLd", () => {
  it("maps q/a pairs into a FAQPage node", () => {
    const faq = faqPageJsonLd([{ q: "Q?", a: "A." }]) as {
      "@type": string;
      mainEntity: { name: string; acceptedAnswer: { text: string } }[];
    };
    expect(faq["@type"]).toBe("FAQPage");
    expect(faq.mainEntity[0].name).toBe("Q?");
    expect(faq.mainEntity[0].acceptedAnswer.text).toBe("A.");
  });
});

describe("entity JSON-LD", () => {
  it("Organization carries logo + areaServed and honest empty sameAs", () => {
    expect(organizationJsonLd["@type"]).toBe("Organization");
    expect(organizationJsonLd.areaServed).toBe("IE");
    expect(typeof organizationJsonLd.logo).toBe("string");
    expect(organizationJsonLd.sameAs).toEqual([]);
  });

  it("WebSite node has no SearchAction (no on-site search yet)", () => {
    expect(websiteJsonLd["@type"]).toBe("WebSite");
    expect(websiteJsonLd.potentialAction).toBeUndefined();
    expect(websiteJsonLd.inLanguage).toBe("en-IE");
  });
});

describe("articleIsoDate", () => {
  it("parses an 'Updated <Month> <Year>' date line to an ISO date", () => {
    expect(articleIsoDate("Updated June 2026")).toBe("2026-06-01");
    expect(articleIsoDate("Updated July 2026")).toBe("2026-07-01");
  });

  it("returns undefined for unparseable input", () => {
    expect(articleIsoDate("sometime soon")).toBeUndefined();
  });
});
