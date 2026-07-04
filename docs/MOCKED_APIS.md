# Mocked / Placeholder Integrations

Nothing here is wired to a real vendor yet. Every mock lives behind a small interface so swapping in the real API is a one-file change. This document is the checklist for productionising.

## 1. LetsGetChecked (finger-prick blood testing) — MOCKED

- **Status**: No API contract selected/signed. The shapes below are our own guesses, NOT LetsGetChecked's real schema.
- **Where**: `apps/web/src/lib/vendors/letsgetchecked.mock.ts` implementing `BloodTestVendor` (`apps/web/src/lib/vendors/types.ts`).
- **What's mocked**:
  - `createKitOrder(memberId, panel)` → returns fake order id + tracking state machine (`ordered → shipped → delivered → sample_registered → in_lab → results_ready`).
  - `getOrderStatus(orderId)` → advances the fake state machine deterministically over time.
  - `getResults(orderId)` → returns seeded biomarker values for the panel.
  - Webhook ingestion: `POST /api/v1/webhooks/letsgetchecked` accepts our guessed payload; signature verification is a no-op stub.
- **To productionise**: sign LGC partner agreement, replace mock with real REST client + real webhook signature verification, map LGC biomarker codes → our `BiomarkerRule` codes, handle kit SKUs per tier (Essential full panel, Essential recheck, Performance venous is likely a different vendor — Dublin mobile phlebotomy provider TBD).

## 2. Stripe (annual subscriptions, add-ons) — REAL (TEST-mode wired) behind a mock fallback

- **Two vendors, one interface** (`PaymentsVendor` in `src/lib/vendors/types.ts`), selected by `src/lib/vendors/stripe.ts` (`getPaymentsVendor()` / `selectedPaymentsVendorKind()`):
  - **LIVE** — `src/lib/vendors/stripe.live.ts`: real Stripe via REST `fetch` (no SDK — repo forbids `npm install`; `stripe` is recorded under BUILD_STATE "Wanted deps"). API version pinned **`2026-06-24.dahlia`**. Memberships → Checkout `mode:"subscription"` on Billing Prices; add-ons/recheck → `mode:"payment"`. **Never passes `payment_method_types`** (omitting it enables dynamic payment methods → card/Apple Pay/Link appear automatically, configured in the Dashboard). `automatic_tax[enabled]=true` + `billing_address_collection:"required"` for IE VAT. One Stripe Customer per member, cached as `user.stripeCustomerId`.
  - **MOCK** — `src/lib/vendors/stripe.mock.ts`: unchanged deterministic fake URL/ids + our refund policy (full before kit ships/draw booked; none once processed).
  - **Selection**: LIVE when `STRIPE_SECRET_KEY` is a real `sk_` key AND `STRIPE_FORCE_MOCK!=="true"`; else MOCK. CI (no key) and the e2e/docker stacks (`STRIPE_FORCE_MOCK=true`) stay on the MOCK, so all existing tests pass unchanged.
