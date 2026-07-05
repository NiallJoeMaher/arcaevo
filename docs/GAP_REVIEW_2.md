# Arcaevo — Gap & Improvement Review #2 (pre-TestFlight / pre-prod)

_Read-only review, 2026-07-05. Acting as Tech-CEO / QA before a TestFlight + pre-prod dev-cohort test, then public launch. No code changed. Interim controller: Codú Limited._

_This is the **second** gap review. It does **not** re-litigate the first (`docs/IMPROVEMENT_REVIEW.md`, 2026-07-05) — that document's headline items (payment-gating hole, `invoice.paid` idempotency, DB indexes, ingestion-time RCV correctness, real fusion on `/insights`, web `logError`, iOS background HealthKit, iOS Sentry, daily re-engagement nudge) are **verified shipped and on `main`** (commits `3d5c266`, `1d5b08d`, `cf58144`, `5eddfc9`; `origin/main == main`, working tree clean). The security audit + admin hardening are also confirmed clean. This review targets what is **still** missing or weak. See the "Already handled — don't worry" list before reacting to anything._

**Companion docs consulted:** `BUILD_STATE.md`, `MOCKED_APIS.md`, `PRELAUNCH_CHECKLIST.md`, `GROWTH_AND_ENGAGEMENT.md`, `OBSERVABILITY.md`, `DNS_EMAIL_AND_PREPROD.md`. Where they already flag an item, this review confirms it in code and sharpens it.

---

## The one thing to internalise

The build is **further along than a founder would fear** — money is now collected, consent is server-enforced, erasure runs, the engines are strong, and the security posture is genuinely tight. The remaining risk has shifted to a different shape: **the app looks more finished than it is because fabricated clinical content is presented as real member data on the surfaces a tester or an App-review reviewer will hit first**, the two score engines still disagree, and the retention/notification layer is built but has no trigger. None of these are large. Several are hours. But three of them will get a TestFlight build **rejected** or mislead a real user about their own health, so they gate the *external* cohort.

A useful distinction the `PRELAUNCH_CHECKLIST` already draws, and this review keeps: **an internal TestFlight to yourself + a few people who _know_ it's demo-grade is fine today.** An **external beta / real strangers' real health data** is not — and the blockers below are exactly why.

---

## Executive summary — TOP 10 gaps (ranked by impact × proximity-to-launch)

