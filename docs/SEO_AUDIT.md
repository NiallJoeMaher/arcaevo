# Arcaevo — SEO / AEO Audit & Plan

_Compiled 2026-07-05. Read-only audit of the marketing site under `apps/web`. This is a PLAN — no code was changed. A follow-up pass implements the backlog in §6._

Companion docs: `STRATEGY.md` (positioning/competitors), `BUILD_STATE.md` Phase 4 (what shipped), `MOCKED_APIS.md`.

**Guardrail that constrains every recommendation:** wellness-not-diagnosis. Nothing here recommends schema, copy or markup that claims medical/diagnostic status. WHOOP/Oura/Garmin stay "on the roadmap." Prices are contractual (€119/€329/€399).

---

## 0. TL;DR

The SEO/AEO foundation is genuinely good for a pre-launch site — Lighthouse 97/100/100, self-hosted fonts, static generation, Organization + Product(3 priced Offers) JSON-LD, and a best-in-class **AEO content pattern** (direct "short answer" blocks, comparison tables, FAQ, key takeaways) already live on the versus and blog templates. The gaps are concentrated in three places:

1. **Config + coverage plumbing** — canonicals exist on only 2 of ~18 indexable routes; `NEXT_PUBLIC_SITE_URL` defaults to `localhost:3000` (a launch-blocking landmine for canonicals/OG/sitemap); no explicit Open Graph/Twitter metadata; no hreflang.
2. **Schema left on the table** — the `/help` page is a pure FAQ with **no FAQPage schema**; `Article` schema omits `datePublished`; `BreadcrumbList` is missing everywhere except versus pages; Organization is a weak entity (empty `sameAs`, no logo); comparison/pricing tables are `<div>` grids, not semantic `<table>` (hurts AEO extraction + featured snippets).
3. **The two headline competitors have no versus pages** — per `STRATEGY.md`, WHOOP and Oura are the validated fusion competitors, yet there is **no `/compare/whoop` and no `/compare/oura`**, and no "WHOOP alternative Europe" / "Oura alternative EU" content. This is the single biggest content opportunity and nobody in the EU owns it.

Top 10 ranked actions in §6.

---

## 1. Technical SEO

### 1.1 Site URL / metadataBase — **launch-blocking**
- `src/lib/seo.ts` `SITE_URL` and `layout.tsx` `metadataBase` both fall back to `http://localhost:3000` when `NEXT_PUBLIC_SITE_URL` is unset (`.env.example:93` ships the localhost value).
- **Consequence if unset in Vercel prod:** every canonical, OG `url`, JSON-LD `url`/`item`, and `sitemap.xml` entry emits `localhost:3000` — canonicals would deindex the real domain. This must be verified as a hard go-live gate.
- **Action:** set `NEXT_PUBLIC_SITE_URL=https://<prod-domain>` in Vercel (all environments) and add a preview-vs-prod check to `GO_LIVE_RUNBOOK.md`.

### 1.2 Canonical coverage — **incomplete**
- Only `src/app/page.tsx` and `src/app/pricing/page.tsx` set `alternates: { canonical: ... }`. Next.js does **not** emit a `<link rel="canonical">` unless you set it, so ~16 indexable routes ship **no canonical**: `/how-it-works`, `/science`, `/app`, `/about`, `/compare`, `/blog`, `/help`, `/careers`, `/contact`, and every dynamic `/compare/[slug]`, `/blog/[slug]`, `/legal/[doc]`.
- **Action:** add `alternates.canonical` to every indexable static page and to the three `generateMetadata` functions (`compare/[slug]/page.tsx:18`, `blog/[slug]/page.tsx:22`, `legal/[doc]/page.tsx`). Relative paths resolve off `metadataBase`.