- **SKU catalogue**: `src/lib/vendors/stripe-config.ts` maps every product to a stable `lookup_key` (`arcaevo_fusion_annual`, `arcaevo_essential_annual`, `arcaevo_performance_annual`, `arcaevo_quarterly_upgrade`, `arcaevo_addon_full_panel`, `arcaevo_addon_recheck`, `arcaevo_addon_venous`, `arcaevo_recheck_kit`). `npm run stripe:setup` (`scripts/stripe-setup.ts`) idempotently creates the Products + Prices in **TEST mode** (looks up by `lookup_key` before creating; re-runs never duplicate). The LIVE vendor resolves `lookup_key`→price id at runtime (or from the optional `STRIPE_PRICE_*` env pins).
- **Customer Portal (self-service billing) — WIRED both vendors**: `PaymentsVendor.createBillingPortalSession(customerId, returnUrl)` — LIVE calls `POST /v1/billing_portal/sessions`; MOCK returns a deterministic fake portal URL (`billing.stripe.mock/...`, fnv1a of the inputs). `POST /api/v1/account/portal` (member-auth + `requireConsentedMember`) resolves the member's `stripeCustomerId`, mints a session returning to `/account`, and responds `{ url }`; no customer yet → **409** `no_stripe_customer`; vendor error (e.g. portal not configured in the Dashboard) → **502** `portal_unavailable`. The account membership card (`src/app/account/MembershipActions.tsx`, gated on `selectedPaymentsVendorKind()`) opens the portal for `Update card` / `Invoices` / `Cancel renewal` / `Manage billing` **only when LIVE**; on the MOCK it keeps the interim pills + the browser-fired `customer.subscription.deleted` webhook cancel path, so e2e is unchanged. **Live still requires configuring the portal** in the Dashboard (Settings → Billing → Customer portal: payment-method update, cancellation, plan switching) — see docs/STRIPE_SETUP.md §4 step 5.
- **Webhook — REAL signature verification when configured**: `POST /api/v1/webhooks/stripe`. When `STRIPE_WEBHOOK_SECRET` is set, the route verifies the `Stripe-Signature` header against the signing secret over the RAW body (`src/lib/stripe-signature.ts`: HMAC-SHA256 over `${t}.${payload}`, constant-time compare, 5-min replay window; `node:crypto`, no SDK) and handles genuine events — `checkout.session.completed` (activate membership / mark add-on `paidAt`), `customer.subscription.updated` (status + `cancelAtPeriodEnd`), `customer.subscription.deleted` (canceled), `invoice.paid` (renew +1yr, resolve dunning), `invoice.payment_failed` (past_due + dunning ladder, E9 once). When `STRIPE_WEBHOOK_SECRET` is **unset**, the route keeps the interim **shared-secret / open** path (`verifyWebhookSecret`) with the simplified `{type,data:{memberId}}` payload the `/checkout` page fires from the browser — OPEN in dev/e2e, `ALLOW_OPEN_WEBHOOKS=true` on the prod-build local stack. `POST /api/v1/webhooks/letsgetchecked` still uses the shared-secret gate only (`LETSGETCHECKED_WEBHOOK_SECRET`).
- **New env vars** (all in `apps/web/.env.local`, gitignored): `STRIPE_PUBLISHABLE_KEY`, `STRIPE_SECRET_KEY` (test keys, present), `STRIPE_WEBHOOK_SECRET` (set to flip the webhook to real verification), `STRIPE_FORCE_MOCK=true` (pin the mock), and optional per-price `STRIPE_PRICE_ARCAEVO_*` id pins. New npm script: `stripe:setup`. See **docs/STRIPE_SETUP.md** for the full go-live checklist.
- **Still to productionise**: real EU Stripe entity + live keys (swap to a **restricted `rk_` key** for the server); enable Stripe Tax + IE VAT registration; verify the Apple Pay domain; **configure** the already-wired **Customer Portal** in the Dashboard (upgrade/downgrade/cancel — Arcaevo's +€130 quarterly upgrade & cancel-renewal — the route + UI exist, the Dashboard config is what remains); real refund path (we currently apply only the policy — no charge id is persisted per order).

## 3. Admin authentication — PLACEHOLDER

- **Where**: `apps/web/src/lib/auth.ts` + `/admin/login`.
- **What**: single shared password from `ADMIN_PASSWORD` env var, HMAC-signed session cookie. No user accounts, no roles, no rate limiting.
- **Fail-closed secrets**: the cookie is a self-describing HMAC token, so the signing secret must never be a committed literal. `src/lib/env.ts` `sessionSecret()` throws in production when `SESSION_SECRET` is unset (a dev fallback is used only in non-production), and `assertRequiredSecrets()` (wired via `src/instrumentation.ts` `register()`) makes a misconfigured production server fail to boot rather than run with forgeable admin auth.
- **To productionise**: real IdP (e.g. WorkOS/Auth0/Cognito), per-user accounts, roles (ops vs clinician), audit log.

## 4. Member authentication (iOS app) — MOCKED

- **Where**: `/api/v1/auth/*` issues a static demo bearer token; iOS `APIClient` uses it.
- **Demo-token gate (server, security)**: `demo-member-token` is a hardcoded bypass to a **real seeded member's Art.9 health data**, so it is only honoured when `NODE_ENV!=='production'` OR `ALLOW_DEMO_TOKEN=true` (see `src/lib/env.ts` `demoTokenEnabled`, applied in `src/lib/auth.ts` `memberFromRequest`). In production without the flag the token is rejected exactly like any invalid token. Local dev, the docker stack, e2e, and iOS demo mode keep working (dev is non-prod; the prod-build docker/e2e stacks set `ALLOW_DEMO_TOKEN=true`).
- **Demo-token gate (iOS client, security — hardened 2026-07-03)**: defense-in-depth on the app side. The demo token is now DEBUG-only via `DemoMode.isEnabled` (`ArcaevoKit/APIClient.swift`); in a Release build `APIClient.bearerToken` is `nil` when there is no real session, so **the app never sends the demo token** — the request goes out unauthenticated, gets a 401, and the app routes to real magic-link sign-in instead of a demo member. The whole demo/offline experience (demo session in `AppState`; `DemoDataProvider`/`DemoDataV2` fallbacks in `AppModel` and the account/invite/GP-share views) is gated the same way; in Release those paths surface an error / empty state rather than fabricated member data.
- **To productionise**: Sign in with Apple + proper token issuance (JWT with rotation), device binding; drop the demo token (or keep it strictly behind `ALLOW_DEMO_TOKEN` in non-prod only) and remove the iOS DEBUG demo path.

## 4a. iOS API base URL + App Transport Security — PRODUCTION REQUIREMENTS (SECURITY, 2026-07-03)

- **Base URL is per-build-configuration**, read from the `ARCAEVO_API_BASE_URL` Info.plist key (`apps/ios/project.yml` per-config build settings + `Arcaevo/Info-Debug.plist` / `Arcaevo/Info-Release.plist`, consumed in `APIClient.defaultBaseURL`):
  - Debug → `http://localhost:3000/api/v1`
  - Release → `https://arcaevo.com/api/v1`
  - Fallback (missing/invalid key) → `https://arcaevo.com/api/v1`. **Never plaintext HTTP in Release.**
- **App Transport Security is per-config** (the iOS app selects one of two Info.plist files via `INFOPLIST_FILE`):
  - Debug (`Info-Debug.plist`) → `NSAllowsLocalNetworking = true` so the simulator can reach `http://localhost`.
  - Release (`Info-Release.plist`) → **no `NSAppTransportSecurity` exceptions at all** — full ATS, HTTPS only. Verified in the built Release app: the `Info.plist` has no ATS key and `ARCAEVO_API_BASE_URL = https://arcaevo.com/api/v1`.
  - Keep the two plists in sync except for the ATS block (fonts, health usage string, URL scheme). The watchOS app ships full ATS in **both** configs (no localhost exception); its backend calls are best-effort and it demos from seeded data, so Debug loses nothing.
  - **When a real prod API host is chosen** (if not `arcaevo.com/api/v1`), update `ARCAEVO_API_BASE_URL` for the Release config in `project.yml` and the fallback literal in `APIClient.swift`.
- **Session-token storage**: the member session token lives only in the Keychain (`kSecClassGenericPassword`, `kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly` — never iCloud-synced, never in device backups), never in UserDefaults. `AppState`'s UserDefaults snapshot deliberately excludes the token **and** the raw-health-value upload-confirm state; only non-sensitive UI/routing state is persisted.

## 5. Clinician review — MOCKED

- Results are auto-marked `clinician_reviewed` by the seed/mock pipeline. Real flow needs a clinician portal step in /admin and a medical-ops partner.
- **Clinician note on every panel (Phase 22, modelled)**: each reviewed panel (= one TestOrder's result set) carries a `clinicianNote { text, clinicianName, imcNumber, readAt }` — field names locked by the Phase 22 shared contract (iOS decodes them off `GET /api/v1/results`, where every reviewed reading carries its panel's note; null while unreviewed). The admin sign-off (`POST /api/v1/admin/results/[id]/review`) writes/refreshes a **template-assisted** note onto the reading's order (`composeClinicianNote` in `src/lib/models.ts`: in-range vs watch markers via the direction-aware `isWatchMarker`, wellness-framed, €69 recheck as the only sell); both seed scripts write deterministic notes. The "human" signing it is still the §15 MOCK persona — productionise together with the clinician portal: a real reviewer edits/approves the template text and their real name + IMC number replace the persona.

## 6. PostHog EU analytics — STUBBED OFF

- `apps/web/src/lib/analytics.ts` is a no-op unless `NEXT_PUBLIC_POSTHOG_KEY` is set (EU host hardcoded: `https://eu.i.posthog.com`). No US-hosted scripts, per handoff.

## 7. Email (receipts, kit reminders, results-ready) — MOCK OUTBOX + OPTIONAL REAL SMTP (MailHog)

- **Outbox (always)**: `apps/web/src/lib/vendors/email.mock.ts` writes every send to the console + Mongo `outbox` collection — the e2e suite (`e2e/v2-helpers.ts` token fishing, `e2e/email.spec.ts`) and admin views read it, so this write happens regardless of provider.
- **SMTP (additional, env-switched)**: with `EMAIL_PROVIDER=mailhog` (or `=smtp`), the same rendered email is ALSO sent via `email.smtp.ts` (nodemailer, from `Arcaevo <hello@arcaevo.com>`, `SMTP_HOST`/`SMTP_PORT` — defaults `localhost:1026`). Delivery is fire-and-forget with error logging: an SMTP failure never breaks the API request (load-bearing invariant).
- **Auth + TLS (OPTIONAL, env-driven — Phase 22)**: the adapter now reads credentials and TLS from env, so switching to a real ESP is a config change, not a code change. All default to the MailHog no-auth/no-TLS path when unset:
  - `SMTP_USER` + `SMTP_PASS` — if **both** are set, nodemailer gets `auth: { user, pass }`; if either is unset, no auth (MailHog). Credentials are passed straight to the transport and are **never logged**.
  - `SMTP_SECURE` — `"true"` uses TLS-on-connect (465-style); any other value (default) leaves it false for MailHog / STARTTLS on 587.
  - `EMAIL_FROM` — overrides the From address (default `Arcaevo <hello@arcaevo.com>`).
  - `SMTP_HOST` / `SMTP_PORT` — default `localhost:1026`. `buildSmtpTransportConfig()` is exported and unit-tested (`src/lib/__tests__/email-smtp.test.ts`) without opening a socket.
- **MailHog**: docker-compose `mailhog` service — SMTP on host **:1026**, web UI at **http://localhost:8026** (the standard 1025/8025 pair is taken by other local projects; inside the compose network the web container uses `mailhog:1025`).
- **Prefetch-safe sign-in code (Phase 21)**: the E1 (verify) and E2 (magic-link) emails now render BOTH the button/link AND a prominent human-typeable code (`XXX-XXX`) under it, with "Or enter this code at arcaevo.com/signin". This defends against email virus-scanners (Microsoft Safe Links, Mimecast, Proofpoint) that prefetch URLs and could burn a single-use link before the human clicks — a scanner never fills in and submits a code field. See §12 for the auth-side contract.
- To productionise: point `SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASS`/`SMTP_SECURE` at an EU-friendly ESP — this is now purely a config change (no code edit needed). A signed **DPA** with the ESP is REQUIRED before real users (health-adjacent PII crosses the processor): e.g. **Scaleway TEM** (EU-resident, French processor) or **Postmark EU** (EU data region + DPA). Then decide whether the outbox write stays as an audit log.

## 8. Apple HealthKit (iOS) — REAL API, MOCK FALLBACK

- HealthKit reads are real code paths, but the simulator/demo mode uses `MockHealthStore` seeded with plausible HRV/RHR/sleep/VO2max series so the app demos without a device.

## 9. MongoDB Atlas — LOCAL SUBSTITUTE

- Local dev uses docker-compose Mongo 7 (`mongodb://localhost:27017/arcaevo`). Prod target is Atlas (eu-west-1); connection string comes from `MONGODB_URI`. CDK documents (does not create) the Atlas peering/secret wiring.

## 10. Mobile phlebotomy (Performance tier, Dublin) — NOT MODELLED WITH A VENDOR

- `TestOrder` supports `type: "venous"` with `bookingStatus`, but there is no vendor adapter at all yet. Vendor TBD.

## 11. AI bloodwork extraction (Fusion upload flow) — MOCKED

- **Where**: `apps/web/src/lib/vendors/ai-extraction.mock.ts` (`extractBloodwork`), used by `POST /api/v1/uploads/bloodwork`.
- **What's mocked**: no file bytes travel and no model runs. A deterministic fnv1a hash of the file name fabricates 8–12 plausible marker values with per-value confidence; ~half of uploads include one low-confidence read with two candidate values (the designed "was this 41 or 47?" state), which blocks `…/confirm` until the user resolves it. Confirmed values are written as `BiomarkerReading` docs with `source: "self_reported"` (hollow gold dots, never clinician-reviewed).
- **PRODUCTION GATE (security/integrity — 2026-07-05)**: the fabrication is now gated by `ALLOW_MOCK_EXTRACTION` (`src/lib/env.ts` `mockExtractionEnabled`, applied in `POST /api/v1/uploads/bloodwork`). Auto-ON in non-production (dev + e2e keep exercising the mock and the "41 or 47?" demo; e2e sets it explicitly). In **production it is OFF** unless `ALLOW_MOCK_EXTRACTION=true`, and the photo/PDF path then returns an honest `{ manualEntryRequired: true, values: [], … }` state (200, nothing persisted) instead of inventing numbers a real user would "confirm". **Manual hand-entry (`kind:"manual"`) is the real, safe path and is always available** — it skips extraction (confidence 1) and writes the same `self_reported` readings. So until a real EU OCR vendor lands, real users are routed to manual entry; the mock never reaches them.
- **To productionise**: EU-hosted OCR/vision extraction, unit normalisation (mg/dL ↔ mmol/L) with the original preserved, original-file storage (user-deletable), human-in-the-loop for low-confidence reads — then flip the gate (or drop it) so the real extractor serves the photo/PDF path.

## 12. Member authentication (v2 web) — REAL PATTERN, DEV-GRADE PIECES

- **Where**: `apps/web/src/lib/member-auth.ts` + `/api/v1/auth/*` (signup, magic-link request/verify, signin, signout, reset request/confirm).
- **Real**: opaque 256-bit session tokens stored SHA-256-hashed in the `sessions` collection (individually revocable); scrypt password hashing (node:crypto, N=16384/r=8/p=1, optional password); 30-min single-use magic links (hash-only storage, 60s resend throttle); 5-fail → 15-min cool-off; non-revealing responses.
- **Prefetch-safe code fallback (Phase 21) — REAL**: `POST /api/v1/auth/magic-link/verify` accepts EITHER `{token}` (the emailed link) OR `{email, code}` (a Slack-style human code). Both redeem the SAME single-use token — using the code invalidates the link and vice-versa. The code is 6 chars from a 32-char unambiguous alphabet (`ABCDEFGHJKLMNPQRSTUVWXYZ23456789`, grouped `XXX-XXX`), stored hash-only as `codeHash = sha256Hex(normalizeCode(code))` on the `MagicLinkToken` doc (raw code lives only in the email). Defended by: email-scoping (the short code is meaningless without the account), 30-min expiry, single-use, and a **5-attempt ceiling** (`codeAttempts`) after which the token is burned (`consumeMagicLinkByCode` → `too_many`). Codes/tokens are never logged. Immune to email virus-scanner link prefetching; the web `/verify` screen also no longer auto-POSTs the token (a "Confirm sign-in" button does), so a prefetch that follows the link but doesn't submit can't burn it. iOS `verifyMagicLinkCode(email, code)` hits the same endpoint. Link-path 401s carry `codeAvailable: true`.
- **IP rate-limiting (security — 2026-07-05, REAL)**: `POST /api/v1/auth/magic-link/verify` (and `…/magic-link` request + `…/signin`) now sit behind a dependency-free fixed-window IP limiter (`src/lib/rate-limit.ts`, keyed by the first `x-forwarded-for`/`x-real-ip` hop). Verify + signin: ~10 attempts / 5 min / IP; link request: ~15 / 5 min / IP. Over the limit → **429** with a non-revealing message + `Retry-After`. Counters live in the Mongo `rate_limits` collection with a TTL index (`expiresAt`), so the limit holds across stateless serverless invocations — NOT in-memory. This is the IP layer **on top of** the existing per-token 5-attempt code ceiling + per-email resend/cool-off (both kept). ON by default in every environment; a local prod-build stack (e2e) opts out with `RATE_LIMIT_DISABLED=true` (`src/lib/env.ts` `rateLimitingEnabled`) so scripted bursts from one host don't flake the suite. Unit-tested in `src/lib/__tests__/rate-limit.test.ts`.
- **MOCK bits**: magic-link/verify/reset emails go to the Mongo `outbox`, never sent (§7); the legacy `demo-member-token` bearer still maps to the seeded demo member (§4); no CSRF token (cookie is SameSite=Lax + all mutations are JSON POSTs); the seed's e2e password user uses a FIXED scrypt salt for determinism — never do that in production code paths.
- **To productionise**: real ESP for link delivery; the IP limiter above is dev-grade (fixed-window, single Mongo collection) — for real scale consider a purpose-built store (Upstash/Redis) or Vercel's edge rate-limiting, and tune the thresholds; passkeys + optional TOTP at +3 months, Sign in with Apple later (linked by verified email).
- **Device-scoped sessions + silent refresh (Phase 20 — golden watch login)**: sessions now carry `device: "web"|"ios"|"watch"` (default `"web"`), an optional `expiresAt` (30-day sliding TTL, `SESSION_TTL_DAYS`) and an optional human `label`. Legacy rows without these fields read as `web` and **never expire** (backward compat); `memberFromSessionToken` treats an `expiresAt < now` row as invalid.
  - `POST /api/v1/auth/watch-session` (member auth — phone cookie OR bearer/demo token): mints a NEW `device:"watch"` session for the same user — a freshly generated token with its own row, **not** a copy of the phone token, independently revocable. **Replace policy: one active watch session per user** — a prior watch session is revoked first. `201 → { watchSessionToken, expiresAt (ISO 8601), device:"watch" }`.
  - `POST /api/v1/auth/session/refresh` (Bearer any valid session token, cookie fallback): the watch's silent-refresh on 401/wake. Revalidates + **slides** `expiresAt` to now+TTL (updates `lastSeen`). `200 → { member:{id,name,email}, device, expiresAt }`; missing/revoked/expired → `401 { error:"session_invalid" }`. (Opaque long-lived-token model: the session token IS the refresh token — "refresh" = revalidate + slide.)
  - `POST /api/v1/auth/watch-session/revoke` (member auth): deletes the user's watch-device session(s) — the phone's "sign out watch" + the admin device list. `200 → { ok, revoked }`.
  - `GET /api/v1/auth/sessions` (member auth): the member's own sessions with `device/label/lastSeen/createdAt/expiresAt/current` — **`tokenHash` is never returned**. `POST /api/v1/auth/sessions/[id]/revoke` (member auth) ends one of the member's own sessions (filter scoped to `userId`). Backs the §17 web session list.
  - The watch token is a real credential (same SHA-256 hashing, never logged, prod env gating applies) and is just another bearer session token — so it flows through `memberFromRequest` → `requireConsentedMember` and authenticates every consent-guarded health endpoint automatically once the watch holds a valid, consented session. Verified: a minted watch token → `GET /api/v1/results` 200.
  - **Seed**: the demo member (Aoife, `mem_0001`) gets a seeded `watch` + `ios` session (deterministic dev tokens `seed-watch-token-aoife` / `seed-ios-token-aoife`) for device variety in the session list + admin, and to let e2e/curl exercise refresh directly. DEV-ONLY, like `demo-member-token`.

## 13. Apple Pay (on the web) — REAL via Stripe dynamic payment methods (test-mode)

- Design (§07): all payment on the web, card or Apple Pay — no IAP. Apple Pay on web is just a Stripe payment method. The LIVE vendor (§2) **omits `payment_method_types`** on every Checkout Session, which enables Stripe's dynamic payment methods — so card, Apple Pay and Link render automatically on the hosted Checkout page (which methods appear is configured in the Stripe **Dashboard**, not code). The MOCK still stands in for both when no live key is set.
- **To go live for Apple Pay**: register + verify the production domain in the Stripe Dashboard (Settings → Payment methods → Apple Pay → add domain; Stripe hosts the domain-association file for hosted Checkout). No Apple Pay JS / merchant validation needed while we use hosted Checkout.

## 14. GeoIP for GP-share access logs — HARDCODED

- `GET /api/v1/share/[token]` appends `{ at, location: "Dublin" }` to the link's access log on every open. The coarse location is hardcoded; productionise with city-level GeoIP at the edge (log city only, per the design's "Opened twice — Dublin, 3 July").

