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
- **What's mocked**: checkout session creation (returns fake URL), subscription state, webhook `POST /api/v1/webhooks/stripe` (no signature check), refund logic (full before kit ships/draw booked; none once sample processed — enforced in our code, not Stripe).
- **To productionise**: real Stripe account (EU entity), Products/Prices for Fusion €119, Essential €329, Performance €399, quarterly-upgrade €130, add-ons €99/€69/€199; real webhook signing secret; Stripe Tax for IE VAT.

## 3. Admin authentication — PLACEHOLDER

- **Where**: `apps/web/src/lib/auth.ts` + `/admin/login`.
- **What**: single shared password from `ADMIN_PASSWORD` env var, HMAC-signed session cookie. No user accounts, no roles, no rate limiting.
- **To productionise**: real IdP (e.g. WorkOS/Auth0/Cognito), per-user accounts, roles (ops vs clinician), audit log.

## 4. Member authentication (iOS app) — MOCKED

- **Where**: `/api/v1/auth/*` issues a static demo bearer token; iOS `APIClient` uses it.
- **To productionise**: Sign in with Apple + proper token issuance (JWT with rotation), device binding.

## 5. Clinician review — MOCKED

- Results are auto-marked `clinician_reviewed` by the seed/mock pipeline. Real flow needs a clinician portal step in /admin and a medical-ops partner.

## 6. PostHog EU analytics — STUBBED OFF

- `apps/web/src/lib/analytics.ts` is a no-op unless `NEXT_PUBLIC_POSTHOG_KEY` is set (EU host hardcoded: `https://eu.i.posthog.com`). No US-hosted scripts, per handoff.

## 7. Email (receipts, kit reminders, results-ready) — MOCK OUTBOX + OPTIONAL REAL SMTP (MailHog)

- **Outbox (always)**: `apps/web/src/lib/vendors/email.mock.ts` writes every send to the console + Mongo `outbox` collection — the e2e suite (`e2e/v2-helpers.ts` token fishing, `e2e/email.spec.ts`) and admin views read it, so this write happens regardless of provider.
- **SMTP (additional, env-switched)**: with `EMAIL_PROVIDER=mailhog` (or `=smtp`), the same rendered email is ALSO sent via `email.smtp.ts` (nodemailer, from `Arcaevo <hello@arcaevo.com>`, `SMTP_HOST`/`SMTP_PORT` — defaults `localhost:1026`, no auth/TLS for MailHog). Delivery is fire-and-forget with error logging: an SMTP failure never breaks the API request.
- **MailHog**: docker-compose `mailhog` service — SMTP on host **:1026**, web UI at **http://localhost:8026** (the standard 1025/8025 pair is taken by other local projects; inside the compose network the web container uses `mailhog:1025`).
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
- **MOCK bits**: magic-link/verify/reset emails go to the Mongo `outbox`, never sent (§7); the legacy `demo-member-token` bearer still maps to the seeded demo member (§4); no rate limiting beyond the cool-off; no CSRF token (cookie is SameSite=Lax + all mutations are JSON POSTs); the seed's e2e password user uses a FIXED scrypt salt for determinism — never do that in production code paths.
- **To productionise**: real ESP for link delivery, IP/global rate limits, passkeys + optional TOTP at +3 months, Sign in with Apple later (linked by verified email).

## 13. Apple Pay (on the web) — MOCKED VIA STRIPE MOCK

- Design (§07): all payment on the web, card or Apple Pay — no IAP. Apple Pay on web is just a Stripe payment method, so the mock checkout session from §2 stands in for both. No merchant validation, no Apple Pay JS. To productionise: Stripe Payment Request Button + Apple Pay domain verification file.

## 14. GeoIP for GP-share access logs — HARDCODED

- `GET /api/v1/share/[token]` appends `{ at, location: "Dublin" }` to the link's access log on every open. The coarse location is hardcoded; productionise with city-level GeoIP at the edge (log city only, per the design's "Opened twice — Dublin, 3 July").

## 15. Clinician identity on GP shares — MOCK PERSONA

- The share summary (`/api/v1/share/[token]`) and E6/E7 emails name "Dr. S. Nolan, IMC 412887" — a fictional reviewer from the designs. Replace with the real reviewing clinician + IMC number from the medical-ops partner.
