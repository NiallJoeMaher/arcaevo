import { canonicalUrl } from "@/lib/seo";

/**
 * /llms.txt — a machine-readable entity + facts sheet for AI crawlers
 * (ChatGPT, Perplexity, Google AI Overviews). Complements robots.txt and
 * sitemap.xml; states the EU/GDPR positioning and the wellness-not-diagnosis
 * posture in a form AI answer engines can quote directly.
 *
 * Facts (name, prices, positioning) are verbatim from the site — nothing new.
 */

export const dynamic = "force-static";

function body(): string {
  const u = (p: string) => canonicalUrl(p);
  return `# Arcaevo

> The interpretation layer for your health. Arcaevo is a Dublin, Ireland
> health membership that fuses at-home finger-prick blood tests with your
> Apple Watch, reads every marker against your own baseline, and turns the
> result into a short, prioritised plan — then proves at your next test
> whether it worked.

## Entity
- Name: Arcaevo (legal: Arcaevo Health)
- Based in: Dublin, Ireland
- Area served: Ireland (EU expansion planned)
- Category: Wellness / preventive health membership (at-home blood testing +
  wearable fusion). Not a clinic, not a diagnostic service.

## Positioning
- EU-native and GDPR-first: your data is stored in the EU (eu-west-1),
  never sold, and used only to build your trends and coaching.
- Fusion: bloods and Apple Watch signals (sleep, HRV, VO2max, activity) on
  one timeline, so a marker's story is explained, not just listed.
- Your-baseline change detection using Reference Change Value (RCV): a change
  is only flagged when it exceeds analytical + biological noise.
- The "did it work?" loop: interventions are checked at the next test.
- Every panel is reviewed by a registered clinician before release.

## Wellness, not diagnosis
Arcaevo provides wellness and educational insights. It does not diagnose,
prescribe, or replace medical care. The AI coach narrates results and
deterministic rules in plain English; it cannot diagnose or set thresholds.
Anything clinical is flagged to a reviewing doctor and, where needed, your GP.

## Pricing (annual membership, EUR, tests included)
- Fusion — EUR 119/yr: your Apple Watch and your own uploaded bloodwork.
- Essential — EUR 329/yr: two blood tests a year, twice-yearly tracking,
  clinician-reviewed. Most popular.
- Performance — EUR 399/yr: deep venous panel (80+ markers), Dublin mobile
  phlebotomy (nurse visit) included, priority clinician review.
- Add-ons: quarterly upgrade +EUR 130/yr; single tests EUR 99 (full panel),
  EUR 69 (recheck), EUR 199 (venous draw with nurse visit).
Every price includes the kit or nurse visit, postage both ways, lab
processing, clinician sign-off and full app access. No hidden fees.

## Wearable integrations
- Live: Apple Watch and Apple Health.
- On the roadmap: WHOOP, Oura and Garmin (not available today).

## Key pages
- Home: ${u("/")}
- How it works: ${u("/how-it-works")}
- The science: ${u("/science")}
- The app: ${u("/app")}
- Pricing: ${u("/pricing")}
- Compare (Arcaevo vs alternatives): ${u("/compare")}
- Arcaevo vs WHOOP: ${u("/compare/whoop")}
- Arcaevo vs Oura: ${u("/compare/oura")}
- The Journal (articles): ${u("/blog")}
- Help centre: ${u("/help")}
- About: ${u("/about")}
- Trust & legal: ${u("/legal")}
- Sitemap: ${u("/sitemap.xml")}
`;
}

export function GET(): Response {
  return new Response(body(), {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}