## 15. Clinician identity on GP shares — MOCK PERSONA

- The share summary (`/api/v1/share/[token]`) and E6/E7 emails name "Dr. S. Nolan, IMC 412887" — a fictional reviewer from the designs. Replace with the real reviewing clinician + IMC number from the medical-ops partner.
- Phase 22: the same persona now also signs the per-panel clinician notes (§5) — canonical constants `CLINICIAN_NAME` / `CLINICIAN_IMC_NUMBER` in `apps/web/src/lib/models.ts`, used by the admin review sign-off and both seed scripts. Swapping in the real clinician is a constants change + the §5 portal work.

## 16. GDPR Art.9 consent enforcement — REAL (server-side)

- **Where**: `apps/web/src/lib/consent-guard.ts` (`requireConsentedMember`) — composes `requireMember` (auth.ts) with a live `consentState()` check. Applied to every Art.9 health-data endpoint:
  - `POST /api/v1/sync/wearables`
  - `GET`+`POST /api/v1/orders` (POST also requires `clinician_review`), `GET /api/v1/orders/[id]`
  - `GET /api/v1/results`, `GET /api/v1/insights`
  - `POST /api/v1/uploads/bloodwork` + `.../confirm`
  - `GET`+`POST /api/v1/share`
- **Behaviour**: no current `health_processing` grant (never granted, or withdrawn), or `user.processingSuspended` / `status:"closing"|"closed"` → **403** `{error:"consent_required", needsConsent:true}`. Auth routes, `/consents`, waitlist/eligibility and the public `/s/[token]` view are deliberately NOT gated (no Art.9 data). The seed grants `health_processing` to both e2e members (Aoife `mem_0001` via `demo-member-token`, and `demo@arcaevo.test` `mem_0026`), so existing suites keep passing.
- **Withdrawal = immediate stop**: withdrawing `health_processing` (a `POST /api/v1/consents` with `granted:false`, or `POST /api/v1/account/delete`) calls `suspendProcessingForWithdrawal` → sets `processingSuspended`/`status:"closing"`/`closureRequestedAt` on the user AND deletes every session doc, so live cookies/bearers stop resolving at once (subsequent calls 401). Re-access requires re-auth + re-consent.
- **COORDINATION (webhook ingest)**: `POST /api/v1/webhooks/letsgetchecked` (owned by the auth/webhook agent) writes lab readings server-side. It should skip members whose `processingSuspended` is set (processing has ceased); their queued erasure job (§17) will hard-delete any readings regardless.

