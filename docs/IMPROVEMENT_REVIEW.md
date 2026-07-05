# Arcaevo — Strategic & Technical Improvement Review

_Read-only review, 2026-07-05. Author: acting as hands-on Tech CEO / principal engineer. Scope: `apps/web` (Next.js 16 / React 19 / Tailwind v4), `apps/ios` (SwiftUI iOS + watchOS + widgets), the engines/RCV core, and the mock-vs-real seams. No code was changed._

_Companion docs: `BUILD_STATE.md` (build truth), `STRATEGY.md` (market/positioning), `LAUNCH_READINESS.md` (compliance/security), `MOCKED_APIS.md` (integration status). **This review deliberately does NOT re-litigate the compliance/security checklist in `LAUNCH_READINESS.md`** — that audit is thorough and stands. This is about product leverage, engineering quality, correctness landmines, and conversion/retention._

---

## Context: the codebase is ahead of its own docs

Worth stating up front, because it changes the read. `STRATEGY.md` (dated 07-03/04) says the app "reads no workouts/active energy/sleep stages," insights are canned, admin is "a single shared password," and the erasure cron and IP rate-limiting are unbuilt. **All of those are now partly or fully done** (Phase 22 landed 07-05): `HealthKitProvider.swift` reads 10+ signal types incl. workouts/steps/active-energy/respiratory/SpO₂/wrist-temp; per-admin accounts + roles + TOTP MFA + access log exist (`MOCKED_APIS.md` §3); `apps/web/src/app/api/v1/cron/run-erasure/route.ts` + `vercel.json` cron are wired; Mongo-backed IP rate-limiting is live (`lib/rate-limit.ts`). The strategic docs *undersell* the build. The gaps that remain are different — and sharper — than the docs suggest. That's what this review targets.

The genuine crown jewels, confirmed by reading the code: the **RCV verdict engine** (`apps/web/src/lib/rcv.ts` — pure, guarded, 20 unit tests) and the **on-device readiness/energy/vitality engines** (`apps/ios/ArcaevoKit/*` — deterministic, calibration/sparse-night/sick states, cycle-aware baselines, 48 tests). These are hard things done well. The weakness is almost everything *around* them: the fusion story is a mock on every surface a user sees, the paid economy activates without money, there is no observability, and the two engine implementations have silently drifted apart.

---

## Executive summary — top 8 opportunities (ranked by leverage)

| # | Opportunity | Impact | Effort | Why it's the highest leverage |
|---|---|---|---|---|
| 1 | **Close the payment-gating hole** — live checkout is dead code; orders/gifts activate without payment; webhook has no idempotency | Critical | M | The paid economy currently runs without collecting money, and flipping to live Stripe keys does **not** fix it — the live hosted-checkout URL is fetched then thrown away. This is a silent revenue-leak the moment you go live. |
| 2 | **Make the fusion story real on one surface** — wire `wearableSignals` into insights; stop shipping hardcoded fusion charts as real | High | L | "Watch + bloods fused" is the entire differentiator (STRATEGY §1) and it exists as a mock **everywhere** — web `/app`, the iOS fusion timeline, the dashboard, insights. Every surface a member or GP sees is fabricated. |
| 3 | **Fix the RCV constant drift between web and iOS** and make thresholds one server-owned source | High | M | The same blood change reads "a real change" on iOS and "noise" on web (hs-CRP 85% vs 46%; ferritin 30% vs 15%). The product's one honest promise — "is this real vs your baseline" — gives two different answers depending on the screen. |
| 4 | **Add DB indexes + fix the LGC N+1** | High | S | Zero indexes exist except one TTL. `sessions.findOne({tokenHash})` is a full collection scan on **every authenticated request**. This is the first thing that falls over under real load, and it's a day-one fix. |
| 5 | **Wire observability** — Sentry (web + iOS + watch), structured logs, and the funnel analytics that's already stubbed but never called | High | M | You are flying completely blind: no error tracking, ~2 `console` calls in the whole backend, and `capture()` (`lib/analytics.ts`) has **zero call sites**. You cannot see a crash, a failed webhook, or your own funnel. |
| 6 | **Background HealthKit delivery + snapshot refresh** | High | M | "Readiness, locked at wake" is the daily habit loop — and there is no `HKObserverQuery` / `BGTaskScheduler` anywhere, so it only refreshes when the app is manually opened. Widgets/complications can lag a full day. The core hook doesn't fire. |
| 7 | **Fix the ingestion-time RCV/band correctness bugs** | High | M | In the real (not mock) LGC + upload-confirm routes, a reading is put in its own baseline, self-reported "hollow gold" values pollute clinician-track lab bands, and backfilled old bloodwork is verdicted against today's reading. Silent wrong verdicts on real health data, zero test coverage. |
| 8 | **Build the conversion trust layer** — social proof, real imagery, abandoned-cart, truth-in-labelling | High | M | For a €119–399/yr health-data ask there is no testimonial, rating, named clinician, or single photograph anywhere; the export button is a no-op; and "AI grounded in your data" is a keyword `switch`. The site sells like it has no customers and slightly over-claims what it does. |

