# Arcaevo — Build State

This file is the single source of truth for the autonomous overnight build loop.
Every loop iteration: read this file first, do the next unchecked work, update this file, commit.

## Architecture decisions (locked)

- **Monorepo layout**: `apps/web` (Next.js 15 App Router + TS + Tailwind, standalone npm project), `apps/ios` (Swift/SwiftUI iOS + watchOS via XcodeGen `project.yml`), `infra/cdk` (AWS CDK v2, TypeScript, standalone npm project), `design_handoff/` (versioned copy of the design package), `docs/`.
- **No npm workspaces** — each JS project is self-contained to avoid hoisting issues.
- **Styling**: Tailwind v4 with the handoff design tokens mapped in `globals.css` `@theme`.
- **Fonts**: `next/font/google` — Instrument Serif, Hanken Grotesk, Geist Mono.
- **Data**: MongoDB (local via docker-compose; Atlas in prod). Driver: official `mongodb` package via `apps/web/src/lib/db.ts`. No Mongoose.
- **Auth (admin)**: v1 = signed session cookie + single admin password from env (`ADMIN_PASSWORD`). Documented as mock/placeholder in MOCKED_APIS.md.
- **Payments**: Stripe — MOCKED (no keys). Blood testing: LetsGetChecked — MOCKED. See docs/MOCKED_APIS.md.
- **Analytics**: PostHog EU — stubbed off by default (no US-hosted scripts, per handoff).
- **Region**: eu-west-1 everywhere in CDK.
- **Hosting (user-confirmed 2026-07-02)**: Vercel (EU region, fra1/dub1) is the primary host for apps/web — fastest to market. The Dockerfile + docker-compose stack is kept working at all times so we can move to AWS (ECS/Fargate via CDK) later without a rewrite. CDK covers the AWS-side footprint only (secrets, exports bucket); no duplicate web hosting infra unless we migrate.

## Ground rules for agents

- Do NOT run `npm install` or edit `package.json` in apps/web — deps are preinstalled (next, react, tailwind v4, mongodb, zod). If you need another dep, record it under "Wanted deps" below and code around it.
- Pixel-fidelity to `design_handoff/designs/*.dc.html`; copy text verbatim. No invented copy.
- v1 integrations: Apple Watch + Apple Health only; WHOOP/Oura/Garmin only ever "on the roadmap".
- Wellness language, never diagnosis. Keep all disclaimers from designs.
- Prices verbatim: Fusion €119/yr · Essential €329/yr (MOST POPULAR) · Performance €399/yr; annual only; quarterly upgrade +€130/yr; add-ons €99 full panel / €69 recheck / €199 venous draw.

## Status

### Phase 0 — Repo foundation
- [x] Monorepo dirs, design handoff copied to `design_handoff/`
- [x] Next.js scaffolded at `apps/web`, deps installed (incl. mongodb, zod)
- [x] docker-compose.yml (mongo + mongo-express + web)
- [x] docs/MOCKED_APIS.md
- [x] Initial commit

### Phase 1 — Web foundation (apps/web)
- [x] Design tokens in globals.css, fonts in layout, base metadata
- [x] SiteNav + SiteFooter components
- [x] Home `/` (pixel-fidelity)
- [x] Pricing `/pricing`

### Phase 2 — Content extraction (apps/web/src/content)
- [x] Versus/compare data → `src/content/compare.ts`
- [x] Blog articles → `src/content/articles.ts`
- [x] Legal docs → `src/content/legal.ts`
- [x] Help FAQ groups → `src/content/help.ts`

### Phase 3 — Remaining marketing pages
- [x] /how-it-works, /science, /app, /about, /careers, /contact
- [x] /compare + /compare/[slug], /blog + /blog/[slug], /legal/[doc], /help

### Phase 4 — SEO/AEO
- [x] Site-wide SEO infra: src/lib/seo.ts (SITE_URL, canonicalUrl, jsonLd, Organization/Product schema), Organization+Product JSON-LD on Home & Pricing, canonicals for / and /pricing, sitemap.ts (30 URLs), robots.ts (disallow /admin,/api), default opengraph-image.tsx + twitter-image.tsx
- [x] Per-route metadata + FAQPage/Article/BreadcrumbList JSON-LD (shipped by the route-building agents: FAQPage+Breadcrumb on versus, Article+FAQPage on blog posts)

### Phase 5 — API + data layer (apps/web)
- [x] Mongo connection lib + typed models (User, Membership, TestOrder, BiomarkerReading, BiomarkerRule, WearableSignal)
- [x] Seed script (`npm run seed`)
- [x] REST API routes under /api/v1 (members, orders, results, insights, sync) consumed by iOS app + admin
- [x] Mock LetsGetChecked adapter + mock Stripe adapter behind interfaces
- [x] Admin auth (env password session)

### Phase 6 — Admin dashboard
- [x] /admin auth-gated skeleton per Admin.dc.html (dashboard, members, results, support tabs) — login + HMAC-cookie gate, (panel) route group with admin chrome/sidebar, 4 tab pages, review sign-off action via POST /api/v1/admin/results/[id]/review (verified live: queue 30 → 29), graceful Mongo-down/empty-DB notices with `npm run seed` hint. Agent stalled during a final edge-case check; core flows verified, build green with all /admin routes.

