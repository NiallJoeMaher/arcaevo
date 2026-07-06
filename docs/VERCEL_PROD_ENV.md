# Vercel — Production environment variables (launch checklist)

_What to paste into Vercel for **arcaevo.com**, in what order, and where each value comes from. **No secret values live in this file** — the real generated values are in the git-ignored **`apps/web/.env.prod`** on the founder's machine. For the full three-environment matrix (Local / Preview / Production) see `docs/ENVIRONMENTS_AND_SETUP.md` §3 — this doc does not duplicate it._

**Vercel project settings first** (Settings → General / Functions): Root Directory = **`apps/web`**, framework Next.js, region **`dub1`** (pinned in `apps/web/vercel.json`). Set every variable below under **Settings → Environment Variables** with **only the Production scope ticked**.

---

## The two deliberate launch decisions

1. **Blood tiers are OFF in production — on purpose.** `BLOOD_TIERS_ENABLED` and `NEXT_PUBLIC_BLOOD_TIERS_ENABLED` stay **UNSET**. That is the launch gate: Essential (€329) / Performance (€399), kit/nurse/venous orders, gifting and clinician review are disabled fail-safe (server-enforced), `/pricing` shows **Get early access** on those two plans, and only Fusion (€119) is buyable — because no lab partner or registered clinician is live yet. Do not set these vars until they are. Flip runbook below.
2. **The Mongo URI currently staged in `.env.prod` points at the DEV Atlas database (`arcaevo_dev`) — it must be replaced before launch.** Create a separate **prod** Atlas cluster (eu-west-1, backups/PITR, least-privilege user, db name `arcaevo`) per `ENVIRONMENTS_AND_SETUP.md` §7.3, then update both `.env.prod` and Vercel. The dev string is there only so a first smoke deploy works.

---

## Copy-in order

Paste in this order — group 1 is the minimum for the app to boot and be safe; groups 2–3 land when the founder finishes the corresponding vendor setup.

### 1. Ready now (values already generated in `apps/web/.env.prod`)

| Variable | Value source | Scope | Status |
|---|---|---|---|
| `MONGODB_URI` | `.env.prod` — **⚠️ currently the DEV cluster; replace with the prod Atlas SRV string before launch** (decision 2) | Production | ⚠️ ready-to-smoke-test, **replace before launch** |
| `SESSION_SECRET` | `.env.prod` (generated `openssl rand -hex 32`) | Production | ✅ ready |
| `MFA_ENC_KEY` | `.env.prod` (generated `openssl rand -hex 32`) | Production | ✅ ready |
| `CRON_SECRET` | `.env.prod` (generated `openssl rand -hex 32`) | Production | ✅ ready |
| `ADMIN_EMAIL` | `.env.prod` — `accounts@arcaevo.com` (bootstrap owner account) | Production | ✅ ready |
| `ADMIN_PASSWORD` | `.env.prod` (generated `openssl rand -base64 24`) — **rotate after first login + MFA enrolment** | Production | ✅ ready |
| `ADMIN_PATH_SLUG` | `.env.prod` (generated `openssl rand -hex 6`) — admin panel served at `/<slug>`, `/admin` 404s | Production | ✅ ready |
| `NEXT_PUBLIC_SITE_URL` | `https://arcaevo.com` (not secret) | Production | ✅ ready |

Why the first four are non-negotiable: `SESSION_SECRET` and `ADMIN_PASSWORD` are **boot-fail-closed** in production (`src/lib/env.ts` `assertRequiredSecrets` — the server throws on boot without them; `ADMIN_PASSWORD` stops being required only once `ADMIN_BOOTSTRAP_DISABLED=true`). `MFA_ENC_KEY` fails closed the moment admin MFA is used — and MFA is mandatory for every real admin — so it is effectively required. `CRON_SECRET` is required by the **erasure cron already declared in `apps/web/vercel.json`** (daily 03:00 UTC → `/api/v1/cron/run-erasure`; Vercel sends `Authorization: Bearer $CRON_SECRET` automatically, and in prod the route 401s without it).

### 2. Pending founder — Stripe live (docs/STRIPE_SETUP.md §4)

| Variable | Value source | Scope | Status |
|---|---|---|---|
| `STRIPE_SECRET_KEY` | Stripe Dashboard, **live** mode — restricted `rk_live_…` | Production | ⏳ pending founder |
| `STRIPE_PUBLISHABLE_KEY` | Stripe Dashboard, live `pk_live_…` | Production | ⏳ pending founder |
| `STRIPE_WEBHOOK_SECRET` | live Dashboard webhook endpoint → `https://arcaevo.com/api/v1/webhooks/stripe` (`whsec_…`) | Production | ⏳ pending founder |
| `STRIPE_PRICE_ARCAEVO_*` (8 ids, optional) | `npm run stripe:setup` against the live key; else resolved by `lookup_key` at runtime | Production | ⏳ optional |

Until these are set the checkout path stays on the deterministic mock vendor — set all three together.

### 3. Pending founder — email, analytics, hardening