### 1.3 Open Graph / Twitter — **image-only, no metadata object**
- `opengraph-image.tsx` and `twitter-image.tsx` exist and are distinct (good — Next auto-attaches them + `twitter:card` + `og:image` to all routes).
- But **no route defines an `openGraph` or `twitter` metadata object**, so `og:url`, `og:type`, `og:site_name`, and article timestamps are never emitted; `og:title`/`og:description` only inherit page title/description.
- **Actions:**
  - Add site-wide `openGraph` (`type: "website"`, `siteName: "Arcaevo"`, `locale: "en_IE"`, `url`) and `twitter` (`card: "summary_large_image"`, `site`/`creator` once handles exist) to `layout.tsx`.
  - On `blog/[slug]`, set `openGraph.type = "article"` with `publishedTime` (from `post.date`) + `authors`.
  - **Bigger bet:** per-template dynamic OG images for `blog/[slug]` and `compare/[slug]` (route-level `opengraph-image.tsx` rendering the title/competitor) — meaningfully lifts social + AI-surface CTR.

### 1.4 Structured data — what exists vs what should
| Schema | Status | Gap / action |
|---|---|---|
| `Organization` | ✅ `seo.ts` (home + pricing) | Weak entity: `sameAs: []` empty, no `logo`, `contactPoint`, `areaServed`, `foundingLocation`. Fill `sameAs` (LinkedIn/X/Crunchbase), add `logo`, `areaServed: "IE"`/`"EU"`, `email`. Knowledge-graph fuel. |
| `Product` + 3 `Offer` | ✅ `seo.ts` (home + pricing) | Prices correct (119/329/399 EUR). Add `priceValidUntil`, `category`, and `image` per Offer; consider `hasMerchantReturnPolicy`. **Do not** fabricate `aggregateRating`/`review` (no real reviews yet + overclaim risk). |
| `FAQPage` | ✅ compare/[slug], blog/[slug] | **Missing on `/help`** — it is a pure FAQ accordion (`help/page.tsx`, `content/help.ts`) with zero schema. Highest-value schema add. |
| `Article` | ✅ blog/[slug] | Missing `datePublished`/`dateModified` (**`post.date` exists in content but is not mapped** — Google Article needs a date), `image`, `author.url`. |
| `BreadcrumbList` | ✅ compare/[slug] only | Missing on `blog/[slug]` (visual breadcrumb rendered, no schema), `legal/[doc]`, `/help`. Add matching schema wherever a breadcrumb is shown. |
| `WebSite` | ❌ none | Add a `WebSite` node (entity/knowledge-graph). `SearchAction`/sitelinks-searchbox is **N/A** (no on-site search) — skip until search exists. |
| `MedicalWebPage` / `MedicalOrganization` / `MedicalClinic` | ❌ none | **Deliberately avoid.** These assert clinical/diagnostic identity and collide with the wellness-not-diagnosis posture. Keep `Organization`. (If ever added, `MedicalWebPage` on `/science` only, with `lastReviewed` and explicit wellness framing — not this pass.) |
| `HowTo` | ❌ none | `/how-it-works` (Test → Understand → Act) fits, but Google **deprecated HowTo rich results (2023)** — low ROI. Optional/skip. |

### 1.5 Semantic tables — **AEO + a11y issue**
- The "At a glance" comparison (`compare/[slug]/page.tsx:118–142`) and the pricing comparison (`pricing/page.tsx` `COMPARISON_ROWS`) are rendered as CSS-grid `<div>`s, **not `<table>`/`<th>`/`<td>`**. LLMs and Google's snippet extractor parse semantic tables far more reliably; grids also weaken screen-reader semantics.
- **Action:** convert both to real `<table>` markup (keep the styling). Directly improves AEO citation of the head-to-head rows and featured-snippet eligibility.

### 1.6 Sitemap
- `sitemap.ts` covers all static routes + versus + articles + legal with `priority` + `changeFrequency` — solid. `/admin` and `/api` correctly excluded; noindexed private routes correctly absent.
- **Weakness:** `lastModified = new Date()` for **every** URL, recomputed each build → a non-stable, low-trust `lastmod`. Use real content dates where available (`post.date` for articles) and a stable build/deploy date otherwise.

