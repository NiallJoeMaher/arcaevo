import { test, expect } from "@playwright/test";

/**
 * Security headers (next.config.ts headers()): clickjacking + transport + CSP
 * on every route, no-referrer on token-bearing pages (magic-link + GP share),
 * and no-store caching on PII / API responses.
 */

test("base security headers are present on a normal page", async ({ request }) => {
  const res = await request.get("/", { maxRedirects: 0 });
  const h = res.headers();
  expect(h["x-frame-options"]).toBe("DENY");
  expect(h["x-content-type-options"]).toBe("nosniff");
  expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(h["strict-transport-security"]).toContain("max-age=");
  expect(h["strict-transport-security"]).toContain("includeSubDomains");
  expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(h["content-security-policy"]).toContain("default-src 'self'");
});

test("token-bearing pages use Referrer-Policy: no-referrer", async ({
  request,
}) => {
  const verify = await request.get("/verify", { maxRedirects: 0 });
  expect(verify.headers()["referrer-policy"]).toBe("no-referrer");

  const share = await request.get("/s/k7f2demo", { maxRedirects: 0 });
  expect(share.headers()["referrer-policy"]).toBe("no-referrer");
  expect(share.headers()["cache-control"]).toContain("no-store");
});

test("API responses are marked private, no-store (no CDN caching of PII)", async ({
  request,
}) => {
  const res = await request.post("/api/v1/auth/demo", { maxRedirects: 0 });
  const cache = res.headers()["cache-control"] ?? "";
  expect(cache).toContain("no-store");
  expect(cache).toContain("private");
});