## 17. GDPR Art.17 erasure — REAL QUEUE + runner (needs a prod scheduler)

- **Delete endpoint**: `POST /api/v1/account/delete` (member auth) records the consent withdrawal (audit trail), revokes all sessions, flags the user `status:"closing"` + `closureRequestedAt`, sends the E12 closure-confirmation email (the +30-day erasure date, NO health values), and enqueues an `erasure_jobs` doc `{userId, email, requestedAt, eraseAfter:+30d, status:"scheduled"}`. Idempotent — one scheduled job per member. The web UI (`account/privacy` → "Delete everything") calls this and only shows the "erasure started" confirmation after it returns 200.
- **Runner**: `apps/web/scripts/run-erasure.ts` (`npm run erase:run`) drains due jobs (`eraseAfter <= now`): hard-deletes the member across `users, memberships, test_orders, biomarker_readings, wearable_signals, bloodwork_uploads, sessions, share_links, referral_codes, gift_codes (owned/redeemed), support_tickets, waitlist, magic_link_tokens, outbox` — **EXCEPT** the `consents` audit trail, which is RETAINED per DPC guidance (it is the evidence the erasure happened + when, not the personal data). Idempotent; marks each job `done`. Core logic in `src/lib/erasure.ts` (`eraseUserData`, `runDueErasures`).
- **SCHEDULER (2026-07-05, WIRED)**: `GET|POST /api/v1/cron/run-erasure` calls the SAME `runDueErasures()` and is invoked daily by a **Vercel Cron** (`apps/web/vercel.json` → `"0 3 * * *"`). Secured by `CRON_SECRET`: Vercel sends `Authorization: Bearer $CRON_SECRET`; when the env var is set a matching bearer is required in every environment, and in production WITHOUT it the route fails closed (401) — see `src/lib/env.ts` `cronRequestAuthorized`. **Set `CRON_SECRET`** to a long random value in production. The route replies with counts + user ids only (no health values). The CLI runner (`npm run erase:run`) is retained as the manual / AWS (EventBridge → Lambda) fallback.
- **STILL TODO**: also erase lab-partner copies (LetsGetChecked) and stored original upload files once those exist (the runner only covers Arcaevo's own DB).
