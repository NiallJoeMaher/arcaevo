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
- [ ] Design tokens in globals.css, fonts in layout, base metadata
- [ ] SiteNav + SiteFooter components
- [ ] Home `/` (pixel-fidelity)
- [ ] Pricing `/pricing`

### Phase 2 — Content extraction (apps/web/src/content)
- [ ] Versus/compare data → `src/content/compare.ts`
- [ ] Blog articles → `src/content/articles.ts`
- [ ] Legal docs → `src/content/legal.ts`
- [ ] Help FAQ groups → `src/content/help.ts`

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

### Phase 9 — Verification
- [ ] `npm run build` passes in apps/web
- [ ] Link check across all routes
- [ ] Lighthouse ≥95 perf/SEO/a11y on Home + Pricing
- [ ] xcodebuild succeeds for iOS + watch targets
- [ ] docker compose config validates

## Wanted deps (agents append here instead of installing)

(none yet)

## Log

- 2026-07-02: Loop started. Repo scaffolded, plan written.
