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

test("home has Organization + Product JSON-LD", async ({ page }) => {
  await page.goto("/");
  const types = await jsonLdTypes(page);
  expect(types).toContain("Organization");
  expect(types).toContain("Product");
});

test("versus page has FAQPage + BreadcrumbList JSON-LD", async ({ page }) => {
  await page.goto("/compare/letsgetchecked");
  const types = await jsonLdTypes(page);
  expect(types).toContain("FAQPage");
  expect(types).toContain("BreadcrumbList");
});

test("article has Article JSON-LD", async ({ page }) => {
  await page.goto("/blog/apob-vs-cholesterol");
  const types = await jsonLdTypes(page);
  expect(types).toContain("Article");
});

test("default opengraph image responds", async ({ request }) => {
  const res = await request.get("/opengraph-image");
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("image");
});
