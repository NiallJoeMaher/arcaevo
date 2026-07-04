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

## 2. Stripe (annual subscriptions, add-ons) — MOCKED

- **Where**: `apps/web/src/lib/vendors/stripe.mock.ts` implementing `PaymentsVendor`.
- **What's mocked**: checkout session creation (returns fake URL), subscription state, webhook `POST /api/v1/webhooks/stripe`, refund logic (full before kit ships/draw booked; none once sample processed — enforced in our code, not Stripe).
- **Webhook auth (interim gate)**: there is no real Stripe signature verification yet, so the mock webhook is gated on a shared secret (`src/lib/env.ts` `verifyWebhookSecret`). In dev/e2e it stays OPEN so the `/checkout` page can fire `checkout.session.completed` from the browser. In production it is **rejected with 401** unless the `x-arcaevo-webhook-secret` header matches `STRIPE_WEBHOOK_SECRET` (if that env is set, the header is required in every environment). A prod-build LOCAL stack (docker/e2e) keeps it open via `ALLOW_OPEN_WEBHOOKS=true`. Real production sets `STRIPE_WEBHOOK_SECRET` and never `ALLOW_OPEN_WEBHOOKS`. The **same treatment** applies to `POST /api/v1/webhooks/letsgetchecked` (`LETSGETCHECKED_WEBHOOK_SECRET`).
- **To productionise**: replace the shared-secret gate with **real `stripe-signature` verification** against the webhook signing secret; real Stripe account (EU entity), Products/Prices for Fusion €119, Essential €329, Performance €399, quarterly-upgrade €130, add-ons €99/€69/€199; Stripe Tax for IE VAT. In real production Stripe (not the browser) fires the webhook server-to-server.

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
- **SMTP (additional, env-switched)**: with `EMAIL_PROVIDER=mailhog` (or `=smtp`), the same rendered email is ALSO sent via `email.smtp.ts` (nodemailer, from `Arcaevo <hello@arcaevo.com>`, `SMTP_HOST`/`SMTP_PORT` — defaults `localhost:1026`, no auth/TLS for MailHog). Delivery is fire-and-forget with error logging: an SMTP failure never breaks the API request.
- **MailHog**: docker-compose `mailhog` service — SMTP on host **:1026**, web UI at **http://localhost:8026** (the standard 1025/8025 pair is taken by other local projects; inside the compose network the web container uses `mailhog:1025`).
- **Prefetch-safe sign-in code (Phase 21)**: the E1 (verify) and E2 (magic-link) emails now render BOTH the button/link AND a prominent human-typeable code (`XXX-XXX`) under it, with "Or enter this code at arcaevo.com/signin". This defends against email virus-scanners (Microsoft Safe Links, Mimecast, Proofpoint) that prefetch URLs and could burn a single-use link before the human clicks — a scanner never fills in and submits a code field. See §12 for the auth-side contract.
- To productionise: point `SMTP_HOST`/`SMTP_PORT` at an EU-friendly ESP (e.g. Scaleway TEM, Postmark EU DPA), add auth + TLS in `email.smtp.ts`, and decide whether the outbox write stays as an audit log.

## 8. Apple HealthKit (iOS) — REAL API, MOCK FALLBACK

- HealthKit reads are real code paths, but the simulator/demo mode uses `MockHealthStore` seeded with plausible HRV/RHR/sleep/VO2max series so the app demos without a device.

## 9. MongoDB Atlas — LOCAL SUBSTITUTE

- Local dev uses docker-compose Mongo 7 (`mongodb://localhost:27017/arcaevo`). Prod target is Atlas (eu-west-1); connection string comes from `MONGODB_URI`. CDK documents (does not create) the Atlas peering/secret wiring.

## 10. Mobile phlebotomy (Performance tier, Dublin) — NOT MODELLED WITH A VENDOR

- `TestOrder` supports `type: "venous"` with `bookingStatus`, but there is no vendor adapter at all yet. Vendor TBD.

## 11. AI bloodwork extraction (Fusion upload flow) — MOCKED

- **Where**: `apps/web/src/lib/vendors/ai-extraction.mock.ts` (`extractBloodwork`), used by `POST /api/v1/uploads/bloodwork`.
- **What's mocked**: no file bytes travel and no model runs. A deterministic fnv1a hash of the file name fabricates 8–12 plausible marker values with per-value confidence; ~half of uploads include one low-confidence read with two candidate values (the designed "was this 41 or 47?" state), which blocks `…/confirm` until the user resolves it. Confirmed values are written as `BiomarkerReading` docs with `source: "self_reported"` (hollow gold dots, never clinician-reviewed).
- **To productionise**: EU-hosted OCR/vision extraction, unit normalisation (mg/dL ↔ mmol/L) with the original preserved, original-file storage (user-deletable), human-in-the-loop for low-confidence reads.

## 12. Member authentication (v2 web) — REAL PATTERN, DEV-GRADE PIECES