### Phase 7 — iOS + watchOS (apps/ios)
- [x] XcodeGen project.yml (iOS app + watchOS app targets)
- [x] SwiftUI iOS app: onboarding, dashboard (baseline/insights), results, orders, settings
- [x] HealthKit integration layer (real reads where possible; mock data source fallback)
- [x] watchOS companion: today ring + latest insight
- [x] API client pointing at web /api/v1
- [ ] Builds with xcodebuild (verify) — blocked on this machine: Xcode 16.4 system content missing (`IDESimulatorFoundation` plugin fails to load; `xcodebuild -runFirstLaunch` needs admin auth). `xcodegen generate` succeeds; all sources fully compile per-target via `xcrun swiftc -emit-object` against iphonesimulator + watchsimulator SDKs.

### Phase 8 — Infra (infra/cdk)
- [x] CDK app: eu-west-1; stacks documented (Atlas is external — document connection via secrets)
- [x] `cdk synth` passes

### Phase 9 — Tests + verification (USER REQUIREMENT: e2e-testable when done)
- [x] `npm run build` passes in apps/web
- [x] Unit tests (vitest) for lib logic (RCV verdicts, refund rules, vendor mocks)
- [x] Playwright e2e suite: 24 tests / 7 specs, all green (routes+h1/title, link crawl, pricing verbatim, help accordion, admin login/tabs/sign-off, API smoke incl. mock-LGC order lifecycle + wearable source rejection, SEO/JSON-LD). `npm run e2e` (prod build + standalone server + seeded Mongo on host :27019)
- [x] Link check across all routes (links.spec.ts crawls every internal href on every sitemap page)
- [ ] Lighthouse ≥95 perf/SEO/a11y on Home + Pricing
- [ ] xcodebuild succeeds for iOS + watch targets
- [x] `cdk synth` passes
- [ ] `docker compose up --build` running and healthy at end of build (web :3000, mongo host :27018 — 27017 is held by an unrelated container, mongo-express :8081), seeded

## Wanted deps (agents append here instead of installing)

- `vitest` (dev, apps/web) — unit tests for lib logic: rcv.ts verdicts/baseline bands (pure functions, test-ready), stripe.mock refund rules, LGC mock state machine. Add `"test": "vitest run"` to scripts once installed.
- `@playwright/test` (dev, apps/web) — Phase 9 e2e suite (routes render, pricing verbatim, admin login + tabs, API smoke via mock LGC order lifecycle).

## Log