Everything below expands these by lens, with file paths and impact/effort.

---

## 1. Product / UX

**The fusion story is a mock on every surface (High / L).** This is the headline issue. `wearableSignals()` is written by `POST /sync/wearables` and read by *nothing* — no route joins watch data with bloods. The iOS `FusionTimelineV3View.swift` and `Mv3MiniFusionSparkline` draw from `MemberV3Demo.fusionMarkers`/`wearSeries` in fixed SVG coordinates; the dashboard's "38 markers in — one worth acting on", "Up 3 since June", steps "8,940" (`MemberTodayV3View.swift`) are static copy shown even to a member with no data. Web `/app` (`apps/web/src/app/app/page.tsx`) is a marketing page with two hardcoded polylines captioned "VO₂ MAX + APOB". The one web surface with real member data — the GP share (`app/s/[token]/page.tsx`) — is deliberately bloods-only. So the "watch explains your bloods" promise is invisible or fabricated on every screen. **Fix:** wire `insights` and one fusion view to real `wearableSignals` + `biomarkerReadings`; until then, mark the demo charts "illustrative" (S) so honest members aren't shown fabricated trends as their own.

**The core loop (readiness → experiment → recheck → verdict) is half-wired (High / M).** The readiness screen (`ReadinessV3View.swift`) is the best-built surface — real result, real penalties, live blood-layer ON/OFF toggle. But the loop doesn't close: the €69 recheck (`api/v1/orders`) has **no experiment linkage** — you can't order "the recheck for my ferritin experiment," so the "did it work?" verdict moment (the year-2 renewal driver, STRATEGY §3 #3) can't be delivered end-to-end. Wire an `experimentId` onto recheck orders and surface the verdict against the pre-experiment reading.

**Onboarding is clean; degraded states are honest at the engine level but not the dashboard.** The 7-step onboarding (`AppState.swift`), primer-before-sheet (`HealthKitPrimerV3View.swift`), and consent (research off by default) are well done. The readiness/energy/vitality cards honestly show calibrating/sparse/sick states. But the **dashboard's static cards undermine that honesty** — a fresh user with no history still sees confident numbers. There is also **no "Health access is off"** or **"no Apple Watch paired"** affordance: both collapse into an indefinite, unexplained "calibrating" state (`AppModel.loadWearables`). For a product whose whole pitch is the watch, "you have no watch" deserves a real screen. (Med / S.)

**Notification value is local-only and can't cover the moment that matters (Med / M).** `NotificationPlanner.swift` schedules `UNCalendarNotificationTrigger`s (readiness at wake, energy dip, test reminders) — deterministic and pref-gated, good. But it's local-only: there's no APNs path, so the highest-value nudge — "your results are in" (a server event) — can't be delivered as a push. And because HealthKit has no background refresh (§4), the "morning readiness" notification fires against a snapshot that may be a day stale.

**Web insights strand single-panel and self-upload users in an empty state (Med / S).** `api/v1/insights/route.ts` requires `clinicianReviewed: true` **and** `series.length >= 2`. The most common early states — one panel, or self-uploaded bloods (which are never clinician-reviewed by design) — produce **zero insights**. The first-run experience for a Fusion member who just uploaded a panel is a blank screen. Add a first-panel "here's your baseline" insight that doesn't require a prior.

---

## 2. Conversion & retention

**The paid economy activates without payment, and it won't self-heal at go-live (Critical / M).** Three compounding issues:
- **Live checkout is dead code.** `CheckoutClient.tsx handlePay()` ignores `data.checkout.url` (the real hosted URL built in `vendors/stripe.live.ts`) and instead fires the browser mock webhook. The card form (`CheckoutClient.tsx`) collects nothing. Flip to live keys and you get "You're a member" with **€0 collected**. This is the one to escalate: it does not resolve automatically when real Stripe keys go in.
- **Orders/gifts never enforce payment.** `api/v1/orders/route.ts` inserts the `TestOrder` regardless of payment; `paidAt` is write-only, never read to gate fulfilment. `api/v1/gift/route.ts` mints a valid gift code before payment; `gift/redeem` checks only `redeemedBy`. Free unlimited memberships.
- **No webhook idempotency.** `invoice.paid` does `renewalDate.setFullYear(+1)` on every delivery (both mock and real handlers); Stripe's at-least-once retries would extend membership by whole years and re-send the E4 receipt each time. `event.id` is on the envelope but never persisted/deduped.

**Zero social proof, zero imagery — the site sells like it has no customers (High / M).** No testimonial, rating, cohort/waitlist count, named clinician, press, or credential across `page.tsx`, `pricing`, `how-it-works`, `science`, `about`; the founder quote is anonymous. And `apps/web/public/` is **empty (0 bytes)** — there is not one photograph: no kit, no app screenshot, no face, no phlebotomist. All visuals are inline SVG. That's a beautifully lean bundle and a conversion liability for a premium health product where trust is the entire purchase. Add named clinical credibility (this doubles as the STRATEGY §3 #2 "clinician on every panel" wedge), founding-Dublin-cohort framing, and real product/kit imagery.

**Abandoned-cart recovery is missing but 90% plumbed (High / M).** Checkout captures guest email and mints a `pending` membership *before* payment (`api/v1/checkout/route.ts`), and a cron-auth pattern already exists (`env.ts` `cronRequestAuthorized`, used by the erasure cron). A daily cron emailing stale `pending` memberships is high-leverage and almost entirely built already.

**Address + DOB are collected then discarded (High / S).** `CheckoutClient.tsx` collects delivery/visit address + lab-required DOB; `handlePay` never sends `address` and `checkout/route.ts` ignores `dob`. For a product that couriers kits and books nurse draws, dropping the shipping address on the floor is a fulfilment blocker hiding as a form.

**Retention playbook gap vs WHOOP/Oura.** STRATEGY is right that measurement-only scores decay in value and the recheck→verdict loop is the moat. Two concrete moves: (1) close the experiment→recheck→verdict loop (§1) so year-2 renewal has a "here's proof it worked" moment; (2) ship the recovery-score-with-blood-modifiers (STRATEGY §3 #1) — the engine and thresholds already exist in `BiomarkerPenalty.swift`; it's the differentiator Athlytic-class apps structurally can't build. Also: **no free→paid trial mechanic** exists on web (lowest tier is €119); iOS has a "Fusion-lite" free tier (`FreeHomeV3View.swift`) that the web funnel never surfaces. STRATEGY's own data (42% trial-to-paid) argues for making that free tier a front-door, not a hidden state.

---

## 3. Engineering quality

**RCV thresholds have silently drifted between web and iOS (High / M).** The single most important non-obvious finding. The web seed (`scripts/seed.ts`) and iOS `BiomarkerRuleLite.defaults` (`VitalityEngine.swift`) disagree materially:

| code | web `rcvPercent` | iOS default |
|---|---|---|
| hs_crp | 85 | 46 |
| ferritin | 30 | 15 |
| vitamin_d | 25 | 16 |
| hba1c | 6 | 4.5 |
| apob | 10 | 10.6 |

iOS **never fetches the backend rule table** (there's no `/rules` decode path in Swift; `AppModel.swift` passes `BiomarkerRuleLite.defaults`), so these hardcoded constants are always live. The RCV math is duplicated (TS + Swift, hand-synced) and the constants have rotted apart — the same reading is "a real change" on the wrist and "within noise" on the web GP share. **Fix:** generate both tables from one source, or have iOS decode server rules; add a test asserting the two tables match (nothing checks this today, which is why it drifted).

**Ingestion-time RCV/band bugs live in real route code, untested (High / M).** In both `api/v1/webhooks/letsgetchecked/route.ts` and `uploads/bloodwork/confirm/route.ts`: `prior = history.at(-1)` over history **unfiltered by source** (a self-reported "hollow gold" value becomes the prior for, and pollutes the baseline band of, a clinician-track lab result — directly contradicting the "self-reported excluded from clinician claims" promise on the same route); `series = [...history, newValue]` puts the new reading **in its own baseline**; and backfilled old bloodwork (user-chosen `takenAt`) is verdicted against today's reading and appended out of chronological order. These are not mock-only — they're the real ingestion path, and `rcv.test.ts` tests the pure functions but never how the routes feed them. **Fix:** filter history by source/review-state to match the display rule, sort by `takenAt`, exclude the incoming value from its own band, and add ingestion tests.

**The readiness "transparent breakdown" doesn't reconcile with the score (Med / M).** `ReadinessEngine.swift` computes each contribution by clamping the term *individually* and shows penalties *additively* (`-penalty.penalty`), while the actual score clamps the *sum* and applies penalties *multiplicatively* via ceiling scaling. So a −12 ferritin row is displayed even though its real effect was 71→62 (−9). For a product whose ethos is "scores never bluff," the breakdown overstates impact and won't sum to the delta. No test asserts contributions sum to `final − 50`, so it's invisible.

**No observability anywhere (High / M).** No Sentry or any error tracking in `apps/web/package.json` or the iOS/watch targets; `instrumentation.ts` only does secret-assertion `register()`, no `onRequestError`. Only ~2 `console.error/warn` in all of `src/lib` + `src/app/api`; fire-and-forget failures (SMTP, `logAdminAccess`, webhook ingest, erasure) are swallowed silently. `capture()` (`lib/analytics.ts`) is fully built but has **zero call sites** — even with a PostHog key set, not one funnel event fires. And because the engines run only on-device, a member's score is **not reproducible server-side** — clinical-ops literally cannot answer "why was my readiness 62 on 2 July?" **Fix:** Sentry on all three targets; structured request logging with a correlation id; alert on the swallowed-failure paths; instrument the funnel with the existing `capture()`; persist a server-side score snapshot (which also makes the web↔iOS RCV drift detectable).

**API-layer smells.** Solid foundations (no IDOR on any `[id]` route; `requireConsentedMember` genuinely gates Art.9; secrets fail closed). But: (a) **racy `count+1` document IDs** persist in the exact places already migrated off elsewhere — most concerningly the Art.9 consent audit trail (`lib/consents.ts`), plus `waitlist`, `admin/support`, `account/delete`; `newId()` exists and is used elsewhere. (b) **DPIA audit writes are fire-and-forget/unawaited** (`admin-audit.ts`) — on Vercel a frozen invocation can drop the insert, for a control whose entire purpose is provable accountability; `await` or `waitUntil`. (c) `parseJsonBody` is bypassed by ~6 hand-rolled copies with inconsistent error envelopes. (d) checkout is an **account-enumeration oracle** (unauthenticated, an existing email echoes member id/tier + 409s).

**Canned "AI" is architecturally right but a truth-in-labelling risk (Med).** Web insights are 3 fixed template strings in a `switch` (`insights/route.ts`); the "AI-NARRATION SLOT" is a comment. iOS "Ask Arcaevo" is a keyword `switch` over one seeded fixture (`MemberV3Demo.swift`) — yet the UI labels it "GROUNDED IN YOUR DATA / The AI writes the words." The deterministic-decides/AI-narrates architecture is exactly correct; the exposure is shipping the *label* before the LLM. Either wire the narration (the RCV verdict is the safe, grounded input) or soften the copy until it's real.

**Test coverage: pure logic strong, integration thin.** ~289 vitest + 48 iOS XCTests + 17 Playwright specs. All 289 web unit tests live in `lib/__tests__` (pure functions, mocked DB); **no API route handler is unit-tested**, and the highest-risk code — the ~430-line Stripe webhook that mutates paid memberships, the LGC ingest, gift purchase/redeem — is covered only indirectly by a Playwright happy path. On iOS the untested-but-material paths are the **vitals→sick-mode** branch (every readiness test passes `vitals: nil`), `currentLoad` workout scoring, `dailyScores`, and everything outside `ArcaevoKit` (AppModel, the demo/real seam, watch auth 401-retry). No iOS UI tests at all.

---

## 4. Native app depth

**No background HealthKit delivery (High / M).** Zero `HKObserverQuery`, `enableBackgroundDelivery`, `HKAnchoredObjectQuery`, or `BGTaskScheduler` in the codebase. Wearables are pulled only in `AppModel.loadWearables()` on foreground `.task`. So "readiness locked at wake," the widget snapshot, and the watch all refresh **only when the app is manually opened** — never overnight, never at wake. For a morning-readiness product this is the biggest technical gap; it also caps widget freshness (they self-refresh hourly but off a snapshot that only updates on foreground).

**The watch computes off demo data even when genuinely logged in (High / L).** `WatchModel.recompute()` unconditionally uses `DemoDataProvider` for readiness/energy/vitals/vitality; the only real thing fetched over the token is the member's *name*. A real member (DEMO badge hidden) sees demo-derived numbers presented as their own. The phone→watch 60-day baseline transport is documented-deferred, but the surface reads as real. Ship the baseline/penalty transport or badge the numbers as illustrative until it lands. (The watch *login/handoff* itself — `WatchAuthManager`, device-scoped tokens, optimistic-auth, single 401-retry — is genuinely production-quality; it's just feeding demo data.)

**Dynamic Type is effectively unsupported — systemic (High / L).** Every font routes through `arcSerif/arcSans/arcMono` (`Typography.swift`) as `.custom(name, size:)` with **no `relativeTo:`** and no `@ScaledMetric`, across hundreds of call sites with literal sizes (`.arcSans(13.5)`). Custom fonts sized this way do not scale with the user's text-size setting at all — a low-vision user cannot enlarge any text. VoiceOver is partial-but-thoughtful on member cards and every widget family, but the **watch app has essentially zero accessibility labels**. Fix the three font helpers to scale, then audit fixed-height containers that would clip.

**Silent write-loss in Release (High / M).** `AppState.submitConsents()` and `confirmUpload()` swallow errors with a comment claiming "retried on next launch" — but **there is no retry mechanism**; the write is simply lost. For GDPR consent and confirmed bloodwork, that's a real data-integrity concern. `APIClient` is deliberately thin (3s/5s timeouts, ephemeral session so no cache, no reachability monitor, no queue) — fast-fail to trigger the demo fallback, but it means no offline read cache and no write recovery.

**Deferred native items (documented, Low-Med / M each).** Workout Live Activity / ActivityKit (in-app render stands in), the HRV/RHR mini Lock-Screen widget (correctly refused to fabricate a series), and the phone→watch baseline transport. The real WidgetKit complication *did* ship in Phase 22 (corner/circular/rectangular + iOS Lock Screen widgets), reading an App-Group `GlanceSnapshot` via a hand-mirrored DTO (`WidgetShared.swift`) — reasonable, but a schema-drift risk since it's two hand-synced copies of one struct.

**HealthKit read set is strong; the sync model is the bottleneck (Med / M).** `HealthKitProvider.swift` reads and aggregates 10+ types correctly (cumulative-sum vs discrete-average per metric, sleep attributed to wake-morning, stage breakdown, cycle access as a *separate* authorization — good Art.9 hygiene). But the backend `WearableSignalType` (`models.ts`) still stores only `hrv/rhr/sleep/vo2max`, and `POST /sync/wearables` accepts only those four — so the richer signals the recovery-score/cycle features need **can't round-trip to the server**. Also, synced values are `z.number().finite()` with **no physiological bounds** — a −5 or 99999 HRV would be stored.

---

## 5. Performance & cost

**No Mongo indexes except one TTL (High / S).** `createIndex` appears exactly once in the codebase — the `rate_limits` TTL index. Everything else is a full collection scan, including `sessions.findOne({tokenHash})` on **every authenticated request**, plus `users.email`, `magic_link_tokens.tokenHash`, `share_links.token`, `biomarker_readings.{memberId,code}`, `memberships.memberId`, `consents.userId`. Add a `scripts/ensure-indexes.ts` (run at boot via `instrumentation.ts` or in seed); make `tokenHash`/`share_links.token`/`vendorOrderId` unique. This is the single cheapest high-impact fix in the repo. Add a TTL index on `sessions.expiresAt` too — expired sessions currently just linger.

**N+1 in the LGC results webhook (High / S).** `webhooks/letsgetchecked/route.ts` does a `find({memberId,code}).sort().toArray()` **inside a per-marker loop** (dozens of round-trips per panel). The sibling `uploads/bloodwork/confirm/route.ts` already fixed exactly this with one batched `$in` — port it verbatim.

**Whole-collection fetches + in-memory joins, no pagination or projection (Med / M).** `members/route.ts`, `admin/results/route.ts`, `admin/kpis`, and admin `data.ts loadMembers` pull entire collections (the last pulls **all** readings to compute a per-member last-test — should be a `$group max`), and admin lists pull full user docs including `passwordHash` into memory (no projections anywhere). Every `results`/`insights` request re-fetches the entire `biomarker_rules` config (cacheable). `runDueErasures` filters the grace window in JS instead of `{$lte: now}`.

**Web bundle is genuinely lean (positive).** Server-components-first (only ~30 `use client` files of ~197), zero images, minimal deps (mongodb, next, nodemailer, react, zod). Nothing to fix here — the discipline is good; the empty `public/` is a conversion problem (§2), not a performance one.

---

## 6. Trust / safety / correctness

**Copy discipline is strong (positive).** A diagnosis-language sweep of both apps came back essentially clean — the only "disease/diagnostic" hits are competitor descriptions and explicit disclaimers. `composeClinicianNote`/`isWatchMarker` are carefully wellness-framed; insights carry a fixed disclaimer. The blood-layer ON/OFF toggle as an MDR fallback (LAUNCH_READINESS §2) is a genuinely smart design.

**The thin line: hardcoded clinical thresholds with causal claims (Med).** `BiomarkerPenalty.swift baseRule` encodes reference cutoffs (ferritin <45/<70, vit-D <30/<50, TSH <0.4/>4.0, hs-CRP >3/>1.5, testosterone <10) each paired with a causal reason string ("Low vitamin D independently causes tiredness", "Thyroid affects deep sleep + energy"). These are engineering guesses shipping as defaults (the comments say "tune with clinician"). The mitigating rule — "flagged/critical values never reach this engine; they route to the clinician-first flow" — is **asserted in a comment but I found no code enforcing that routing** in ArcaevoKit; the engine will process any value handed to it. Verify the flagged-value gate exists upstream before real bloods flow, and move these thresholds to a clinician-owned, server-provided table (which also fixes the §3 drift).

**Data minimisation is genuinely strong (positive).** `UserSchema` stores only name, email, auth material, lifecycle flags, `stripeCustomerId` — no DOB, address, phone, PPSN, or gender on the user record; `calendarAge` for Vitality is passed client-side, never stored. Menstrual/cycle access is a separate HealthKit ask, off by default, never synced unless cycle baselines are enabled. Erasure spans 14–15 collections and retains only the consent audit trail. Two forward caveats: you'll need to *add* a delivery address for the real kit flow (currently under-collected), and erasure doesn't yet reach the lab partner's copy or stored upload files (already flagged in MOCKED_APIS §17).

**Two fake GDPR affordances that read as real (Med / M).** The "Export my data" button (`account/ExportRow.tsx`, and again inside the deletion flow's export-first step) just flips local state to "a link lands in your inbox" — **nothing is sent**. A user exercising data portability, especially while deleting their account, is promised a bundle that never arrives. Either build the export or remove the promise until it's real.

**Clinician review is theater (High significance / L — a paid-tier gate, per LAUNCH_READINESS §3).** `admin/results/[id]/review/route.ts` flips `clinicianReviewed=true` and regenerates a template note signed by the hardcoded fictional persona "Dr. S. Nolan, IMC 412887"; the "Flag to GP" control on the admin results page is a dead `<span>` with `cursor:pointer` and no handler; "avg review time 3m 20s" is hardcoded. Governance smell: a business `owner` role can clinically sign off Art.9 results. All known/documented, but it's the core clinical-safety control, so flagging it here too.

---

## 7. Quick wins (high value, low effort — shippable this week)

Ordered by leverage. Most are one-file or config changes.

1. **Add DB indexes.** `scripts/ensure-indexes.ts` covering `sessions.tokenHash` (unique), `users.email` (unique), `magic_link_tokens.tokenHash`, `share_links.token` (unique), `biomarker_readings.{memberId, takenAt}`, `memberships.memberId`, `consents.userId`; TTL on `sessions.expiresAt`. (§5) — biggest impact-per-hour in the repo.
2. **Fix the LGC webhook N+1** by porting the batched `$in` already written in `uploads/bloodwork/confirm/route.ts`. (§5)
3. **Redirect real checkout to `data.checkout.url`** instead of firing the browser mock webhook — one branch in `CheckoutClient.handlePay()`, gated on `selectedPaymentsVendorKind()==="live"`. (§2) Stops the go-live revenue leak.
4. **Instrument the funnel:** add `capture()` calls at pricing-view / checkout-start / member-activated / recheck-ordered. The function is built and no-ops without a key — pure upside. (§3)
5. **Add rate-limiting to the unthrottled writers:** `auth/signup` (unbounded user+email flooding), `gift`, `gift/redeem`, `waitlist`, `eligibility/check`, `auth/reset`. `limitByIp` already exists. (§3)
6. **`await` (or `waitUntil`) the DPIA audit writes** in `admin-audit.ts` call sites — a dropped accountability record defeats the control. (§3)
7. **Replace `count+1` IDs with `newId()`** in `lib/consents.ts` (the Art.9 audit trail), `waitlist`, `admin/support`, `account/delete`. (§3)
8. **Mark the demo fusion charts "illustrative"** on web `/app` and the iOS dashboard static cards, so honest members aren't shown fabricated trends as their own. (§1)
9. **Persist shipping address + DOB** from checkout (already collected, currently dropped). (§2)
10. **Add physiological bounds** to `SyncWearablesInput` values and a first-panel insight so single-panel members don't hit a blank screen. (§1, §4)
11. **Soften "AI grounded in your data"** copy (or gate the canned insights behind an honest empty state) until the narration slot is wired. (§3)
12. **Gate `auth/demo`** on `demoTokenEnabled()` and restrict clinical sign-off to `clinician` (drop `owner`). (§3, §6)
13. **Emit FAQPage JSON-LD** on `/pricing` (the FAQ content exists) and remove the dead "Flag to GP" `<span>`. (§2, §6)

---

## Closing read

The instinct to build the hard, honest things first — server-enforced consent, real erasure, the RCV engine, calibration-aware readiness, the clinician-first critical-value flow — was the right one, and it shows. What's missing is the connective tissue that turns a beautiful demo into a product: **the fusion story has to be real on at least one screen, the two engine implementations have to agree, money has to actually change hands, and you have to be able to see what's happening in production.** Those four — plus indexes so it doesn't fall over — are the difference between "impressive prototype" and "closed beta you can trust with a stranger's blood." None of them are large; the payment and index fixes are days, not weeks. Do #1–#5 from the executive summary and the quick-wins list, and the gap between what Arcaevo *claims* and what it *does* — which is currently its biggest risk — mostly closes.