### 1.7 robots + indexation hygiene — **good**
- `robots.ts` disallows `/admin`, `/api`; points at `sitemap.xml`.
- Private/transactional routes correctly carry `robots: { index: false }`: `/account/*`, `/checkout`, `/book`, `/consent`, `/join`, `/signin`, `/verify`, `/welcome`, and critically **`/s/[token]`** (tokenised share pages exposing member health data — correctly noindexed + `force-dynamic`). This is done right.
- **Minor:** `/early-access`, `/gift`, `/redeem` are indexable — confirm that's intended (likely fine; low-value thin pages could be noindexed).

### 1.8 hreflang / localization — **absent, and on the roadmap**
- `layout.tsx` sets `lang="en"` (generic). `STRATEGY.md` implies an EU-English/US-English split is coming; several US competitors are explicitly contrasted.
- **Actions:** (a) quick win now — set `lang="en-IE"` and `openGraph.locale="en_IE"` to anchor the Ireland market; (b) when localized routes exist, add `alternates.languages` with `en-IE` (primary), `en-GB`, `en-US`, and `x-default`. Flag as a real future need, not a day-1 build.

### 1.9 Core Web Vitals / mobile / crawlability — **strong, keep**
- Lighthouse 97/100/100 on Home + Pricing (mobile) per `BUILD_STATE.md`. Fonts via `next/font` (self-hosted, `display: swap`). Static generation via `generateStaticParams` on all dynamic routes. Decorative visuals are inline SVG/CSS (no heavy image payloads). No client-side data fetching on marketing routes. Nothing to fix; protect these when adding OG images/tables.
- **Minor:** no `manifest`/`theme-color`. Low priority.