- 2026-07-02: Loop started. Repo scaffolded, plan written.
- 2026-07-02: Phase 1 complete — design tokens mapped in globals.css @theme (colors, hairlines, radii, shadows; selection/link-hover/focus-visible base styles), fonts (Instrument Serif, Hanken Grotesk, Geist Mono via next/font) + base metadata (title template, metadataBase) in layout.tsx, SiteNav/SiteFooter components, pixel-faithful Home `/` and `/pricing` pages, default scaffold page + public SVGs removed. `npx next build` passes with zero errors.
- 2026-07-02: Phase 2 content extraction done — compare.ts (8 versus pages + compare index), articles.ts (4 blog posts + blog index), legal.ts (7 docs), help.ts (4 FAQ groups), index.ts barrel. Verbatim from designs; typed unions; `npx tsc --noEmit` passes.
- 2026-07-02: Phase 3 (part 1) done — six marketing pages built pixel-faithfully from designs: /how-it-works (4-step walkthrough, fusion-engine explainer + hs-CRP/HRV chart, "what lands in your app"), /science (4 pillars, RCV formula card + verdict pills, marker evidence, wellness-not-diagnosis safety bar → /legal/clinical-safety), /app (iPhone + Watch mockups, 6-feature grid, v1 = Apple Watch/Health/iPhone with WHOOP·Oura·Garmin "soon" dashed pill), /about (story, 3 values, stats band, team, careers/contact CTA), /careers (perks + 5 roles linking to /contact), /contact (channel list + client-component prototype form with sent-state, GP/112 disclaimer). Verbatim copy, per-route metadata, SiteNav active props, aria-hidden decorative visuals, labelled form fields. `npx next build` passes with zero errors.
- 2026-07-02: Phase 3 (part 2) done — data-driven pages built from src/content modules, pixel-faithful to designs: /compare (summary row + 8 competitor cards), /compare/[slug] (8 SSG versus pages: question H1, short-answer block, at-a-glance table, wins cards, honest take, People-also-ask, CTA + more-comparisons chips; FAQPage + BreadcrumbList JSON-LD, per-slug metadata), /blog (featured dark card w/ chart SVG + 3 gradient-glyph cards), /blog/[slug] (4 SSG articles: exhaustive ArticleBlock union render, answer-first, takeaways, CTA, related; Article + FAQPage JSON-LD), /legal/[doc] (7 SSG docs w/ sticky sidebar nav, rights card, verbatim prototype disclaimer footer) + /legal → /legal/privacy redirect, /help (category chips + 4-group accordion client component: one open across page, +/− swap, buttons w/ aria-expanded/aria-controls, item 0-0 open by default). One H1/page, semantic landmarks, breadcrumb navs. `npx next build` passes — all 19 static paths generate.
- 2026-07-02: Phases 5 + 8 complete — platform layer: src/lib (db.ts Mongo singleton + typed collection accessors, models.ts zod schemas incl. pricing/allowance constants, rcv.ts pure RCV verdict + baseline-band logic, auth.ts HMAC admin cookie + demo bearer token, analytics.ts PostHog-EU no-op stub) and src/lib/vendors (types.ts interfaces; letsgetchecked.mock.ts deterministic state machine + seeded results; stripe.mock.ts deterministic ids + refund rule; email.mock.ts → Mongo outbox — all loudly `// MOCK:` commented). 17 REST routes under /api/v1 (auth/demo, admin login/logout, members ×3, orders ×2 w/ tier-allowance + €99/€69/€199 add-on pricing, results + admin review queue/action, insights w/ deterministic templates + AI-narration slot noted, sync/wearables apple_health-only w/ roadmap rejection, LGC + Stripe webhooks (signature = documented no-op stubs), admin/kpis, admin/support). scripts/seed.ts (`npm run seed`, deterministic, anchor 2026-07-01): 25 members (demo mem_0001 Aoife Byrne ↔ demo-member-token), 15 biomarker rules, 13 orders across every pipeline state, 67 readings (30 in review queue) incl. full "did it work?" story (ApoB/LDL-C/glucose/hs-CRP improved beyond RCV at recheck), 360 wearable signals (90d × 4 types), 6 tickets, 4 outbox emails — verified against Mongo 7 in Docker. Dockerfile (deps→build→runner, node:20-alpine, standalone; next.config.ts output:"standalone"), .env.example. infra/cdk hand-written CDK v2 stack (eu-west-1: exports S3 bucket + 3 Secrets Manager placeholders; README: Vercel hosts web, Atlas external) — `npx cdk synth` passes; `npx tsc --noEmit` clean in apps/web. NOTE: host port 27017 was occupied by another project's container (assemblpro-mongodb) during this run — compose `mongo` couldn't bind; seed was verified against a temporary mongo:7 on :27019 (since removed). Free 27017 before the final `docker compose up --build`.
- 2026-07-02: Phase 7 built — apps/ios: XcodeGen project.yml (Arcaevo iOS 17 app w/ HealthKit entitlement + usage string, ArcaevoWatch watchOS 10 companion, shared ArcaevoKit sources group compiled into both targets); ArcaevoKit models (User/Membership/TestOrder/BiomarkerReading/WearableSignal/Insight) + async APIClient → http://localhost:3000/api/v1 w/ static demo bearer token + seeded DemoDataProvider fallback (app always demos); iOS screens (3-page onboarding + HealthKit prompt + mock sign-in, Today w/ readiness ring + Swift Charts sparklines + "did it work?" card, Results grouped by panel w/ baseline bands + RCV verdict tints, Orders w/ 6-step status timeline + add-on POST, Settings w/ tier + Apple Health state + export/delete links + disclaimer); HealthKit layer (real HKHealthStore HRV/RHR/sleep/VO2max behind HealthDataProviding, MockHealthStore auto-selected in simulator/denied); watch single-view today ring + latest insight + test status; apps/ios/README.md. `xcodegen generate` OK; xcodebuild blocked locally (Xcode system content missing, `-runFirstLaunch` needs admin) — verified instead via full `xcrun swiftc -emit-object` compile of both targets against iOS + watchOS simulator SDKs (clean).
- 2026-07-02: Phase 9 unit tests done — vitest suite for apps/web lib: vitest.config.ts (node env, src/**/*.test.ts, @/* alias) + `test`/`test:watch` scripts; 5 files / 69 tests under src/lib/__tests__ (rcv.ts verdict math incl. inclusive RCV boundary + zero-prior guard + baseline bands/rounding/negative means; models.ts seed-shaped docs accepted, bad enums rejected (tier/order status/wearable source), pricing constants verbatim 119/329/399 + 130 + 99/69/199 and tier allowances; stripe.mock refund rule (full refund only while "ordered", 0 after) + deterministic cs_mock_/sub_mock_ ids; letsgetchecked.mock state machine (ordered→…→results_ready one step per poll, forward-only clamp) + seeded result determinism via an in-memory Mongo fake that evaluates the vendor's real $set/$min/$add pipeline — no Mongo spun up; auth.ts HMAC sign→verify roundtrip, tampered payload/sig, non-admin role signature, wrong SESSION_SECRET, ADMIN_PASSWORD checks via vi.stubEnv). next/headers + @/lib/db stubbed in unit tests; cookie-store integration + real-Mongo LGC/pipeline behavior deferred to Playwright e2e. No lib bugs found. `npm test` all green; `npx tsc --noEmit` clean.
