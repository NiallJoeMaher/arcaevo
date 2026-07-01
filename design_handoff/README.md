# Handoff: Arcaevo — Marketing Site + Admin (Ireland launch)

## Overview
Arcaevo is a health membership for Ireland: members connect their Apple Watch, order a blood test, and the app fuses the two into plain-language insights read off their **own baseline** — then proves whether changes worked ("did it work?" loop). This bundle contains the complete marketing website, help/legal surfaces, and an internal ops/admin dashboard skeleton.

## About the Design Files
The files in `designs/` are **design references created in HTML** (self-contained prototypes; open any `.dc.html` directly in a browser — `support.js` must sit next to them). They show intended look and behavior. **They are not production code to copy.** The task is to recreate these designs in the target codebase — the spec calls for **Next.js** for the web — using its established patterns. If no codebase exists yet, scaffold Next.js (App Router) + React and implement there.

`designs/Handover.dc.html` is a self-documenting build-package page: open it in a browser for the route map, component inventory, data model, and SEO/AEO plan rendered visually.

## Fidelity
**High-fidelity.** Colors, typography, spacing, copy and layout are final. Recreate pixel-perfectly. All styling in the prototypes is inline on the elements, so every value can be read directly off the source.

## Pages
Every page shares `SiteNav` (top) and `SiteFooter` (bottom) except Admin and Handover.

| Design file | Production route | Purpose |
|---|---|---|
| Home.dc.html | `/` | Hero + five differentiators + how it works + pricing teaser + founder note + CTA |
| Pricing.dc.html | `/pricing` | 3 tiers, cadence upgrade, plan comparison table, market context, FAQ |
| HowItWorks.dc.html | `/how-it-works` | 4-step walkthrough |
| Science.dc.html | `/science` | Baseline/RCV methodology, deterministic-rules trust story |
| App.dc.html | `/app` | iOS + Apple Watch app feature tour |
| Compare.dc.html | `/compare` | Competitor comparison index |
| Versus.dc.html | `/compare/[slug]` | Data-driven versus pages (prototype uses `?c=slug`) |
| Blog.dc.html | `/blog` | Building-in-public blog index |
| Article.dc.html | `/blog/[slug]` | Articles (prototype uses `?post=slug`) |
| About.dc.html | `/about` | Story + principles |
| Careers.dc.html | `/careers` | Roles + perks |
| Help.dc.html | `/help` | FAQ accordion (4 groups) |
| Contact.dc.html | `/contact` | Contact/support |
| Legal.dc.html | `/legal/[doc]` | Privacy, terms, consent, data-deletion, DPA (prototype uses `?doc=`) |
| Admin.dc.html | `/admin` (auth-gated) | Ops dashboard: KPIs, members, results review, support queue |

Data-driven pages (Versus, Article, Legal) keep their content as structured JS objects inside the file's `<script data-dc-script>` block — lift that data into CMS/MDX/JSON as appropriate.

## Business rules baked into the designs (do not change copy that encodes these)
- **Tiers, billed annually only (v1):** Fusion €119/yr · Essential €329/yr (hero, "MOST POPULAR") · Performance €399/yr.
- Essential = 2 finger-prick tests/yr (full baseline panel + lighter recheck), clinician-reviewed. Performance = 1 venous panel (80+ markers) + Dublin mobile phlebotomy. Fusion = no tests; Apple Watch/Health sync + upload past bloodwork.
- **Cadence upgrade:** quarterly = Essential + €130/yr. Single add-ons: €99 full panel, €69 recheck, €199 venous draw.
- No monthly billing at launch (FAQ explains why). Refunds: full before kit ships/draw booked; none once sample processed.
- **Integrations v1: Apple Watch + Apple Health only.** WHOOP, Oura, Garmin are "on the roadmap" — always presented that way.
- Wellness positioning, never diagnosis: "Not a medical device. Not a diagnosis. Consult a doctor." Deterministic rules decide logic; AI (Claude) only narrates. EU data residency (eu-west-1), GDPR Article 9 two-step consent, export/delete self-serve, 18+.

## Design Tokens
Colors
- Bone (page bg): `#ECE7DD`
- Surface (cards): `#FBFAF6`
- Ink (text / dark sections): `#1C2620`
- Forest (primary accent, CTAs): `#1E5C45`
- Vitality (highlight green, badges, chart lines): `#34A07C` (light tints `#7FD3AE`, `#9AD3B8`, `#CFE6DB`)
- Amber (secondary/warning): `#D99A4E`
- Muted text: `#4A554D` (on light), `#9FB0A6` / `#8FA89A` (on dark), `#7C887F` (captions)

Typography (Google Fonts)
- Display: **Instrument Serif** 400, tight tracking (−0.01 to −0.015em), sizes 26–62px (`clamp()` on heroes)
- UI/body: **Hanken Grotesk** 300–800; body 14–19px, line-height 1.55–1.65
- Data/labels: **Geist Mono** 400/500; 9–13px, letter-spacing 0.06–0.16em, uppercase kickers

Shape & depth
- Card radius 14–24px; pills/buttons `border-radius:100px`
- Hairlines: `rgba(28,38,32,0.08–0.16)` on light, `rgba(255,255,255,0.12–0.15)` on dark
- Card shadow (dark hero cards): `0 24px 50px -28px rgba(28,38,32,0.6)`
- Buttons: solid Forest on light, solid Bone-white (`#F4F1EA`) on dark; outlined variants 1px Ink/white(0.24–0.4)
- Selection: Forest bg, `#F4F1EA` text. Links: `opacity:.72` on hover.

Layout
- Content max-widths: 1180px (marketing), 1100px (grids/tables), 900px/760–820px (prose/FAQ)
- Section padding ~72–84px vertical, 40px horizontal; grids use `gap` 12–48px

## Interactions & Behavior
- Help accordion: one item open at a time (`+`/`−` sign swap)
- Versus/Article/Legal: content switches by param; production = static paths per slug
- Admin: tabbed views (dashboard, members, results, support); status pills tinted by state
- Hover: links/buttons fade to 0.72 opacity, `transition: opacity .15s`
- No heavy animation anywhere — calm, editorial feel

## SEO / AEO plan (from Handover page)
- Unique `<title>` + meta description per route; one H1 per page; self-referencing canonicals
- `Organization` + `Product` JSON-LD on home & pricing; `FAQPage` + `Article` JSON-LD on versus/articles; `BreadcrumbList` on comparisons
- Versus and article pages lead with a direct-answer block and use a question H1
- `sitemap.xml`, `robots.txt`, Open Graph + Twitter cards

## State Management & Data
Marketing site is essentially static. Entities to model for the product/admin (see Handover page for fields): User, Membership (tier, term, renewal), TestOrder (kit/venous, status), BiomarkerReading (value, baseline band, RCV verdict), BiomarkerRule, WearableSignal (`source: apple_health` in v1). Payments: Stripe annual subscriptions.

## Assets
No raster assets. All visuals are inline SVG/CSS (charts, rings, device frames). Fonts load from Google Fonts.

## Files
- `designs/*.dc.html` — the 16 pages + `SiteNav` / `SiteFooter` shared components + `Handover` build-package page
- `designs/support.js` — prototype runtime (needed only to open the prototypes; irrelevant to production)
- `PROMPT.md` — ready-to-paste prompt for Claude Code
