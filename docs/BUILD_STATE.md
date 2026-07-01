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
- [ ] Initial commit

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
- [ ] /how-it-works, /science, /app, /about, /careers, /contact
- [ ] /compare + /compare/[slug], /blog + /blog/[slug], /legal/[doc], /help

### Phase 4 — SEO/AEO
- [ ] Per-route metadata, JSON-LD (Organization+Product, FAQPage+Article, BreadcrumbList), sitemap.ts, robots.ts, OG cards

### Phase 5 — API + data layer (apps/web)
- [ ] Mongo connection lib + typed models (User, Membership, TestOrder, BiomarkerReading, BiomarkerRule, WearableSignal)
- [ ] Seed script (`npm run seed`)
- [ ] REST API routes under /api/v1 (members, orders, results, insights, sync) consumed by iOS app + admin
- [ ] Mock LetsGetChecked adapter + mock Stripe adapter behind interfaces
- [ ] Admin auth (env password session)

### Phase 6 — Admin dashboard
- [ ] /admin auth-gated skeleton per Admin.dc.html (dashboard, members, results, support tabs)

### Phase 7 — iOS + watchOS (apps/ios)
- [ ] XcodeGen project.yml (iOS app + watchOS app targets)
- [ ] SwiftUI iOS app: onboarding, dashboard (baseline/insights), results, orders, settings
- [ ] HealthKit integration layer (real reads where possible; mock data source fallback)
- [ ] watchOS companion: today ring + latest insight
- [ ] API client pointing at web /api/v1
- [ ] Builds with xcodebuild (verify)

### Phase 8 — Infra (infra/cdk)
- [ ] CDK app: eu-west-1; stacks documented (Atlas is external — document connection via secrets)
- [ ] `cdk synth` passes

### Phase 9 — Tests + verification (USER REQUIREMENT: e2e-testable when done)
- [ ] `npm run build` passes in apps/web
- [ ] Unit tests (vitest) for lib logic (RCV verdicts, refund rules, vendor mocks)
- [ ] Playwright e2e suite: all routes render, pricing figures verbatim, help accordion, admin login + tabs, API smoke (order lifecycle via mock LGC)
- [ ] Link check across all routes
- [ ] Lighthouse ≥95 perf/SEO/a11y on Home + Pricing
- [ ] xcodebuild succeeds for iOS + watch targets
- [ ] `cdk synth` passes
- [ ] `docker compose up --build` running and healthy at end of build (web :3000, mongo :27017, mongo-express :8081), seeded

## Wanted deps (agents append here instead of installing)

(none yet)

## Log

- 2026-07-02: Loop started. Repo scaffolded, plan written.
- 2026-07-02: Phase 1 complete — design tokens mapped in globals.css @theme (colors, hairlines, radii, shadows; selection/link-hover/focus-visible base styles), fonts (Instrument Serif, Hanken Grotesk, Geist Mono via next/font) + base metadata (title template, metadataBase) in layout.tsx, SiteNav/SiteFooter components, pixel-faithful Home `/` and `/pricing` pages, default scaffold page + public SVGs removed. `npx next build` passes with zero errors.
- 2026-07-02: Phase 2 content extraction done — compare.ts (8 versus pages + compare index), articles.ts (4 blog posts + blog index), legal.ts (7 docs), help.ts (4 FAQ groups), index.ts barrel. Verbatim from designs; typed unions; `npx tsc --noEmit` passes.
