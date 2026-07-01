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

## 7. Email (receipts, kit reminders, results-ready) — MOCKED

- `apps/web/src/lib/vendors/email.mock.ts` logs to console/Mongo `outbox` collection instead of sending. To productionise: EU-friendly ESP (e.g. Scaleway TEM, Postmark EU DPA) + templates.

## 8. Apple HealthKit (iOS) — REAL API, MOCK FALLBACK

- HealthKit reads are real code paths, but the simulator/demo mode uses `MockHealthStore` seeded with plausible HRV/RHR/sleep/VO2max series so the app demos without a device.

## 9. MongoDB Atlas — LOCAL SUBSTITUTE

- Local dev uses docker-compose Mongo 7 (`mongodb://localhost:27017/arcaevo`). Prod target is Atlas (eu-west-1); connection string comes from `MONGODB_URI`. CDK documents (does not create) the Atlas peering/secret wiring.

## 10. Mobile phlebotomy (Performance tier, Dublin) — NOT MODELLED WITH A VENDOR

- `TestOrder` supports `type: "venous"` with `bookingStatus`, but there is no vendor adapter at all yet. Vendor TBD.
