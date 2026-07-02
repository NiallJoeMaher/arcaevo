import { test, expect } from "@playwright/test";

/**
 * Link check across all routes (handoff requirement): collect every internal
 * <a href> from every sitemap page and assert each resolves 200 (following
 * redirects).
 */

test("every internal link on every page resolves", async ({ request }) => {
  test.setTimeout(240_000);
  const sitemap = await request.get("/sitemap.xml");
  const pages = [...(await sitemap.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map(
    (m) => new URL(m[1]).pathname
  );

  const hrefs = new Set<string>();
  for (const path of pages) {
    const res = await request.get(path);
    expect(res.status(), `page ${path}`).toBe(200);
    const html = await res.text();
    for (const m of html.matchAll(/<a[^>]+href="([^"#]+)"/g)) {
      const href = m[1];
      if (
        href.startsWith("/") &&
        !href.startsWith("//") &&
        !href.startsWith("/api/")
      ) {
        hrefs.add(href.split("?")[0]);
      }
    }
  }

  expect(hrefs.size).toBeGreaterThan(10);
  const broken: string[] = [];
  for (const href of [...hrefs].sort()) {
    const res = await request.get(href, { maxRedirects: 5 });
    // /admin redirects to /admin/login for anonymous users — a 200 landing.
    if (res.status() !== 200) broken.push(`${href} → ${res.status()}`);
  }
  expect(broken, `broken links:\n${broken.join("\n")}`).toEqual([]);
});
