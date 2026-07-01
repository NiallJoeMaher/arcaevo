# Prompt for Claude Code

Paste the following (and include this folder in the repo or working directory):

---

Build the production website for **Arcaevo**, a health membership for Ireland, from the design package in `design_handoff_arcaevo_site/`.

**Start by reading `design_handoff_arcaevo_site/README.md` in full.** It contains the page inventory, route map, design tokens, business rules, and SEO plan. The HTML files in `designs/` are high-fidelity design references — open them to inspect exact styles (all styling is inline on elements) — but recreate them as real components; do not ship the HTML.

## Stack
- Next.js (App Router) + TypeScript, deployed on Vercel (EU region)
- Styling: Tailwind (map the README's design tokens to the theme) or CSS modules — pick one and stay consistent
- Fonts via `next/font`: Instrument Serif, Hanken Grotesk, Geist Mono
- Content for versus pages, blog articles and legal docs: lift the data objects out of the corresponding `.dc.html` script blocks into typed content files (JSON/MDX), one static path per slug

## Order of work
1. Layout shell: `SiteNav`, `SiteFooter`, fonts, tokens, base metadata
2. Home, then Pricing (these encode the business model — copy prices and copy exactly: Fusion €119/yr, Essential €329/yr hero, Performance €399/yr; annual only; quarterly upgrade +€130; add-ons €99/€69/€199)
3. Remaining marketing pages: How it works, Science, App, About, Careers, Contact
4. Data-driven pages: Compare + `/compare/[slug]`, Blog + `/blog/[slug]`, `/legal/[doc]`, Help (accordion, one item open at a time)
5. SEO/AEO per README: per-route titles/descriptions, JSON-LD (Organization + Product on home/pricing; FAQPage + Article on versus/articles; BreadcrumbList on comparisons), sitemap, robots, OG cards
6. `/admin` as an auth-gated skeleton matching `Admin.dc.html` (mock data is fine)

## Hard constraints
- Pixel-fidelity to the designs: colors, type scale, radii, spacing, copy — verbatim
- v1 integrations are **Apple Watch + Apple Health only**; WHOOP/Oura/Garmin must appear only as "on the roadmap"
- Wellness-first language everywhere; never diagnosis claims; keep the disclaimers that appear in the designs
- EU-hosted posture is a selling point — don't add any US-hosted third-party scripts; analytics is PostHog (EU instance) if added
- Accessible: semantic landmarks, one H1 per page, focus states, alt text
- No new content: if a section seems missing, flag it rather than inventing copy

When done, run a link check across all routes (the designs are fully link-complete) and confirm Lighthouse ≥ 95 on performance/SEO/accessibility for Home and Pricing.