| # | Gap | Area | Impact | Effort | Hard blocker for…? |
|---|-----|------|--------|--------|--------------------|
| 1 | **iOS shows fabricated clinician-signed results & insights to real logged-in members in Release** (Results/Insights/Today/Fusion/Ask-Arcaevo/watch all render hardcoded fiction under the member's real name) | iOS / trust | Critical | M | **External TestFlight + App Review** (2.3 placeholder-content + health scrutiny) |
| 2 | **Fabricated clinician "Dr. S. Nolan, IMC 412887" shown to users _and their GPs_ as a real medical review** with a real-looking IMC number, no honesty disclaimer | Web / legal | Critical | M | **Any cohort that sees a GP-share or results email** (Medical Council / advertising exposure) |
| 3 | **watchOS app has no AppIcon; `DEVELOPMENT_TEAM` unset on all targets** | iOS build | High | S | **Any TestFlight upload** (App Store Connect validation reject) |
| 4 | **Member shell self-activates for free in Release** — "I've finished checkout — continue" flips `plan` with no payment check, landing a reviewer on the fabricated results | iOS | High | S | **App Review** (reviewer reaches #1 without paying) |
| 5 | **RCV threshold drift web↔iOS still open** — all 5 shared markers differ; no server-owned source, no fetch path, no parity test | Data correctness | High | M | Not a build blocker; a **correctness/credibility** blocker before real bloods |
| 6 | **Retention loop has no trigger:** 10 of 12 iOS push cards unreachable, no APNs at all, and clinician sign-off sends the member **no** email/push | Wiring | High | M | No (post-launch), but it's the founder's stated #1 worry |
| 7 | **Insights blank for new / single-panel / self-upload members** (`clinicianReviewed:true` AND `series.length>=2`); no first-panel baseline | Product / UX | High | S | No, but it's the **day-one empty screen** for the first cohort |
| 8 | **"Export my data" is a no-op** in the account page **and** the delete flow — GDPR portability promised, nothing sent | Privacy | High | S–M | **Honesty blocker** before real users (or fix the copy) |
| 9 | **Pre-prod deploy foot-guns:** Vercel Cron doesn't run on preview deploys (erasure won't fire on `dev.`), `eligibility_config` is seed-only (won't populate on Vercel), SES sandbox silently drops tester email, `.env.prod` empty, no `maxPoolSize` | Deploy | High | S | **Pre-prod correctness** (each is a config step) |
| 10 | **Observability half-dark:** no client-side PostHog (no pageview/funnel), Sentry DSN empty on iOS + web Sentry not installed, recheck orders untracked, no health-check endpoint | Observability | Medium-High | M | No, but you'll fly blind through the cohort |

**Hard blockers for the _external_ TestFlight / real dev-cohort:** #1, #2, #3, #4 (Apple + legal), plus the pre-prod config steps in #9. **#5–#8, #10 are launch-quality gaps, not upload blockers** — but #7 and #8 will visibly hurt the first cohort's experience and trust. For a purely **internal** TestFlight (you + informed testers), only #3 (the icon/team, needed to upload at all) truly blocks.

---

## 1. Wiring gaps — "built but not fired"

The single strongest pattern (echoed in `GROWTH_AND_ENGAGEMENT.md`): **retention surfaces and copy exist; the trigger does not.**

**1a. 10 of 12 iOS push cards are structurally unreachable (High).** `NotificationPlanner.plan()` (`apps/ios/Arcaevo/Notifications/NotificationPlanner.swift:222`) supports 12 cards with verbatim copy + unit tests, but the only app→planner bridge, `refresh()` (`:380`), sets **only** `learnedWakeTime`, `forecastDipHour`, `scheduleMorningReadiness`. The anchors `resultsReadyAt`, `nextTestDate`, `weeklyFocusAt`, `vitalsOutOfBandAt`, `experimentVerdictAt`, `recheckDueAt`, `monthlyVitalityAt`, `criticalPendingAt`, `sickModeEnteredAt` are **never assigned anywhere**. So only `.readiness` and `.energyDip` can fire; **test reminders, results-ready, verdict, recheck, weekly, monthly, vitals** cannot. The code admits it (`:376`). _Fix:_ populate the anchors from data the app already fetches (order status → test/recheck dates; RCV verdict present → verdict card; results reviewed → results card). Effort **M**; high perceived-aliveness for low work.

**1b. No APNs path exists (High).** No `registerForRemoteNotifications`, no `aps-environment` entitlement in any of the four `.entitlements` files. Every notification is a local `UNCalendarNotificationTrigger`. Consequence: the highest-value nudge — **"your results are in"**, an inherently server-side event — **cannot be delivered as a push at all**. _Fix:_ APNs is a heavier follow-up (Apple push key + device-token registration + a server sender). For the trial, at minimum wire the _local_ results card (1a) so it surfaces on next foreground. Effort **M–L** for real APNs; **S** for the local card.

**1c. Clinician sign-off notifies the member of nothing (High).** `api/v1/admin/results/[id]/review/route.ts` flips `clinicianReviewed`, rewrites the note, writes an audit log — and **enqueues no email and no push**. The one member-facing email (fired earlier from the LGC webhook, `webhooks/letsgetchecked/route.ts:159`) says results are merely "queued for clinician review." So at the exact moment results become safe to view, the member is told nothing. _Fix:_ send E7 on sign-off (the template already exists — see 1d). Effort **S**.

**1d. 5 of 12 E-code emails are defined but never enqueued (Medium).** In `src/lib/emails.ts`: **E5 kit-shipped, E6 sample-received, E7 results-ready** (bypassed — the webhook sends an ad-hoc `template:"results_ready"` body instead of the polished E7), **E8 renewal, E11 county-open** all have renderers + tests but **no call site**. E11 in particular gates waitlist→paying conversion. There are also two parallel email paths (`sendEmail()` for E-codes vs raw `emailVendor.send()` with free-form bodies in `reset/confirm`, `gift/redeem`, `orders`, LGC webhook) — inconsistent and worth consolidating. _Fix:_ enqueue E5/E6 on the LGC status transitions, route the webhook + sign-off through E7, wire E8/E11 to crons (see 3). Effort **S–M**.

**1e. No client-side PostHog; two funnel events don't exist (High for measuring the cohort).** All 11 `capture()` calls are **server-side** and every _defined_ event fires (verified: `analytics.ts` → checkout/consents/waitlist/gift/webhook/erasure). But there is **no `posthog-js`, no `PostHogProvider`, no pageview capture** — so no page views, time-on-page, pricing-scroll or CTA-click funnel. Two obvious events are simply **not defined**: `pricing_view` (impossible without client instrumentation) and `recheck_ordered` (`api/v1/orders/route.ts` fires zero analytics — paid recheck conversions are invisible). Also `capture()` is `void fetch(...).catch(()=>{})` with no `await`/`waitUntil`, so on a fast Vercel invocation the last event before response (e.g. `CheckoutCompleted` in the webhook) can be **dropped on freeze**. _Fix:_ add a client `PostHogProvider` + pageview; add `recheck_ordered`; `waitUntil` the server captures. Effort **M**.

**1f. iOS fusion is still the demo fixture (Medium).** The review-#1 fix built a real server `computeFusionInsight` (`src/lib/fusion.ts`) exposed on `GET /insights` as a `fusion` key — but iOS `FusionTimelineV3View.swift` still draws from `MemberV3Demo.fusionMarkers`/`wearSeries`. The real computation exists and is unused on the surface that sells the differentiator. _Fix:_ decode the server `fusion` key on iOS. Effort **M**.

---

## 2. Untested / risky paths

Coverage of **pure logic is strong** (web ~414 vitest incl. new referral/dunning/erasure/consent-guard/idempotency/SigV4 suites; iOS 56 XCTest). The gaps are at the **route-handler and client-integration seams**:

- **`checkout.session.completed` activation + the referral-credit trigger are not route-tested (highest risk).** `webhook-invoice-idempotency.test.ts` covers `invoice.paid`, but no test drives a signed/mock `checkout.session.completed` through the handler to assert membership→active + receipt, and `creditReferralOnActivation` is tested only as an isolated fn — never through the webhook that fires it (`webhooks/stripe/route.ts:167,385`). This is the money + access-grant path.
- **iOS watch auth 401-retry is untested.** `WatchAuthManager` (`:100-156`) implements the "one silent refresh then one retry, else signed-out" contract that `e2e/watch-session.spec.ts` is built against — but the **client half has zero tests**.
- **SES live send path untested.** `email-ses.test.ts` proves the SigV4 signer against AWS vectors, but `sendViaSes` (`email.ses.ts:240`) — the actual HTTP POST, the non-2xx throw, and the fire-and-forget **swallow** (the "a dead mailer must never break the API request" invariant) — has no test. A mis-handled SES failure throwing into a request is exactly the kind of thing you'd want a test to pin.
- **`invoice.payment_failed` dunning wiring not route-tested.** The state machine (`dunning.test.ts`) is solid, but "E9 fires exactly once" and "a re-delivered `payment_failed` doesn't double-advance the ladder" are unverified through the handler.
- **`REFERRAL_MAX_CREDITED` cap untested** (the farming brake, `referral.ts:269`).
- **iOS AppModel demo/real seam untested** — the API-unreachable → `DemoDataProvider` fallback (`AppModel.swift:120-136`) is exactly the code that could leak demo data to a real user on a backend blip; no test guards it.
- **E2E gaps (each unit-covered, so lower risk):** `account/portal` redirect, referral flow, the account-**delete submit** (e2e only _arms_ the button, never submits), the admin **MFA enrolment gate**, the obscured admin slug, and a 429 rate-limit assertion. No iOS UI tests at all.

_Strong, no action:_ erasure runner, consent-withdrawal→session/share revocation, dunning state machine, SigV4 signer, `invoice.paid` idempotency, watch-session e2e.

---

## 3. Pre-prod / deploy readiness (Vercel)

On Vercel every deploy (incl. preview) runs `NODE_ENV=production`, so the fail-closed paths are active on pre-prod too — good. The docs (`DNS_EMAIL_AND_PREPROD.md`, `ENVIRONMENTS_AND_SETUP.md`, `.env.example`, `.env.preprod`) are genuinely thorough. Code-level foot-guns that remain:

- **Vercel Cron runs on _Production_ deployments only, not preview/branch deploys (High).** `vercel.json` schedules one cron (`/api/v1/cron/run-erasure`, `0 3 * * *`, `dub1`). If `dev.arcaevo.com` is the git-branch preview the DNS doc describes, **the erasure drain will not fire there**. Auth is correct (`cronRequestAuthorized`). _Fix:_ run `npm run erase:run` manually against pre-prod, or treat the pre-prod deploy as Production. Also there is **no alert if the prod cron fails** (`PRELAUNCH 6.2`, still ⛔).
- **`eligibility_config` is seed-only and won't populate on Vercel (High).** `instrumentation.ts` runs `ensureIndexes()` (indexes only). The Eircode routing-key allowlist (`db.ts:169`) is written by `scripts/seed.ts`, which never runs on Vercel. Empty → eligibility checks may reject **every** Essential/Performance address. _Fix:_ seed the pre-prod Atlas DB once, or verify the eligibility route fails open on an empty collection (not confirmed).
- **SES sandbox silently drops tester email (High for the cohort).** `EMAIL_PROVIDER=ses` + sandbox = only pre-verified recipients receive mail, fire-and-forget, no user-facing error. Documented, with the 6-char code fallback as mitigation. Also **`EMAIL_FROM` must be a verified SES identity** — `.env.preprod` overrides the code default `hello@arcaevo.com` to `no-reply@arcaevo.com`; if that address/domain isn't verified, every send 400s.
- **`.env.prod` is 0 bytes** — production env not yet populated (launch blocker, not pre-prod). Three `[SET ME]` placeholders remain in `.env.preprod`: `MONGODB_URI`, `STRIPE_WEBHOOK_SECRET`. `STRIPE_WEBHOOK_SECRET` unset → the webhook fails closed → checkout completes at Stripe but **membership never activates**.
- **No `maxPoolSize` on the Mongo client (Medium, scale).** `db.ts` correctly caches a global singleton, but with the driver default (100) each warm lambda can open up to 100 connections; many lambdas can exceed an M0/M10 Atlas cap. Set `maxPoolSize: 10` before public launch.
- **No health-check endpoint** (`/api/health`) for uptime monitoring (`PRELAUNCH 6.3`). One-file add.

_Confirmed fine:_ all absolute URLs (emails, magic-link, share, referral, Stripe return) build from `NEXT_PUBLIC_SITE_URL`/`siteUrl()` — none hardcode `arcaevo.com` at runtime; indexes **do** get created on Vercel cold start; rate-limiting is Mongo-backed (not per-instance); `proxy.ts` is Node-runtime safe (no `node:crypto` in the middleware path); OG/twitter images use system fonts and render; `output:"standalone"` is harmless on Vercel.

---

## 4. iOS / watchOS TestFlight readiness

**Hard blockers (external submission):**

- **watchOS app icon missing (#3).** `project.yml:163` sets `ASSETCATALOG_COMPILER_APPICON_NAME: ""` and `ArcaevoWatch/Assets.xcassets` has only `BrandMark.imageset` — **no `AppIcon.appiconset`**. App Store Connect upload validation rejects a watch app with no icon. (iOS icon is fine — single 1024 universal.)
- **`DEVELOPMENT_TEAM` unset on all four targets** (`project.yml` only sets `CODE_SIGN_STYLE: Automatic`). Can't archive/upload until set (`PRELAUNCH 9.2`, ⛔).
- **Fabricated clinician-signed content in Release (#1).** The DEBUG-only `DemoMode` gate does **not** protect these — the fiction is hardcoded in the views, so a **real logged-in TestFlight tester sees it**: `MemberResultsV3View.swift` (whole tab is "SIGNED OFF BY DR. NOLAN · 38 markers · Ferritin 29" etc.), `InsightsV3View.swift:20` ("ApoB down 16% over 46 logged walks", under "The maths comes from your own baselines"), `MemberTodayV3View.swift` ("Up 3 since June", steps 8,940, fusion sparkline), `FusionTimelineV3View.swift:79`, `AskArcaevoV3View.swift` (canned keyword narrator over `MemberV3Demo.chatQA` labelled "grounded in your data"), and **the entire watch** (`WatchModel.recompute` runs engines on `DemoDataProvider` unconditionally, overlaid with the member's _real_ name — `WatchModel.swift:185,192`). Presenting fabricated clinician-signed results + biomarker claims is a realistic App Store 2.3 + health rejection, and misleads a real user about their own body.
- **Free self-activation into the member shell in Release (#4).** `CheckoutV3View.swift:80` shows a Release-visible "I've finished checkout — continue" that sets `appState.plan = tier` with no payment verification → `SuccessV3View` → member shell. A reviewer self-activates and lands directly on #1.

**Tester-confusion (not upload blockers):**

- **Phone→watch baseline transport not built** — `PhoneWatchConnectivity.pushToken` sends only token/expiry/name; no HRV/RHR baseline or blood penalties, so the watch computes from demo data. Meanwhile `SuccessV3View.swift:50` promises "Your Watch is already flowing — baselines start building tonight" — **false**.
- **Persona fallbacks leak offline** — "Aoife Byrne" greeting (`MemberTodayV3View.swift:86`), "aoife@example.ie" receipt (`SuccessV3View.swift:21`), triggered because `AppModel.loadAll` sets `user=nil` on Release failure.
- **Universal links not configured** — `com.apple.developer.associated-domains` commented out (`project.yml:71`), no AASA hosted (`PRELAUNCH 9.4`), so the magic-link email opens the web, not the app. The in-app 6-char code path is the real way in (works on simulator — good), but the "link opens the app" copy won't hold.
- **Legacy screens still reachable** via Account → "Settings/Orders (legacy)" (`V3Shell.swift:392`) — reviewer-visible older UI.

**Confirmed good (don't worry):** background HealthKit **is** shipped (`HKObserverQuery` + `enableBackgroundDelivery(.hourly)` + `BGAppRefreshTask co.arcaevo.app.health.refresh`, plist keys present); no IAP/StoreKit anywhere (checkout links out via `SFSafariViewController`); the `NSHealthShareUsageDescription` is excellent (enumerates each metric, wellness framing, cycle-only-on-opt-in, "not a medical device"); no `NSHealthUpdateUsageDescription` needed (never writes); cycle access is a separate later prompt (Art.9 hygiene); ATS full in Release; encryption declaration present.

**Post-launch polish:** Sentry DSN is **empty in both configs** (`project.yml:94`) → **no crash reports on TestFlight** unless set; and the **watch target has no Sentry at all**. Live Activity / ActivityKit absent (in-app render stands in). HRV/RHR Lock-Screen widget deferred (schema carries no series). **Dynamic Type unsupported** — `Typography.swift` builds every font via `.custom(name, size:)` with **no `relativeTo:`** and no `@ScaledMetric`, at literal sizes down to 8.5pt, so text does not scale for low-vision users; the **watch app has zero `accessibilityLabel`s** (grep: 0). App Privacy "nutrition labels" are entered in App Store Connect (not in-repo) — cross-check them against the actual HealthKit/email/analytics collection before submitting (`PRELAUNCH 9.6`, ⛔).

---

## 5. Product / UX gaps for a first real cohort

- **Insights are blank on day one for the most common early states (High, #7).** `api/v1/insights/route.ts` filters `{clinicianReviewed:true}` (`:38`) then skips any marker with `series.length < 2` (`:74`). So a brand-new paid member with one reviewed panel gets `insights: []` until their _second_ lab draw (weeks/months later); **self-uploaded bloods never qualify** (`uploads/bloodwork/confirm/route.ts:143` sets `clinicianReviewed:false`) → permanent zero insights; `fusion` also needs ≥2 lab draws → `null`. There is **no first-panel "here's your baseline" insight**, even though `composeClinicianNote` already handles the single-marker case (it's written to the `TestOrder`, not surfaced via `/insights`). _Fix:_ add a baseline branch that emits an insight from one reviewed reading. Effort **S**.
- **Fabricated clinician identity shown to users and GPs as real medical review (Critical, #2).** `Dr. S. Nolan, IMC 412887` (a MOCK persona, `models.ts:225`) is rendered with **no "not yet a licensed clinician" caveat** on: the **GP-share page** (`s/[token]/page.tsx:138`, API hardcodes `REVIEWER` at `share/[token]/route.ts:18` — a GP is shown a fabricated IMC registration number as clinical provenance), the **clinician note** (first-person medical prose, `composeClinicianNote`), and **emails E6/E7** ("Dr. Nolan reviews every value before you see it"). The only disclaimers say "wellness, not diagnosis" — **none** say the reviewer isn't a real registered clinician. This is a legal/regulatory exposure (holding out an unregistered/fictional reviewer with an IMC number). _Fix:_ either engage a real reviewing clinician (ops project — gates paid tiers anyway) **or** strip the name+IMC everywhere and reframe as "algorithmic/technical review — not a clinician sign-off." Centralised; code effort ~1 day.
- **"Export my data" is a no-op in both the account page and the delete flow (High, #8).** `account/ExportRow.tsx` flips local state and claims "a download link lands in your inbox" — its own TODO admits there's no endpoint; the delete-flow "export first" step (`account/privacy/ConsentSection.tsx:214`) is equally fake. So the GDPR portability promise, made **at the moment of erasure**, is unfulfilled (deletion itself IS real). _Fix:_ build `/api/v1/export` (CSV+PDF via existing email infra, ~1–2 days) **or** change the copy to be truthful ("email privacy@…", ~1 hr) before any real user.
- **DOB + delivery/visit address collected then discarded (High for paid tiers).** `CheckoutClient.tsx` collects both; `address` is **never put in the POST body** (`:163`), and `dob` **is** sent but the route destructure (`checkout/route.ts:40`) drops it. For Essential (kit courier) / Performance (nurse visit) this is a **fulfilment blocker** and a "why did you ask?" trust hit. Out of scope for a Fusion-only trial, but fix before the paid cohort. Effort **S**.
- **Free tier is real but under-surfaced.** `/join` genuinely creates a free account, but `/app` and pricing CTAs only point at paid (`from €119/yr`). `STRATEGY`'s own funnel logic argues for making the free tier a front door. Post-launch messaging call.
- **Thin trust assets.** `public/` now has the real logo/marks (good) but still no photography, testimonials, named clinician, or cohort proof. Conversion, not a blocker.

---

## 6. Security / privacy loose ends (new surface only)

The formal audit is clean; these are **new** surfaces from recent features:

- **`auth/signup` and `auth/reset` are not IP-rate-limited (Medium).** Only 7 routes call `limitByIp` (admin login/MFA, magic-link request/verify, signin, gift-redeem). `signup` creates accounts + sends E1/E2, and `reset` sends email — rotating the email address from one IP = unbounded account/email-bomb. `limitByIp` already exists; one line each. Do these before the cohort.
- **`GET /api/v1/referral/resolve` is a public, unthrottled boolean oracle (Low).** No identity leaked, no credit granted, but it's an unauthenticated DB-query over the `NAME-XX` code space — add `limitByIp`. Other unthrottled writers (`gift`, `waitlist`, `eligibility/check`, `consents`, `account/delete`) are lower risk.
- **`count+1` ID minting persists in two places (Low).** `account/delete/route.ts:77` (`erasure_${count+1}`) and `admin/support/route.ts:45` (`tick_${count+1}`) — the collision-prone pattern `checkout` already avoids with `newId()`. Erasure has an idempotency pre-check; two concurrent first-time deletes could still race. ~15 min.

_Confirmed clean (don't worry):_ the SES IAM secret never leaves the HMAC chain (never logged/stringified/in errors); no secret carries a `NEXT_PUBLIC_` prefix and **`ADMIN_PATH_SLUG` is server-only** (never mirrored to the client bundle); the obscured-admin proxy correctly 404s direct `/admin` in prod and rewrites the slug with no leak vector found. Referral anti-abuse is strong (self-referral blocked by id+email, credit only on genuine paid activation, idempotent, `REFERRAL_MAX_CREDITED=50` cap, referrer never learns who joined).

---

## 7. Data correctness — the RCV drift is **STILL OPEN**

**Verdict: STILL OPEN.** Every shared marker between the web seed table (`scripts/seed.ts:78`, → the `biomarkerRules` collection) and the iOS hardcoded defaults (`ArcaevoKit/VitalityEngine.swift:48`, `BiomarkerRuleLite.defaults`) disagrees:

| code | web `rcvPercent` | iOS default | match? |
|---|---|---|---|
| hs_crp | 85 | 46 | ✗ |
| ferritin | 30 | 15 | ✗ |
| vitamin_d | 25 | 16 | ✗ |
| hba1c | 6 | 4.5 | ✗ |
| apob | 10 | 10.6 | ✗ |

- **No single source of truth.** There is **no `/rules` endpoint** and no rules-decode path in Swift; `AppModel.swift:292` always calls the engine with `BiomarkerRuleLite.defaults`, so the hardcoded constants are **always live**. The web `/insights` payload emits `rcvPercent` but iOS never decodes it into a rule table (narration-only).
- **No parity test.** `VitalityEngineTests.swift` exercises the RCV _math_ with literal inputs, but nothing asserts the two constant tables are equal — which is exactly why they rotted apart.
- **The math semantics are in parity** (zero-prior guard, inclusive `|Δ%| ≤ rcv` boundary, direction, band, rounding-half-up all match) — so the danger is purely the diverged constants: the same blood change reads "a real change" on the wrist and "within noise" on the web GP share.

_Fix:_ generate both tables from one source, or have iOS fetch/decode the server rule table; add a cross-engine parity test. Effort **M**. This is the product's one honest promise ("is this real vs your baseline") giving two answers depending on the screen.

**Ingestion-time correctness: RESOLVED** (review-#1 fix confirmed in code). `baselineInputsForIngest` (`rcv.ts:96`) now excludes the incoming reading from its own band, never mixes `lab`/`self_reported`, and sorts by `takenAt` before verdicting; both ingest routes call it. **One residual:** filtering is by **source only, not review-state** — an unreviewed lab reading (`clinicianReviewed:false`) is still eligible for the lab baseline. If review-state was meant to gate the baseline, it isn't implemented.

**One more safety item to verify before real bloods (`PRELAUNCH 8.3`):** `BiomarkerPenalty.swift:6-7` asserts "flagged/critical values never reach this engine — they route to the clinician-first flow," but I found **no code enforcing that gate** in `derive` — the engine processes whatever it's handed. The iOS penalty table also encodes absolute clinical cutoffs (ferritin/vit-D/TSH/hs-CRP/testosterone) with causal reason strings — a second, on-device-only threshold table with no server mirror. Verify the upstream critical-value gate exists before real lab data flows.

---

## Already handled — don't worry (verified since IMPROVEMENT_REVIEW)

So the founder knows the coverage and doesn't re-chase closed items:

- **Payment-gating hole CLOSED** — live checkout redirects to real hosted Stripe; no browser mock webhook in live (`checkout-action.ts`, on `main`).
- **`invoice.paid` idempotency ADDED** — `processed_webhook_events` ledger; retries can't multi-year a membership.
- **DB indexes ADDED** and **created on Vercel** — `ensureIndexes()` fires on cold start (unique on `sessions.tokenHash`, `users.email`, `share_links.token`, etc.).
- **Ingestion RCV/band correctness FIXED** — source-separated, self-excluded, chronologically sorted.
- **Fusion made real on `/insights`** — `computeFusionInsight` is the first real reader of `wearableSignals` (iOS surface still demo — see 1f).
- **Consent-withdrawal → session revoke → GP-share revoke** — done + unit + e2e tested.
- **Erasure queue + runner + Vercel cron** — done + comprehensively tested (all ~15 collections, consent trail retained, idempotent, grace window).
- **Referral backend** — end-to-end, idempotent, abuse-resistant, GDPR counts-only (one edge — the `MAX_CREDITED` cap — untested).
- **Admin hardening** — per-account auth + roles + **mandatory TOTP MFA** (enrolment gate closes A-1) + obscured slug + access log; clean.
- **Web observability wiring** — `logError` on the previously-silent catches + 11 PostHog funnel events (dark until keyed).
- **iOS background HealthKit + Sentry (DSN-gated, PII-scrubbed) + daily/first-run nudges** — shipped, on `main`.
- **No IAP; checkout links out; HealthKit purpose string; ATS; cycle-as-separate-ask** — App-Review-clean.
- **SES secret handling; no secret in `NEXT_PUBLIC_`; admin-slug server-only; admin proxy** — clean.
- **Real logo + iOS app icon + OG/twitter images** — present and render on Vercel.
- All fixes are **on `main` and pushed** (`origin/main == main`); the "NOT pushed" notes in `BUILD_STATE` are stale.

---

## Quick wins — high value, low effort, shippable this week

Ordered by leverage; most are one file or a config value.

1. **Add a watch `AppIcon.appiconset`** and set `ASSETCATALOG_COMPILER_APPICON_NAME` — unblocks the TestFlight upload. (**S**, #3)
2. **Set `DEVELOPMENT_TEAM`** on all four iOS targets. (**S**, #3)
3. **Gate the free self-activation** (`CheckoutV3View` "I've finished checkout") behind DEBUG, or verify membership server-side before advancing. (**S**, #4)
4. **Label the canned iOS insights/results/Ask-Arcaevo as illustrative** (or gate behind an honest empty state) and **soften "grounded in your data"** until the real narration/decode lands — removes the App-Review + honesty risk without waiting on the LLM/fusion decode. (**S**, #1)
5. **Add a first-panel "baseline" insight** so single-panel / self-upload members don't hit a blank screen (relax the `series>=2` gate for a baseline branch). (**S**, #7)
6. **Make "Export my data" honest** — swap the copy to "email privacy@arcaevo.com" until the real endpoint exists (both the account row and the delete-flow step). (**S**, #8)
7. **IP-rate-limit `auth/signup`, `auth/reset`, `referral/resolve`** — reuse `limitByIp`, one line each. (**S**, §6)
8. **Send E7 to the member on clinician sign-off** (template already built and unused). (**S**, 1c/1d)
9. **Wire the local `results`/`recheck`/`verdict` notification anchors** from data the app already fetches — makes 3 of the 10 dead push cards fire without APNs. (**M**, 1a)
10. **Add a cross-engine RCV parity test** (fail CI when web ↔ iOS constants diverge) — even before reconciling the values, this stops further drift. (**S**, §7)
11. **Set `SENTRY_DSN`** (iOS, both configs) and **install web Sentry** per `OBSERVABILITY.md §3` — turn on crash + error visibility for the cohort. (**S**–**M**, §10)
12. **Add a client `PostHogProvider` + pageview**, add the `recheck_ordered` event, and `waitUntil` the server captures. (**M**, 1e)
13. **Seed `eligibility_config` into the pre-prod Atlas DB**; set `maxPoolSize:10`; add `/api/v1/health`. (**S**, §3)
14. **Persist `dob` + `address` from checkout** (thread `address` into the body, read `dob` in the route). (**S**, §5)
15. **Fill the `[TODO: CRO number]` placeholders** in `content/legal.ts` / contact / legal pages once the CRO number is confirmed. (**S**, legal)

---

_Bottom line: the hard, honest engineering is done and the money/consent/erasure/security spine is solid. The remaining launch risk is almost entirely **presentation honesty** (fabricated clinical content and clinician identity on the surfaces testers hit first), **two engines that disagree**, and **triggers that were never wired to the surfaces that were built**. #1–#4 gate the external TestFlight; #5–#8 and #10 are the difference between "impressive demo" and "a cohort of strangers can trust it." None are large — the icon/team/self-activation fixes are hours, and the honesty relabelling is a day._
