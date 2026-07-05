# Arcaevo — Go-Live Runbook (basic/Fusion tier, internal beta)

_The single ordered path from the current codebase to a real internal TestFlight beta of the basic tier. Each step says what YOU decide/provide vs what's already built. Deep detail is in the linked docs; this is the sequence. Written 2026-07-05._

Legend: **[you]** needs your decision/credential · **[done]** already built on branch `phase-22-daily-engagement` · **[me]** I can do once you unblock it.

---

> **See also `docs/PRELAUNCH_CHECKLIST.md`** — the single owner-tagged, checkbox pre-launch checklist that consolidates this runbook with the legal, Apple, security and observability items. This runbook is the ordered narrative; the checklist is what you tick off.

## Phase 0 — Company & legal foundation (do first; gates real users)
1. **[you] Interim data controller = Codú Limited** (the founder's existing Irish company); record its CRO number in `docs/legal/RECORDS_OF_PROCESSING.md`. A dedicated entity is formed if the product monetises (then controller identity, DPAs and public privacy copy migrate). Reconcile the public copy (`legal.ts` still says "Arcaevo Health Ltd"). See `docs/legal/MEDICAL_DEVICE_POSITIONING.md` for the wellness/MDR line.
2. **[you] DPO decision** — appoint one or document why not required. (`docs/legal/DPIA.md`)
3. **[you] Commission the DPIA review** — the draft is ready at `docs/legal/DPIA.md`; a DPO/solicitor signs it off.
4. **[you] Solicitor-review the privacy policy** (`/legal/privacy`) and the consent copy against Irish DPC / GDPR Art. 9.
5. **[you] Cyber + professional/product liability insurance.**
6. **[me once entity known] Finalise** `docs/legal/RECORDS_OF_PROCESSING.md`, `SUBPROCESSORS.md`, `DATA_RETENTION.md`, `BREACH_RESPONSE.md`.

## Phase 1 — Production infrastructure
7. **[you] MongoDB Atlas** (eu-west-1) — create the cluster; give me/set `MONGODB_URI`. Sign the Atlas DPA.
8. **[you] Vercel project** (EU region fra1/dub1) — connect the repo. Sign the Vercel DPA.
9. **[you] Point `arcaevo.com`** (or chosen domain) at Vercel; ensure HTTPS.
10. **[you] Set production env vars** (template + docs in `apps/web/.env.example`): `MONGODB_URI`, `SESSION_SECRET` (long random), `ADMIN_PASSWORD` (bootstrap owner), `ADMIN_EMAIL`, `MFA_ENC_KEY` (long random), `CRON_SECRET` (long random), `NEXT_PUBLIC_SITE_URL`. Do **not** set `ALLOW_DEMO_TOKEN`, `ALLOW_OPEN_WEBHOOKS`, `ALLOW_MOCK_EXTRACTION`, `RATE_LIMIT_DISABLED`, or `STRIPE_FORCE_MOCK`.
11. **[done]** The GDPR erasure cron is wired (`vercel.json` → `/api/v1/cron/run-erasure`, secured by `CRON_SECRET`). Just set the secret.

## Phase 2 — Email (magic-link auth depends on it)
12. **[you] Pick an EU ESP** (Scaleway TEM or Postmark EU) and sign its DPA. Give me the SMTP host/port/user/pass.
13. **[me] Wire it** — set `EMAIL_PROVIDER=smtp`, `SMTP_*`, `EMAIL_FROM`. The adapter already supports auth+TLS (`docs/MOCKED_APIS.md §7`); it's a config change.
14. **[me] Add IP rate-limiting is already on** the magic-link verify/request/signin routes.

## Phase 3 — Payments (Stripe)
15. **[you] Stripe account** (EU entity). Create a **restricted live key** (`rk_live_`).
16. **[you/me] Run `npm run stripe:setup`** with the live key to create the live Products/Prices (the test-mode ones already exist — see `docs/STRIPE_SETUP.md`).
17. **[you] Create the prod webhook endpoint** in the Dashboard → `https://<domain>/api/v1/webhooks/stripe`; set `STRIPE_WEBHOOK_SECRET`.
18. **[you] Configure** Stripe Tax + Irish VAT registration; the **Customer Portal** (payment-method update, cancellation, plan switching among the Arcaevo prices); **Apple Pay** domain verification.
19. **[done]** Checkout Sessions (subscriptions + add-ons), real webhook signature verification, the payment-settled activation guard, and the portal route are all built and test-verified.

## Phase 4 — Admin & clinician ops
20. **[you] First admin**: deploy, log in with the bootstrap `ADMIN_PASSWORD`, then create real per-admin accounts at `/admin/admins` and **enable MFA** for each at `/admin/security`. Consider disabling the bootstrap password path after (a founder decision noted in `ADMIN_AUTH_OPTIONS.md`).
21. **[you] Decide MFA policy** — mandatory for owners? Owner-reset flow? (`docs/legal/ADMIN_AUTH_OPTIONS.md`)
22. **[you — paid tiers only] Named IMC-registered clinician** + medical-ops partner. The clinician note is a mock persona (Dr. Nolan) until then — **must not reach real users** on paid tiers. Basic tier doesn't gate on this.

## Phase 5 — iOS build & TestFlight
23. **[you] Apple Developer Program** (€99/yr). Set `DEVELOPMENT_TEAM` on all four targets in `project.yml`.
24. **[you] Enable capabilities** on the App ID: HealthKit, App Groups (`group.co.arcaevo.app`), Background Modes, Associated Domains (`applinks:<domain>`), Push (when ready).
25. **[you] Host the AASA file** at `https://<domain>/.well-known/apple-app-site-association` and uncomment associated-domains in `project.yml` (magic-link → opens app). Full detail: `docs/DEVICE_TESTING_AND_RELEASE.md`.
26. **[you] Confirm** Release build points at `https://<domain>/api/v1` (HTTPS-only, already set).
27. **[you] App Privacy labels + HealthKit purpose strings** in App Store Connect (health data linked; Art. 9 wording). Purpose strings already enumerate every read type.
28. **[you] Internal TestFlight** → yourself + a few testers. Then External (Beta App Review) with a seeded demo login for the reviewer.

## Phase 6 — Pre-flight verification
29. **[me/you] Run the full test + e2e suite** against the prod build; smoke-test the real flows (signup → magic link via the real ESP → consent → checkout test card → membership active → HealthKit on a real device → readiness populates).
30. **[done]** Two security reviews passed (branch + admin auth + MFA), findings fixed. Consider a third-party pen test before wide (non-internal) launch.

---

## The short version of "what's blocking a basic-tier internal beta"
Everything engineering-side is built and verified. The gating items are all **[you]**: the legal entity + DPIA/DPAs, the production DB + env, an EU email provider, and the Apple Developer account. Give me the ESP creds and the DB string and I can have the backend production-configured the same day. The bloodwork partner + named clinician only gate the **paid** tiers, not this beta.

See also: `MORNING_BRIEF_2026-07-05.md` (what was built + decisions), `LAUNCH_READINESS.md` (the 21 questions), `DEVICE_TESTING_AND_RELEASE.md` (device + release detail), `STRIPE_SETUP.md`, `docs/legal/` (compliance drafts).
