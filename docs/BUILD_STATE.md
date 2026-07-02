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
- [x] Lighthouse ≥95 perf/SEO/a11y on Home + Pricing — Home 97/100/100, Pricing 97/100/100 (mobile default). Caption/footer grays darkened minimally + founder-note link underlined to pass WCAG 4.5:1 (smallest shifts that pass; noted as deliberate deviation from design token #7C887F → #5F6A62)
- [ ] xcodebuild succeeds for iOS + watch targets — BLOCKED: needs admin rights for `xcodebuild -runFirstLaunch` (Xcode 16.4 missing system content). Compensating: full `xcrun swiftc -emit-object` compiles clean for both targets
- [x] `cdk synth` passes
- [x] `docker compose up --build` running and healthy, seeded — web :3000, mongo host :27019 (27017/27018 held by other projects), mongo-express :8083 (8081/8082 held by other projects)

## V2 — accounts, auth, commerce (handoff: design_handoff_v2/, started 2026-07-02 morning)

Spec: `design_handoff_v2/README.md` (rules) + `designs/AccountFlows.dc.html` (19 sections, all screens/emails/edge states). iOS Prototype.dc.html deferred until user hands over native design updates.

Non-negotiables: email + magic-link auth only (no social, no SIWA at launch); Eircode gate only at checkout for Essential/Performance (routing-key allowlist = config, fail → waitlist + Fusion cross-sell); GDPR Art.9 consent screen (3 purposes, research off by default, versioned, revocable); results never in email; dunning 0/3/10/14 → read-only pause, nothing deleted; renewal email cancel = equal weight; uploaded bloodwork → user confirms every AI value, self-reported = hollow gold dots; payment on web only (Stripe mock + Apple Pay on web mock).

### Phase 10 — v2 backend (src/lib + api + emails)
- [x] Models: Consent (purpose/version/timestamp/surface), WaitlistEntry (routing key, county), GiftCode, ReferralCode, ShareLink (expiry/revoked/access log), MagicLinkToken, Session; User gains optional passwordHash + failed-attempt cooloff; BiomarkerReading gains source: lab|self_reported
- [x] Member auth: session cookie, /join /signin magic-link + password flows, 30-min single-use links (60s resend throttle), 5-fail 15-min cooloff, non-revealing responses, reset signs out other sessions
- [x] Eircode eligibility: config collection seeded with launch allowlist (D01–D18, D20, D22, D24, D6W, A94, A96, K32, K34, K36, K45, K56, K67, K78), routing-key-only validation, rejected keys logged
- [x] Consent grants API (versioned, re-consent trigger), waitlist join/position, checkout API (mock Stripe), gift/redeem, GP share links, bloodwork upload confirm (mock AI extraction)
- [x] 11 transactional emails, one layout, rendered to Mongo outbox (E1–E11 per §12/§14)
- [x] Seed extensions + unit tests for eircode/magic-link/dunning logic

### Phase 11 — product web app (new routes)
- [ ] /join /signin /verify /consent per §03–04 (edge states included)
- [ ] /checkout (3 steps: eligibility → details → payment) /early-access /welcome per §05–07
- [ ] /book /gift /redeem /s/[token] per §08, §15–16
- [ ] /account /account/security /account/privacy per §10, §17 (delete flow: type-DELETE, export first)

### Phase 12 — marketing updates (v2 deltas only)
- [x] Pricing CTAs → /join (Fusion) and /checkout (Essential/Performance) with eligibility hint lines
- [x] "AI" copy replaces vendor names on Science + App pages (verify against v2 designs) — Science updated; App/Home designs are byte-identical v1→v2 (no changes needed); full-src grep clean of vendor names in marketing copy

### Phase 13 — admin additions
- [ ] /admin/waitlist (demand by county), /admin/eligibility (Eircode config editor), /admin/consent (audit log) per §18

### Phase 14 — v2 verification
- [ ] e2e: join→verify→consent flow (magic link via outbox), eircode pass (D08) / fail (T12) → waitlist, checkout mock, account pages, pricing CTA targets
- [ ] Full regression: existing 24 e2e + 69 unit tests stay green; build + Lighthouse spot-check

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

- 2026-07-02: Phase 12 complete — v2 marketing deltas applied. Pricing plan CTAs rerouted: Start Fusion /contact → /join (hint "Available everywhere — nothing ships"), Start Essential /contact → /checkout (hint "Dublin service area — quick Eircode check first"), Start Performance /contact → /checkout (same hint); hint lines styled per Pricing.dc.html (11.5px centered, caption / muted-dark-soft). Science copy de-vendored per v2 design: hero "Claude rewrites" → "The AI rewrites", pillar 04 "Claude turns the rule output" → "The AI turns the rule output". v1→v2 design diff confirmed only Pricing + Science changed (App/Home/Versus/Article byte-identical); src grep shows no vendor names left in marketing copy (remaining "Claude" is a code comment in api/v1/insights, out of marketing scope). `npx next build` green; verified via curl of fresh prod build on :3100 (all pricing figures verbatim, new hrefs + hints present, no vendor names on /, /app, /science). NOTE: e2e webServer port :3000 is held by the docker compose web container (stale pre-v2 image), so pricing.spec.ts wasn't run against the new build — spec only asserts figures, all curl-verified verbatim; rerun e2e after docker image rebuild or with :3000 free.

- 2026-07-02 (04:40): Phase 9 complete (bar blocked xcodebuild). E2E: 24 Playwright tests green (routes/links/pricing/help/admin/API/SEO). Lighthouse Home + Pricing 97/100/100. A11y contrast fixes: caption #7C887F→#5F6A62 (globals token), strip label #9AA39C→#6C756E, footer #6E7E74→#7E8E84 + #5B6A61→#79897F, founder-note link underlined. Full docker stack up + seeded (web :3000, mongo :27019, mongo-express :8083). vitest 69 green, tsc clean. BUILD DONE.

- 2026-07-02: Phase 10 complete — v2 backend. src/lib: models.ts v2 section (Consent/WaitlistEntry/GiftCode/ReferralCode/ShareLink/MagicLinkToken/Session/EligibilityConfig/EligibilityRejection/BloodworkUpload + CONSENT_VERSION; User gains passwordHash/emailVerified/failedAttempts/cooloffUntil; Membership gains "pending" status + dunningStage/dunningStartedAt; BiomarkerReading gains source lab|self_reported — seed migrated), db.ts 10 new typed collections, member-auth.ts (opaque 256-bit session tokens stored SHA-256-hashed in `sessions` — chosen over signed cookies for per-session revocation; scrypt passwords; 30-min single-use magic links w/ 60s throttle, hash-only storage; 5-fail→15-min cooloff; old demo bearer still works — auth.ts memberFromRequest now resolves demo bearer OR bearer session token OR session cookie), eligibility.ts (extractRoutingKey case/space tolerant incl. D6W, allowlist from `eligibility_config` seeded w/ 31 launch keys, rejects logged key-only), dunning.ts (pure 0/3/10/14 ladder, paused=read-only, resolve=instant resume), consents.ts (append-only versioned grants + re-consent detection), emails.ts (E1–E11, one layout, verbatim §12/§14 copy; E7 params make values unrepresentable; E8 equal-weight cancel; sent via outbox), vendors/ai-extraction.mock.ts (deterministic per-value-confidence extraction, "41 or 47?" flag blocks confirm). 18 new/extended routes: auth/signup·magic-link(+verify)·signin·signout·reset(+confirm), consents GET/POST, eligibility/check, waitlist POST/GET, checkout (guest-inline, server-side gate, pending membership), gift + gift/redeem (year starts at activation, buyer gets one data-free email), share GET/POST + share/[token] GET public w/ access log/DELETE revoke, uploads/bloodwork + confirm (writes self_reported readings), webhooks/stripe extended (dunning progression, E9 on first fail only, E4 on checkout completion, invoice.paid resumes). Seed: eligibility config, 3 rejections, 2 waitlist entries, 6 consents, share link /s/k7f2demo, GIFT-DEMO-2026, AOIFE-K4, self-reported vitamin_d point, e2e password member demo@arcaevo.test / demo-password-123 (mem_0026, fixed-salt scrypt, no membership). Tests: +53 vitest (eligibility 13, member-auth 15, dunning 8, emails 14 + 3 updated model fixtures) → 122 green; tsc clean; next build passes; seed verified on :27019; all new routes smoke-tested live (signin/cooloff msg, magic-link verify single-use, throttle 429, checkout D08 pass/T12 403, dunning day0→day3 via webhook, upload→confirm, share revoke→410, outbox E1/E2/E4/E9 verified). MOCKED_APIS.md §11–15 added (AI extraction, member auth notes, Apple Pay via Stripe mock, GeoIP, clinician persona).