### 1.10 Internal linking
- Nav (`SiteNav.tsx`) links how-it-works, pricing, science, app, compare, blog. Footer links about/careers/contact/help/legal/*. Versus pages cross-link each other; blog articles cross-link `related`; both link to `/pricing`. Good baseline.
- **Gaps:** (a) **no cross-linking between content types** — versus pages don't link relevant articles and vice-versa (e.g. `/compare/function-health` ↔ the ApoB article); (b) money pages (`/pricing`, `/how-it-works`) don't pull in supporting blog/compare content; (c) `/compare` and `/blog` index pages are the only paths into that content from nav — add contextual in-body links.

---

## 2. Content / keyword strategy

### 2.1 Existing assets
- **8 versus pages:** letsgetchecked, randox-health, thriva, function-health, medichecks, zoe, everlab, superpower (`content/compare.ts`).
- **4 articles:** apob-vs-cholesterol, how-often-blood-test-ireland, reference-change-value, wearables-and-bloods-fusion (`content/articles.ts`).
- Content model is strong: every versus/article leads with a **direct answer** block and ships FAQ/takeaways — ideal for snippets and AI citation.

### 2.2 The glaring gap: no WHOOP, no Oura
- `STRATEGY.md` names **WHOOP Advanced Labs** and **Oura Health Panels** as the validated fusion competitors (the whole thesis). There is **no `/compare/whoop` and no `/compare/oura`** — and no Ultrahuman, Vitara, Bevel/Athlytic.
- These are the highest-volume, highest-intent comparison queries in the category ("WHOOP vs …", "Oura vs …", "WHOOP blood test", "Oura Advanced"). Owning the EU angle ("your data stays in the EU", "no US data transfer") on these pages is defensible white space.
- **Action (top content bet):** add versus pages for **WHOOP** and **Oura** first, then Ultrahuman/Vitara — reusing the existing `VersusPage` model. Keep the "on the roadmap" framing for wearable integrations; the comparison is Arcaevo-membership vs their offering, not a device teardown.

### 2.3 Ireland / EU money keywords — under-served
Only `how-often-blood-test-ireland` targets a local query. Target clusters (map to new articles or landing sections):
- **Local commercial:** "blood test Dublin", "private blood test Ireland", "at-home blood test Ireland", "finger-prick blood test Ireland", "blood test cost Ireland" (contrast Randox's up-to-€2,437 top tier at a quarter of the cost — a real, verified angle from `STRATEGY.md`).
- **Biomarker / longevity:** "ApoB test Ireland" (leverage the existing ApoB article), "ferritin test Ireland", "hs-CRP test", "longevity blood test Ireland", "vitamin D test Ireland".
- **Wearable / recovery:** "Apple Watch recovery", "Apple Watch HRV meaning", "blood-informed recovery" — aligns with the recovery-score moat in `STRATEGY.md`.
- **Category-defining (nobody in EU owns):** "WHOOP alternative Europe/Ireland", "Oura alternative EU", "GDPR blood test", "EU health data testing".

### 2.4 Scale the Journal
- 4 articles is thin. The template is excellent; the constraint is volume. Prioritise pieces that double as AEO answer targets AND feed the keyword clusters above (e.g. "How much does a blood test cost in Ireland?", "What is ApoB and should I test it?", "Can Apple Watch measure recovery?").

---

## 3. AEO / GEO (being cited by ChatGPT / Perplexity / Google AI Overviews)

- **Strengths to protect:** the "THE SHORT ANSWER" direct-answer block (2–3 sentences, top of page), comparison tables, "People also ask" FAQ, and "Key takeaways" are textbook citation bait. This is the site's best AEO asset — keep every new page to this pattern.
- **Fixes that raise citation rate:**
  1. **Semantic `<table>`** for comparisons (§1.5) — LLM extractors lift structured rows far more reliably than div-grids.
  2. **FAQPage on `/help`** (§1.4) — turns the help centre into an answer source.
  3. **Dates on Article** (§1.4) — recency is a ranking/citation signal for AI answers.
  4. **Entity clarity** — fill Organization `sameAs`/`logo`/`areaServed` (§1.4) so Arcaevo resolves as a distinct entity in the knowledge graph; keep NAP (name/locality) identical across footer, schema, and any future GBP.
  5. **`llms.txt`** — add `/llms.txt` (and optionally `/llms-full.txt`) listing the canonical pages, one-line entity description, pricing facts, and the wellness-not-diagnosis disclaimer. Cheap, increasingly consumed by AI crawlers, and lets us state the EU/GDPR positioning in machine-readable form. (Complements, doesn't replace, robots/sitemap.)
- **Keep answer blocks factual and self-contained** (entity + claim + qualifier in the first sentence) — that's the unit AI answers quote.

---

## 4. Local / EU targeting

- **Ireland anchoring (quick wins):** `lang="en-IE"`, `openGraph.locale="en_IE"`, `areaServed: "IE"` in Organization schema. Home hero already reads "THE INTERPRETATION LAYER · DUBLIN" — reinforce with the schema/locale signals.
- **hreflang:** plan `en-IE` / `en-GB` / `en-US` + `x-default` once the localization split ships (§1.8).
- **GDPR-native as a differentiator — lean in harder.** Copy already carries it strongly ("EU-NATIVE", "Your data never leaves the EU", "GDPR · EU-HOSTED" — `page.tsx`). Extend it into: (a) a dedicated evergreen page/section targeting "GDPR blood test" / "EU health data" (contrasting the US bases of Function/Superpower/Ultrahuman/WHOOP — verified in `STRATEGY.md`); (b) `knowsAbout`/`areaServed` schema signals; (c) the WHOOP/Oura versus pages' primary wedge. This is a real, defensible, on-brand SEO moat — no overclaim needed.
- **Google Business Profile / LocalBusiness schema:** only pursue if a genuine Dublin service address (or verifiable mobile-phlebotomy service area) exists. **Do not** emit `LocalBusiness`/street address that can't be verified — the current Organization schema (Dublin locality, no street) is honest; keep it until there's a real address. Mobile phlebotomy (Performance tier) could justify a service-area GBP later.

---

## 5. What's already done well (don't regress)

- Static generation + `next/font` + Lighthouse 97/100/100.
- Organization + Product(3 priced Offers) JSON-LD with correct contractual prices.
- FAQPage + BreadcrumbList (versus), Article + FAQPage (blog).
- Distinct `opengraph-image` + `twitter-image`.
- Rigorous noindex on every private/transactional route, incl. tokenised share pages.
- The direct-answer / table / FAQ / takeaways AEO content pattern.
- robots + sitemap correctly scoped.

---

## 6. Prioritised backlog (impact × effort)

**Quick wins (high impact, low effort) — do first:**

| # | Action | Impact | Effort | Files |
|---|---|---|---|---|
| 1 | **Set `NEXT_PUBLIC_SITE_URL` in Vercel prod** + go-live guard | Critical (prevents localhost canonicals/OG/sitemap) | XS | env / `GO_LIVE_RUNBOOK.md` |
| 2 | **`alternates.canonical` on all ~16 uncovered routes** | High | S | all `page.tsx` + 3 `generateMetadata` |
| 3 | **FAQPage schema on `/help`** | High (AEO + rich result) | S | `help/page.tsx` |
| 4 | **Add `datePublished`/`dateModified` (+image, author.url) to Article schema** | High | XS | `blog/[slug]/page.tsx` (map `post.date`) |
| 5 | **Site-wide `openGraph`/`twitter` metadata** (+`og:type=article`, `publishedTime` on blog) | Med-High | S | `layout.tsx`, `blog/[slug]` |
| 6 | **`lang="en-IE"` + `locale="en_IE"` + Organization `sameAs`/`logo`/`areaServed`** | Med-High (entity/local) | S | `layout.tsx`, `seo.ts` |
| 7 | **BreadcrumbList on blog/[slug], legal, help; WebSite node site-wide** | Med | S | `blog/[slug]`, `legal/[doc]`, `help`, `seo.ts` |
| 8 | **Convert comparison + pricing tables to semantic `<table>`** | Med (AEO/a11y/snippets) | M | `compare/[slug]`, `pricing` |
| 9 | **`/llms.txt`** with entity/pricing/EU-positioning + disclaimer | Med (GEO) | XS | `public/` or route |
| 10 | **Real `lastmod` in sitemap + cross-content internal links** | Low-Med | S | `sitemap.ts`, content pages |

**Bigger content bets (high impact, higher effort) — schedule next:**

- **A. `/compare/whoop` + `/compare/oura` versus pages** (then Ultrahuman/Vitara) — the biggest organic opportunity; reuse the `VersusPage` model, lead with the EU/GDPR wedge. _(Highest content ROI; ranks above several quick wins on impact, listed here because it's a content/effort investment.)_
- **B. Ireland money-keyword article cluster** — "blood test cost Ireland", "ApoB test Ireland", "private blood test Ireland", "Apple Watch recovery" (§2.3).
- **C. Dedicated "your data stays in the EU / GDPR blood test" page** contrasting US-based competitors (§4).
- **D. Per-template dynamic OG images** for blog + compare (§1.3).
- **E. Sustained Journal cadence** on the answer-first template (§2.4).

---

## 7. Explicitly NOT recommended (guardrails)

- No `MedicalOrganization`/`MedicalClinic`/`Physician`/`MedicalWebPage` schema that asserts diagnostic identity (wellness-not-diagnosis).
- No fabricated `aggregateRating`/`review` (no real reviews; overclaim risk).
- No `LocalBusiness`/street address unless a verifiable one exists.
- No copy positioning WHOOP/Oura/Garmin as anything but "on the roadmap."
- `SearchAction`/sitelinks-searchbox deferred until on-site search exists.
</content>
</invoke>