| Variable | Value source | Scope | Status |
|---|---|---|---|
| `EMAIL_PROVIDER` (`smtp`) + `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `EMAIL_FROM` | SES CDK outputs + derived SMTP password (`infra/cdk/SES_SETUP.md`, `docs/DNS_EMAIL_AND_PREPROD.md`) — unset = outbox-only (emails stored in Mongo, not sent) | Production | ⏳ pending founder (SES out of sandbox) |
| `NEXT_PUBLIC_POSTHOG_KEY` | PostHog **EU** project settings — blank/unset = analytics fully off | Production | ⏳ pending founder (DPA first) |
| `ADMIN_BOOTSTRAP_DISABLED` (`true`) | set **only after** the real owner admin has logged in and enrolled MFA — kills the shared-password break-glass login (`ADMIN_PASSWORD` then no longer needed to boot) | Production | ⏳ post-first-login step |

### 4. Pending founder — AI narration (Amazon Bedrock, `docs/MOCKED_APIS.md` §20)

The IAM policy is now code: `ArcaevoEmailStack` (infra/cdk) grants `bedrock:InvokeModel` on the Haiku EU inference profile + underlying foundation model to the same `arcaevo-ses-smtp` user whose keys are the ARCAEVO_AWS_* values — **redeploy `ArcaevoEmailStack` to apply**; the existing long-lived keys then work with no console edits. The full path (our SigV4 signer → Bedrock EU → Haiku narration) was **live-verified 2026-07-06** with temporary STS credentials. While the flag is unset the insights API serves the deterministic templates only — identical to today.

| Variable | Value source | Scope | Status |
|---|---|---|---|
| `ARCAEVO_AWS_ACCESS_KEY_ID` / `ARCAEVO_AWS_SECRET_ACCESS_KEY` / `ARCAEVO_AWS_REGION` (`eu-west-1`) | Shared app-wide AWS creds (already documented for SES) — Bedrock access ships with the CDK email stack (see above; EU data residency; LLM provider is a listed sub-processor on `/legal/privacy`) | Production | ⏳ pending founder (redeploy `ArcaevoEmailStack`) |
| `ARCAEVO_AWS_SESSION_TOKEN` (optional) | **only for STS temporary credentials** (smoke tests / assumed roles) — signed + sent as `x-amz-security-token`. Long-lived IAM keys don't need it; leave unset in production | Production | — leave unset (long-lived keys) |
| `AI_NARRATION_ENABLED` (`true`) | flip **only after** the stack redeploy above — exactly `"true"`, anything else stays off | Production | ⏳ pending founder — **leave unset until then** |
| `BEDROCK_MODEL_ID` (optional) | default `eu.anthropic.claude-haiku-4-5-20251001-v1:0` (EU cross-region inference profile) — the profile form is **required**: verified 2026-07-06 that the bare `anthropic.claude-haiku-4-5-20251001-v1:0` id is rejected for on-demand InvokeModel ("Retry with an inference profile"). Override only to change model/profile | Production | ⏳ optional override |

### Never set in production

`ALLOW_DEMO_TOKEN`, `ALLOW_OPEN_WEBHOOKS`, `ALLOW_MOCK_EXTRACTION`, `RATE_LIMIT_DISABLED`, `STRIPE_FORCE_MOCK` — local prod-build/e2e escape hatches only; setting any of them on Vercel is a security hole (`ENVIRONMENTS_AND_SETUP.md` §3.5). `LETSGETCHECKED_WEBHOOK_SECRET` stays unset until the (still-mocked) lab integration is real.

---

## Runbook: flipping the tested plans ON (later)

When the lab/phlebotomy partner and a registered clinician are live:

1. In Vercel Production, add `BLOOD_TIERS_ENABLED=true` **and** `NEXT_PUBLIC_BLOOD_TIERS_ENABLED=true`.
2. **Redeploy — a rebuild IS required for the website.** `/pricing` is statically prerendered, so the server flag is baked into its HTML at `next build`; a Vercel redeploy (which rebuilds) is what picks the new value up. (As of today the web client code doesn't actually read the `NEXT_PUBLIC_` mirror anywhere — the server flag decides everything — but set both, per convention, so any future client-side use and pre-prod parity stay correct.)
3. **iOS needs no app update**: it reads `GET /api/v1/config` (`force-dynamic`) → `{ "bloodTiersEnabled": true }` at runtime once the redeploy is live.
4. Verify: `/pricing` shows live checkout on Essential/Performance, `/checkout?tier=essential` no longer redirects away, `curl https://arcaevo.com/api/v1/config` returns `true`.

No code change is involved at any point — env + redeploy only.

---

## Post-paste smoke checks

- Deploy boots (no `Missing required production environment variables` in build/function logs).
- `/{ADMIN_PATH_SLUG}` serves the admin login; `/admin` returns 404.
- Sign in as `accounts@arcaevo.com` with the bootstrap password → **rotate it and enrol MFA immediately** → later set `ADMIN_BOOTSTRAP_DISABLED=true`.
- Settings → Cron Jobs shows the erasure job after first deploy.
- `curl https://arcaevo.com/api/v1/config` → `{ "bloodTiersEnabled": false }`; `/pricing` shows Get early access on Essential/Performance and Fusion €119 buyable.
