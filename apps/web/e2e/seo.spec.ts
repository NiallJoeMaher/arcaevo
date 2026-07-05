import { test, expect } from "@playwright/test";

/** SEO/AEO plan from the handoff: sitemap, robots, JSON-LD, OG image. */

test("sitemap has ~30 urls", async ({ request }) => {
  const res = await request.get("/sitemap.xml");
  expect(res.status()).toBe(200);
  const count = (await res.text()).match(/<loc>/g)?.length ?? 0;
  expect(count).toBeGreaterThanOrEqual(25);
});

test("robots disallows /admin and references the sitemap", async ({
  request,
}) => {
  const res = await request.get("/robots.txt");
  expect(res.status()).toBe(200);
  const text = await res.text();
  expect(text).toContain("Disallow: /admin");
  expect(text.toLowerCase()).toContain("sitemap");
});

async function jsonLdTypes(page: import("@playwright/test").Page) {
  const blocks = await page
    .locator('script[type="application/ld+json"]')
    .allTextContents();
  return blocks.flatMap((b) => {
    const parsed = JSON.parse(b);
    return (Array.isArray(parsed) ? parsed : [parsed]).map(
      (o: { "@type": string }) => o["@type"]
    );
  });
}

test("home has Organization + Product + WebSite JSON-LD", async ({ page }) => {
  await page.goto("/");
  const types = await jsonLdTypes(page);
  expect(types).toContain("Organization");
  expect(types).toContain("Product");
  expect(types).toContain("WebSite");
});

test("html lang is en-IE and canonical is present", async ({ page }) => {
  await page.goto("/how-it-works");
  await expect(page.locator("html")).toHaveAttribute("lang", "en-IE");
  const canonical = page.locator('link[rel="canonical"]');
  await expect(canonical).toHaveCount(1);
});

test("help page has FAQPage + BreadcrumbList JSON-LD", async ({ page }) => {
  await page.goto("/help");
  const types = await jsonLdTypes(page);
  expect(types).toContain("FAQPage");
  expect(types).toContain("BreadcrumbList");
});

test("new WHOOP + Oura versus pages render with schema", async ({ page }) => {
  for (const slug of ["whoop", "oura"]) {
    await page.goto(`/compare/${slug}`);
    const types = await jsonLdTypes(page);
    expect(types).toContain("FAQPage");
    expect(types).toContain("BreadcrumbList");
  }
});

test("llms.txt serves entity + pricing facts", async ({ request }) => {
  const res = await request.get("/llms.txt");
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("text/plain");
  const text = await res.text();
  expect(text).toContain("Arcaevo");
  expect(text).toContain("119");
});

test("versus page has FAQPage + BreadcrumbList JSON-LD", async ({ page }) => {
  await page.goto("/compare/letsgetchecked");
  const types = await jsonLdTypes(page);
  expect(types).toContain("FAQPage");
  expect(types).toContain("BreadcrumbList");
});

test("article has Article JSON-LD with a publish date + BreadcrumbList", async ({
  page,
}) => {
  await page.goto("/blog/apob-vs-cholesterol");
  const types = await jsonLdTypes(page);
  expect(types).toContain("Article");
  expect(types).toContain("BreadcrumbList");
  const article = await page
    .locator('script[type="application/ld+json"]')
    .allTextContents()
    .then((blocks) =>
      blocks
        .map((b) => JSON.parse(b))
        .find((o) => o["@type"] === "Article")
    );
  expect(article.datePublished).toBeTruthy();
});

test("default opengraph image responds", async ({ request }) => {
  const res = await request.get("/opengraph-image");
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("image");
});
