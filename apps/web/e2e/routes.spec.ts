import { test, expect } from "@playwright/test";

/**
 * Every sitemap route returns 200, has exactly one <h1> and a non-empty
 * <title>; /legal redirects to /legal/privacy.
 */

async function sitemapPaths(request: import("@playwright/test").APIRequestContext) {
  const res = await request.get("/sitemap.xml");
  expect(res.status()).toBe(200);
  const xml = await res.text();
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) =>
    new URL(m[1]).pathname
  );
  expect(urls.length).toBeGreaterThanOrEqual(25);
  return urls;
}

test("all sitemap routes render with one h1 and a title", async ({
  page,
  request,
}) => {
  test.setTimeout(240_000);
  const paths = await sitemapPaths(request);
  for (const path of paths) {
    const response = await page.goto(path);
    expect(response?.status(), `status of ${path}`).toBe(200);
    await expect(page.locator("h1"), `h1 count on ${path}`).toHaveCount(1);
    expect((await page.title()).trim(), `title of ${path}`).not.toBe("");
  }
});

test("/legal redirects to /legal/privacy", async ({ page }) => {
  await page.goto("/legal");
  await expect(page).toHaveURL(/\/legal\/privacy$/);
});
