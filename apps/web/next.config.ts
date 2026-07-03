import type { NextConfig } from "next";

/**
 * Content-Security-Policy.
 *
 * The app renders inline JSON-LD (<script type="application/ld+json">) and
 * relies on Next's inline bootstrap/runtime scripts, so script-src needs
 * 'unsafe-inline'. Styles are inlined by Next too, hence 'unsafe-inline' on
 * style-src. frame-ancestors 'none' kills clickjacking of the GP-share
 * clinical pages (belt-and-braces with X-Frame-Options: DENY).
 */
const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline'",
  // Analytics (PostHog EU, stubbed off unless a key is set) posts here.
  "connect-src 'self' https://eu.i.posthog.com",
].join("; ");

/** Applied to every route. */
const baseSecurityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "Content-Security-Policy", value: csp },
];

const nextConfig: NextConfig = {
  // Standalone output for the multi-stage Dockerfile (node server.js runner).
  output: "standalone",

  async headers() {
    return [
      // Security headers on everything.
      { source: "/:path*", headers: baseSecurityHeaders },

      // Token-bearing pages: never leak the token via the Referer header when
      // the user clicks an outbound link (magic-link verify + GP share).
      {
        source: "/verify",
        headers: [{ key: "Referrer-Policy", value: "no-referrer" }],
      },
      {
        source: "/s/:token",
        headers: [{ key: "Referrer-Policy", value: "no-referrer" }],
      },

      // PII / health-data surfaces must never be cached by a CDN or shared
      // cache. Covers authenticated account pages, the GP-share clinical page,
      // and every API response (member data, health readings, admin).
      {
        source: "/account/:path*",
        headers: [{ key: "Cache-Control", value: "private, no-store" }],
      },
      {
        source: "/account",
        headers: [{ key: "Cache-Control", value: "private, no-store" }],
      },
      {
        source: "/s/:token",
        headers: [{ key: "Cache-Control", value: "private, no-store" }],
      },
      {
        source: "/api/:path*",
        headers: [{ key: "Cache-Control", value: "private, no-store" }],
      },
    ];
  },
};

export default nextConfig;