- **Where**: `apps/web/src/lib/member-auth.ts` + `/api/v1/auth/*` (signup, magic-link request/verify, signin, signout, reset request/confirm).
- **Real**: opaque 256-bit session tokens stored SHA-256-hashed in the `sessions` collection (individually revocable); scrypt password hashing (node:crypto, N=16384/r=8/p=1, optional password); 30-min single-use magic links (hash-only storage, 60s resend throttle); 5-fail → 15-min cool-off; non-revealing responses.
- **Prefetch-safe code fallback (Phase 21) — REAL**: `POST /api/v1/auth/magic-link/verify` accepts EITHER `{token}` (the emailed link) OR `{email, code}` (a Slack-style human code). Both redeem the SAME single-use token — using the code invalidates the link and vice-versa. The code is 6 chars from a 32-char unambiguous alphabet (`ABCDEFGHJKLMNPQRSTUVWXYZ23456789`, grouped `XXX-XXX`), stored hash-only as `codeHash = sha256Hex(normalizeCode(code))` on the `MagicLinkToken` doc (raw code lives only in the email). Defended by: email-scoping (the short code is meaningless without the account), 30-min expiry, single-use, and a **5-attempt ceiling** (`codeAttempts`) after which the token is burned (`consumeMagicLinkByCode` → `too_many`). Codes/tokens are never logged. Immune to email virus-scanner link prefetching; the web `/verify` screen also no longer auto-POSTs the token (a "Confirm sign-in" button does), so a prefetch that follows the link but doesn't submit can't burn it. iOS `verifyMagicLinkCode(email, code)` hits the same endpoint. Link-path 401s carry `codeAvailable: true`.
- **MOCK bits**: magic-link/verify/reset emails go to the Mongo `outbox`, never sent (§7); the legacy `demo-member-token` bearer still maps to the seeded demo member (§4); **no rate limiting beyond the cool-off + the 5-attempt code ceiling** (global/IP rate-limiting on the verify endpoint is still a TODO); no CSRF token (cookie is SameSite=Lax + all mutations are JSON POSTs); the seed's e2e password user uses a FIXED scrypt salt for determinism — never do that in production code paths.
- **To productionise**: real ESP for link delivery, **IP/global rate limits on the verify endpoint (the code narrows but does not remove the need)**, passkeys + optional TOTP at +3 months, Sign in with Apple later (linked by verified email).
- **Device-scoped sessions + silent refresh (Phase 20 — golden watch login)**: sessions now carry `device: "web"|"ios"|"watch"` (default `"web"`), an optional `expiresAt` (30-day sliding TTL, `SESSION_TTL_DAYS`) and an optional human `label`. Legacy rows without these fields read as `web` and **never expire** (backward compat); `memberFromSessionToken` treats an `expiresAt < now` row as invalid.
  - `POST /api/v1/auth/watch-session` (member auth — phone cookie OR bearer/demo token): mints a NEW `device:"watch"` session for the same user — a freshly generated token with its own row, **not** a copy of the phone token, independently revocable. **Replace policy: one active watch session per user** — a prior watch session is revoked first. `201 → { watchSessionToken, expiresAt (ISO 8601), device:"watch" }`.
  - `POST /api/v1/auth/session/refresh` (Bearer any valid session token, cookie fallback): the watch's silent-refresh on 401/wake. Revalidates + **slides** `expiresAt` to now+TTL (updates `lastSeen`). `200 → { member:{id,name,email}, device, expiresAt }`; missing/revoked/expired → `401 { error:"session_invalid" }`. (Opaque long-lived-token model: the session token IS the refresh token — "refresh" = revalidate + slide.)
  - `POST /api/v1/auth/watch-session/revoke` (member auth): deletes the user's watch-device session(s) — the phone's "sign out watch" + the admin device list. `200 → { ok, revoked }`.
  - `GET /api/v1/auth/sessions` (member auth): the member's own sessions with `device/label/lastSeen/createdAt/expiresAt/current` — **`tokenHash` is never returned**. `POST /api/v1/auth/sessions/[id]/revoke` (member auth) ends one of the member's own sessions (filter scoped to `userId`). Backs the §17 web session list.
  - The watch token is a real credential (same SHA-256 hashing, never logged, prod env gating applies) and is just another bearer session token — so it flows through `memberFromRequest` → `requireConsentedMember` and authenticates every consent-guarded health endpoint automatically once the watch holds a valid, consented session. Verified: a minted watch token → `GET /api/v1/results` 200.
  - **Seed**: the demo member (Aoife, `mem_0001`) gets a seeded `watch` + `ios` session (deterministic dev tokens `seed-watch-token-aoife` / `seed-ios-token-aoife`) for device variety in the session list + admin, and to let e2e/curl exercise refresh directly. DEV-ONLY, like `demo-member-token`.

## 13. Apple Pay (on the web) — MOCKED VIA STRIPE MOCK

- Design (§07): all payment on the web, card or Apple Pay — no IAP. Apple Pay on web is just a Stripe payment method, so the mock checkout session from §2 stands in for both. No merchant validation, no Apple Pay JS. To productionise: Stripe Payment Request Button + Apple Pay domain verification file.

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
- **PRODUCTION TODO**: nothing invokes the runner automatically. A scheduled trigger MUST call it (Vercel Cron, or EventBridge → Lambda in the AWS footprint) at least daily — that is the operationally-guaranteed half of the "erased within 30 days" promise. Also erase lab-partner copies (LetsGetChecked) and stored original upload files once those exist.
