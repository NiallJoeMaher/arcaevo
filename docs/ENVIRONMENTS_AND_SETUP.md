# Arcaevo — Environments & Setup (the one operations doc)

_The single, authoritative "where does every value go" guide. It takes you from **Local** dev → a **Dev/Preview** environment on Vercel + AWS + **sandbox Stripe** (test on your own devices for ~a week) → **Production** (arcaevo.com). Vercel-centric. Written 2026-07-05._

**Companion docs (this doc points to them, doesn't duplicate them):**
`apps/web/.env.example` (canonical var list) · `infra/cdk/SES_SETUP.md` (SES/DKIM values) · `docs/EMAIL_ADDRESSES.md` · `docs/STRIPE_SETUP.md` · `docs/DEVICE_TESTING_AND_RELEASE.md` · `docs/OBSERVABILITY.md` · `docs/MOCKED_APIS.md` · `docs/GO_LIVE_RUNBOOK.md` · `docs/PRELAUNCH_CHECKLIST.md` (the owner-tagged checkbox list).

---

## 1. TL;DR — the environment model

Three environments. The **code is identical**; only the env vars, the domain, the DB, and the vendor modes differ.

| | **Local** | **Dev / Preview** | **Production** |
|---|---|---|---|
| Runs where | Your Mac (`docker compose` / `npm run dev`) | **Vercel** (Preview + Development scopes) | **Vercel** (Production scope) |
| URL | `http://localhost:3000` | `https://dev.arcaevo.com` (or a `*.vercel.app` preview URL) | `https://arcaevo.com` |
| Git branch | — | PRs / non-`main` branches | `main` |
| Database | docker Mongo (`:27019`) | **dev** Atlas cluster (eu-west-1) | **prod** Atlas cluster (eu-west-1) |
| Email | MailHog outbox (`:8026`) | **SES sandbox** (verified recipients only) | **SES production** (left the sandbox) |
| Stripe | mock (`STRIPE_FORCE_MOCK=true`) | **Stripe TEST** keys (`sk_test_…`) | **Stripe LIVE** keys (`rk_live_…`, when charging) |
| Mock/dev gates | auto-on (non-prod) | **leave UNSET** (it's `NODE_ENV=production` on Vercel) | **leave UNSET** |
| iOS build points at | `http://<mac-LAN-ip>:3000/api/v1` (Debug) | `https://dev.arcaevo.com/api/v1` | `https://arcaevo.com/api/v1` (Release) |

**One-line summary of what's different per environment:** the **DB string**, the **domain / `NEXT_PUBLIC_SITE_URL`**, the **email provider (MailHog → SES sandbox → SES prod)**, the **Stripe mode (mock → test → live)**, and whether the four `ALLOW_*`/`RATE_LIMIT_DISABLED` gates are set (**local only, never on Vercel**).

> **Key fact:** anything deployed on Vercel runs with `NODE_ENV=production`. That means Dev/Preview on Vercel is "production-grade" for the fail-closed secrets (`SESSION_SECRET`, `ADMIN_PASSWORD`, `MFA_ENC_KEY`, `CRON_SECRET`) and for the mock gates being **off** — so a Preview deploy behaves like prod, just with dev credentials/data. This is what makes it a faithful ~week-long test.

---

## 2. Vercel project setup (step by step)

1. **Import the repo.** Vercel dashboard → **Add New… → Project** → import the `arcaevo` GitHub repo.
2. **Set the Root Directory to `apps/web`.** ⚠️ This is the single most important setting. The repo is a **non-workspace monorepo** — there is **no root `package.json`**; each app (`apps/web`, `apps/ios`, `infra/cdk`) is self-contained. In the import screen (or later under **Settings → General → Root Directory**) set Root Directory = **`apps/web`**. Everything below (framework, build, env, cron) is resolved relative to that directory.
3. **Framework = Next.js** (auto-detected). Build command `next build`, install `npm install`, output is **standalone** (set in `next.config.ts` — leave the defaults; Vercel handles it). Do not override the build/output settings.
4. **Region = `dub1` (Dublin, EU).** Already pinned in `apps/web/vercel.json` (`"regions": ["dub1"]`) — confirm it under **Settings → Functions** shows Dublin, not a US default. EU residency is a GDPR posture requirement.
5. **The three env scopes → branches:**
   - **Production** = the `main` branch → `arcaevo.com`.
   - **Preview** = every PR / non-`main` branch deploy → a generated `*.vercel.app` URL (and `dev.arcaevo.com` if you assign it, step 7).
   - **Development** = values pulled by `vercel dev` / `vercel env pull` for local use. You will rarely deploy this scope; it exists so `vercel env pull .env.local` can hydrate a local run. Local dev normally just uses your own `apps/web/.env.local` (step 3 of the matrix).
6. **Enable Vercel Cron.** The daily GDPR erasure job is declared in `apps/web/vercel.json`:
   ```json
   "crons": [{ "path": "/api/v1/cron/run-erasure", "schedule": "0 3 * * *" }]
   ```
   Vercel reads this automatically on deploy (Cron is available on Pro). Vercel calls the path daily at 03:00 UTC with `Authorization: Bearer $CRON_SECRET` — so **`CRON_SECRET` must be set** in the scope you want the cron to run (Production, and Preview if you want to prove it there). Check **Settings → Cron Jobs** shows the job after the first deploy.
7. **Add the domains** (Settings → Domains):
   - **Production:** add `arcaevo.com` (and `www.arcaevo.com` → redirect). Vercel shows you the exact **A / CNAME** records to add (see §4).
   - **Dev subdomain:** add `dev.arcaevo.com` and **assign it to a branch** (e.g. a long-lived `dev` branch) via **Settings → Domains → Edit → Git Branch**. Now pushing that branch deploys to a stable `dev.arcaevo.com` you can point your phone at for a week — instead of a new random preview URL each push.

---

## 3. The env-var matrix

Every variable from `apps/web/.env.example`. **Scope column** tells you where to set it: Local `.env.local` (gitignored) and/or which Vercel scope (**P**roduction / **Pre**view / **D**evelopment). Set Vercel vars under **Settings → Environment Variables**, ticking the scope checkboxes.

**Two classes of value:**
- **`NEXT_PUBLIC_*`** → compiled into the client bundle. Safe to expose (it's public by definition). Never put a secret behind a `NEXT_PUBLIC_` name.
- **Everything else** → server-only. On Vercel these are **encrypted at rest**; never commit them. The tracked `apps/web/.env.example` holds only **placeholders** — the real secret values you've already produced live in the **gitignored `apps/web/.env.local`** (SES SMTP creds + Stripe test keys + price ids).

### 3.1 Core / secrets (always set)

| Variable | Purpose | Where to set | Example / notes |
|---|---|---|---|
| `MONGODB_URI` | Mongo connection string | Local `.env.local`; Vercel **P / Pre / D** (a *different* cluster per scope) | Local: `mongodb://localhost:27019/arcaevo`. Dev/Prod: Atlas SRV string (§7). **Secret.** |
| `SESSION_SECRET` | HMAC key for admin session cookie | Local `.env.local`; Vercel **P / Pre** | Long random string. **Fail-closed in prod** — server refuses to boot if unset. Use a *different* value per environment. **Secret.** |
| `ADMIN_PASSWORD` | Bootstrap OWNER break-glass password | Local `.env.local`; Vercel **P / Pre** | Local `change-me-local`; prod a long random string. Required to boot unless `ADMIN_BOOTSTRAP_DISABLED=true`. **Secret.** |
| `ADMIN_EMAIL` | Email the bootstrap owner is keyed to | Optional — Local; Vercel **P / Pre** | Defaults to `owner@arcaevo.local`. Point it at a real owner you'll MFA-enrol. |
| `MFA_ENC_KEY` | AES-256-GCM key sealing admin TOTP secrets at rest | Local optional; Vercel **P / Pre** | Long random string. **Fail-closed in prod once MFA is used** (and MFA is mandatory for real admins) → effectively required in prod. Dev derives from `SESSION_SECRET` if unset. Rotating it forces admins to re-enrol. **Secret.** |
| `CRON_SECRET` | Bearer the erasure cron must present | Local optional; Vercel **P** (and **Pre** to test) | Long random string. Vercel Cron sends it automatically. In prod **without** it the cron route fails closed (401). **Secret.** |
| `ADMIN_PATH_SLUG` | Secret path segment the admin dashboard is served under | Vercel **P** (and **Pre**) | Defaults to `admin` (dev/e2e reach `/admin`). **Prod MUST set a long random slug** — `/admin/*` then 404s; `/{slug}/*` serves the panel. **Never** a `NEXT_PUBLIC_` var. **Secret.** |
| `NEXT_PUBLIC_SITE_URL` | Canonical URL (metadata, sitemap, OG, links in email) | Local `.env.local`; Vercel **P / Pre / D** | Local `http://localhost:3000`; Dev `https://dev.arcaevo.com`; Prod `https://arcaevo.com`. Public (client). |

### 3.2 Analytics

| Variable | Purpose | Where to set | Example / notes |
|---|---|---|---|
| `NEXT_PUBLIC_POSTHOG_KEY` | PostHog EU project key | Vercel **P / Pre** only when you want analytics on; else leave blank | Blank = analytics fully disabled (no-op). EU host `https://eu.i.posthog.com` is hardcoded. Public (client). Needs a signed PostHog-EU DPA before real users (`PRELAUNCH_CHECKLIST.md §2.4`). |

### 3.3 Email / SES SMTP (`docs/EMAIL_ADDRESSES.md`, `infra/cdk/SES_SETUP.md`)

Unset ⇒ outbox-only (Mongo). Set the block to also send via SMTP.

| Variable | Purpose | Where to set | Example / notes |
|---|---|---|---|
| `EMAIL_PROVIDER` | Selects real SMTP send | Local (`mailhog`); Vercel **P / Pre** (`smtp`) | `mailhog`/`smtp` both send via nodemailer; unset = outbox-only. |
| `SMTP_HOST` | SMTP server | Local; Vercel **P / Pre** | Local MailHog `localhost` (`:1026`); SES `email-smtp.eu-west-1.amazonaws.com`. |
| `SMTP_PORT` | SMTP port | Local; Vercel **P / Pre** | `1026` (MailHog); `587` STARTTLS (SES) or `465` TLS-on-connect. |
| `SMTP_USER` | SMTP username | Vercel **P / Pre** (already in Local `.env.local`) | SES: the IAM **access key id** (`SmtpUsername` CDK output). Set BOTH user+pass or neither. **Secret.** |
| `SMTP_PASS` | SMTP password | Vercel **P / Pre** (already in Local `.env.local`) | SES: the **derived** SMTP password (SES_SETUP.md §5) — **not** the raw IAM secret. Never logged. **Secret.** |
| `SMTP_SECURE` | TLS-on-connect | Local (unset); Vercel **P / Pre** | Literal `"true"` for `:465`; leave false/unset for `:587` STARTTLS / MailHog. |
| `EMAIL_FROM` | From address | Local optional; Vercel **P / Pre** | `Arcaevo <no-reply@arcaevo.com>`. Must be `*@arcaevo.com` (IAM `ses:FromAddress` condition). Default in code `Arcaevo <hello@arcaevo.com>`. |

### 3.4 Stripe (`docs/STRIPE_SETUP.md`)

The **LIVE** vendor auto-activates when `STRIPE_SECRET_KEY` is a real `sk_`/`rk_` key and `STRIPE_FORCE_MOCK!=="true"`. Otherwise the deterministic mock.

| Variable | Purpose | Where to set | Example / notes |
|---|---|---|---|
| `STRIPE_PUBLISHABLE_KEY` | Publishable key (future client Elements) | Local `.env.local`; Vercel **P / Pre** | `pk_test_…` (dev) / `pk_live_…` (prod). Not needed for hosted Checkout. Public-ish (kept server-side today). |
| `STRIPE_SECRET_KEY` | Secret key — **selects LIVE when a real key** | Local `.env.local`; Vercel **Pre** (test) / **P** (live) | Dev `sk_test_…` (already in `.env.local`); prod a restricted `rk_live_…`. **Secret.** |
| `STRIPE_WEBHOOK_SECRET` | Flips webhook to REAL `Stripe-Signature` verification | Local (from `stripe listen`); Vercel **Pre / P** | `whsec_…`. Unset = interim mock/shared-secret path. Dev via CLI or a test-mode Dashboard endpoint; prod via a live Dashboard endpoint. **Secret.** |
| `STRIPE_FORCE_MOCK` | Pin the mock even with a key present | Local prod-build / e2e only | `true`. Off-switch. **Do NOT set on Vercel Dev/Preview** (you want the real test-mode path there) or Prod. |
| `STRIPE_PRICE_ARCAEVO_FUSION_ANNUAL` | Pin Price id (€119 sub) | Optional — Local `.env.local`; Vercel **Pre / P** | `price_…`. Created by `npm run stripe:setup`; else resolved by `lookup_key` at runtime. |
| `STRIPE_PRICE_ARCAEVO_ESSENTIAL_ANNUAL` | Pin Price id (€329 sub) | ″ | ″ |
| `STRIPE_PRICE_ARCAEVO_PERFORMANCE_ANNUAL` | Pin Price id (€399 sub) | ″ | ″ |
| `STRIPE_PRICE_ARCAEVO_QUARTERLY_UPGRADE` | Pin Price id (+€130 sub) | ″ | ″ |
| `STRIPE_PRICE_ARCAEVO_ADDON_FULL_PANEL` | Pin Price id (€99 add-on) | ″ | ″ |
| `STRIPE_PRICE_ARCAEVO_ADDON_RECHECK` | Pin Price id (€69 add-on) | ″ | ″ |
| `STRIPE_PRICE_ARCAEVO_ADDON_VENOUS` | Pin Price id (€199 add-on) | ″ | ″ |
| `STRIPE_PRICE_ARCAEVO_RECHECK_KIT` | Pin Price id (€69 kit) | ″ | ″ |

### 3.5 Mock / dev-only gates — ⚠️ NEVER on Vercel

These four exist **only** so a local **prod-build** stack (docker / Playwright e2e, which run `NODE_ENV=production` on your Mac) keeps working. They are **auto-on in non-production** already, so you don't set them for `npm run dev`. **Set them in NOTHING on Vercel — not Production, not Preview, not Development.** Setting any of them on a Vercel deploy is a security hole.

| Variable | What it would do | Where to set |
|---|---|---|
| `ALLOW_DEMO_TOKEN` | Honour the `demo-member-token` bearer → a real seeded member's Art.9 data | **Local prod-build / e2e only.** Never Vercel. |
| `ALLOW_OPEN_WEBHOOKS` | Keep the mock webhook path open with no signing secret | **Local prod-build / e2e only.** Never Vercel. |
| `ALLOW_MOCK_EXTRACTION` | Keep the mock AI bloodwork extractor fabricating marker values | **Local prod-build / e2e only.** Never Vercel. |
| `RATE_LIMIT_DISABLED` | Turn off IP rate-limiting on the auth endpoints | **Local prod-build / e2e only.** Never Vercel. |

Also **never set `STRIPE_FORCE_MOCK`** on Vercel Dev/Preview or Prod (§3.4). `LETSGETCHECKED_WEBHOOK_SECRET` is optional and only relevant once the (still-mocked) lab integration is real — leave unset for now.

---

## 4. DNS — where the records actually go

You don't yet have a place you know to add DNS records. Two options:

**Recommended — move nameservers to Vercel DNS.** In the Vercel dashboard → **Domains**, add `arcaevo.com` and follow the prompt to change the domain's **nameservers** (at whatever registrar you bought it from) to Vercel's. Then **every** record — the app A/CNAME **and** the SES email records below — is managed in one place (Vercel → Domains → arcaevo.com → DNS Records). Simplest single source of truth.

**Alternative — keep DNS at your registrar / current DNS host** (e.g. Cloudflare, the registrar's own panel). Add the app records Vercel tells you, plus the email records, there. Works fine; you just manage records in two dashboards.

### 4.1 App records (Vercel tells you the exact values)
When you add the domain in Vercel it shows the precise records:
- **Apex `arcaevo.com`** → an **A** record to Vercel's anycast IP (e.g. `76.76.21.21` — use whatever Vercel shows), or an ALIAS/flattened CNAME if your DNS host supports it.
- **`www.arcaevo.com`** → **CNAME** to `cname.vercel-dns.com` (Vercel's value).
- **`dev.arcaevo.com`** (the dev subdomain) → add it as a domain in Vercel assigned to your `dev` branch; Vercel gives you a **CNAME** to `cname.vercel-dns.com`.

### 4.2 Email records (from the SES CDK stack — `infra/cdk/SES_SETUP.md §2`)
Add these to the `arcaevo.com` zone. The DKIM token values come from `npx cdk deploy ArcaevoEmailStack` outputs — paste the real values in place of the placeholders:

**a) Easy DKIM — 3 CNAMEs (required; SES verifies via these):**
```
<DkimCname1Name>   CNAME   <DkimCname1Value>     # from CDK outputs
<DkimCname2Name>   CNAME   <DkimCname2Value>     # from CDK outputs
<DkimCname3Name>   CNAME   <DkimCname3Value>     # from CDK outputs
```
**b) Custom MAIL FROM on `mail.arcaevo.com` — MX + SPF (recommended):**
```
mail.arcaevo.com   MX    10 feedback-smtp.eu-west-1.amazonses.com
mail.arcaevo.com   TXT   "v=spf1 include:amazonses.com ~all"
```
**c) Apex SPF + DMARC (manual — SES can't create these):**
```
arcaevo.com          TXT   "v=spf1 include:amazonses.com ~all"
_dmarc.arcaevo.com   TXT   "v=DMARC1; p=none; rua=mailto:dmarc@arcaevo.com; fo=1"
```
Start DMARC at `p=none`, tighten to `quarantine`/`reject` once DKIM+SPF are confirmed aligned.

**d) Receiving MX (only if you want inboxes for `privacy@`, `support@`, etc.):** SES is **send-only**. To *receive*, add your mailbox provider's MX on the **apex** (e.g. Migadu, EU-hosted — `docs/EMAIL_ADDRESSES.md §2–3`). SES's MAIL FROM MX lives on the `mail.` subdomain only, so the two don't collide.

> **A note on the apex vs subdomain split:** SES's Return-Path MX goes on **`mail.arcaevo.com`**; your inbox provider's delivery MX goes on the **apex `arcaevo.com`**. If both your SES SPF and a receiving-provider SPF are needed, merge into **one** apex SPF TXT — never publish two SPF records.

---

## 5. Email sending — the three concepts (the founder's question answered)

Three separate things people conflate:

1. **The mailbox / local-part** — the bit before the `@`, e.g. `no-reply`. It's just a label on an address; it does not by itself need "setting up" to *send*.
2. **The verified sending domain** — the domain SES verifies and **DKIM-signs** mail for. Here that's the **apex `arcaevo.com`** (`DEFAULT_SENDING_DOMAIN` in the CDK stack). This is what makes your mail trusted.
3. **The custom MAIL FROM subdomain** — `mail.arcaevo.com`, the bounce / **Return-Path** domain. It insulates the apex from bounce/SPF handling and aligns the Return-Path to your own domain. It is a plumbing subdomain — **you never send from a visible `@mail.arcaevo.com` address.**

**Recommended setup (already the configured pattern):**
- **From = `no-reply@arcaevo.com`** — clean, on the main domain, trustworthy. (`hello@arcaevo.com` is also valid for human-answerable mail; the IAM policy allows any `*@arcaevo.com`.)
- **MAIL FROM = `mail.arcaevo.com`** — already set by the CDK stack (bounces/Return-Path).

So you get a trustworthy visible From on the apex **and** subdomain insulation of the apex for bounces/SPF. Because Arcaevo only sends **transactional** mail (receipts, kit reminders, results-ready, sign-in codes), the standard, correct pattern is exactly this: **apex-verified + DKIM + DMARC + a MAIL-FROM subdomain.** No bulk/marketing subdomain needed.

**For Dev:** two options —
- Simplest for the ~week test: stay in the **SES sandbox** and verify each test recipient as an identity (the sandbox only sends to verified addresses). The already-proven interim sender/recipient `niall@codu.ie` works today.
- Later/cleaner: a dev sending subdomain (`dev.arcaevo.com` / `mail.dev.arcaevo.com`) verified separately in SES. Not required to start.

---

## 6. Stripe in dev (test mode) — end to end

Goal: a **real** sandbox card charge flowing through the dev/preview deploy, so the LIVE-vendor code path (hosted Checkout → server-to-server webhook → membership activation) is exercised — not the browser mock.

1. **Keys:** keep `STRIPE_SECRET_KEY=sk_test_…` and `STRIPE_PUBLISHABLE_KEY=pk_test_…` (already in `apps/web/.env.local`; add them to Vercel **Preview**). A real `sk_test_` key is enough to select the LIVE vendor — `STRIPE_FORCE_MOCK` must be **unset** on Vercel.
2. **Products/Prices:** `cd apps/web && npm run stripe:setup` (reads the test key from `.env.local`) — idempotently creates the 8 SKUs in **test** mode and prints the `STRIPE_PRICE_*` lines you can optionally pin.
3. **Webhook signing secret** — pick one:
   - **Stripe CLI (local):** `stripe listen --forward-to https://dev.arcaevo.com/api/v1/webhooks/stripe` → copy the `whsec_…` it prints into `STRIPE_WEBHOOK_SECRET`. (Or forward to `localhost:3000` for a fully-local test.)
   - **Dashboard test-mode endpoint (for the deployed dev URL):** Developers → Webhooks (in **test mode**) → Add endpoint → `https://dev.arcaevo.com/api/v1/webhooks/stripe`, subscribe to `checkout.session.completed`, `customer.subscription.updated/deleted`, `invoice.paid`, `invoice.payment_failed`; copy its signing secret into `STRIPE_WEBHOOK_SECRET` (Vercel **Preview**).
4. Once `STRIPE_WEBHOOK_SECRET` is set, the route does **real signature verification** and the `/checkout` client redirects to hosted Stripe Checkout. Pay with test card `4242 4242 4242 4242` (any future expiry/CVC). Membership activates only via the real webhook.
5. For live, see `docs/STRIPE_SETUP.md §4` (restricted `rk_live_`, live Prices, Stripe Tax + IE VAT, Customer Portal config, Apple Pay domain verification).

Full detail and test cards: **`docs/STRIPE_SETUP.md`**.

---

## 7. Atlas (MongoDB)

1. **Dev cluster:** create a cluster in **eu-west-1** (Atlas → free M0 is fine for the trial, or M10). Add a **least-privilege DB user**, and either an IP allow-list or `0.0.0.0/0` for Vercel's dynamic egress (tighten later / use a PrivateLink if you go serverless-static-IP). Copy the SRV connection string → set `MONGODB_URI` in Vercel **Preview** (and **Development** if you `vercel env pull`).
2. **Seed the dev DB:** `cd apps/web && npm run seed` (deterministic demo data incl. bootstrap admin) and `npm run seed:user EMAIL=niall@codu.co` to add your own member. Run these with `MONGODB_URI` pointed at the dev cluster (locally, e.g. `MONGODB_URI="<dev-atlas-uri>" npm run seed`).
3. **Prod cluster (later):** a separate eu-west-1 cluster; set `MONGODB_URI` in Vercel **Production**. Confirm **encryption-at-rest ON**, **backups/PITR enabled and EU-region**, IP allow-list, least-privilege user, and run one **restore test** (`PRELAUNCH_CHECKLIST.md §3.2`). Sign the Atlas DPA (`§2.1`).

---

## 8. iOS pointing at the dev backend

The iOS app is **not** on Vercel — it's a native app that talks to a backend URL via the **`ARCAEVO_API_BASE_URL`** Info.plist key (per build configuration, set from `apps/ios/project.yml`).

- **Debug** default: `http://localhost:3000/api/v1` (simulator) — for a physical device pointed at your Mac use your LAN IP (`http://<mac-ip>:3000/api/v1`, `DEVICE_TESTING_AND_RELEASE.md §1.3`).
- **To test a device against the DEV Vercel backend:** set `ARCAEVO_API_BASE_URL` = **`https://dev.arcaevo.com/api/v1`**. Easiest is to point the **Debug** config at it (it's HTTPS, so full ATS is satisfied — the Debug `NSAllowsLocalNetworking` exception isn't even needed). Edit the per-config value in `apps/ios/project.yml` (or `Info-Debug.plist`), then `cd apps/ios && xcodegen generate && open Arcaevo.xcodeproj`, build to your iPhone.
- **Release** is HTTPS-only and points at `https://arcaevo.com/api/v1` — keep it that way for production; when the real prod host is confirmed, update the Release `ARCAEVO_API_BASE_URL` in `project.yml` and the fallback literal in `APIClient.swift` (`MOCKED_APIS.md §4a`).
- **`SENTRY_DSN`** (Info.plist, empty by default → Sentry off): set the per-config `SENTRY_DSN` build setting to an **EU** Sentry project DSN when you want iOS crash/error reporting (`OBSERVABILITY.md §3`).

Real HealthKit needs a physical iPhone + worn Apple Watch — see `docs/DEVICE_TESTING_AND_RELEASE.md` for the full device-testing and TestFlight path.

---

## 9. Runbooks

### (A) Stand up DEV end-to-end

1. **Vercel project:** import the repo → **Root Directory = `apps/web`** → confirm Next.js + region `dub1`.
2. **Dev domain:** add `dev.arcaevo.com`, assign it to a `dev` branch (§2.7). Add the CNAME Vercel shows (§4.1).
3. **Dev Atlas:** create an eu-west-1 cluster + DB user; grab the SRV `MONGODB_URI` (§7).
4. **Env vars — Vercel Preview scope** (tick Preview; add Development too if you'll `vercel env pull`):
   - `MONGODB_URI` (dev cluster), `SESSION_SECRET`, `ADMIN_PASSWORD`, `ADMIN_EMAIL`, `MFA_ENC_KEY`, `CRON_SECRET`, `ADMIN_PATH_SLUG` (long random), `NEXT_PUBLIC_SITE_URL=https://dev.arcaevo.com`.
   - Email (SES sandbox): `EMAIL_PROVIDER=smtp`, `SMTP_HOST=email-smtp.eu-west-1.amazonaws.com`, `SMTP_PORT=587`, `SMTP_USER`, `SMTP_PASS`, `SMTP_SECURE=false`, `EMAIL_FROM=Arcaevo <no-reply@arcaevo.com>` (from `.env.local`).
   - Stripe (test): `STRIPE_SECRET_KEY=sk_test_…`, `STRIPE_PUBLISHABLE_KEY=pk_test_…` (from `.env.local`).
   - **Do NOT set** the four `ALLOW_*` gates, `RATE_LIMIT_DISABLED`, or `STRIPE_FORCE_MOCK`.
5. **SES sandbox + DNS:** deploy `ArcaevoEmailStack` (`SES_SETUP.md`); add the 3 DKIM CNAMEs + MAIL FROM MX/SPF + apex SPF/DMARC (§4.2); verify your test recipient addresses (sandbox). Wait for "Verified".
6. **Stripe test webhook:** add a **test-mode** Dashboard endpoint → `https://dev.arcaevo.com/api/v1/webhooks/stripe` (or `stripe listen`), set `STRIPE_WEBHOOK_SECRET` in Preview (§6).
7. **Deploy** the `dev` branch → Vercel builds `apps/web` and serves `dev.arcaevo.com`. Confirm **Settings → Cron Jobs** shows the erasure job.
8. **Seed the dev DB:** `MONGODB_URI="<dev-atlas-uri>" npm run seed` then `... npm run seed:user EMAIL=niall@codu.co` (§7).
9. **Point iOS at it:** set Debug `ARCAEVO_API_BASE_URL=https://dev.arcaevo.com/api/v1`, `xcodegen generate`, build to your iPhone (§8).
10. **Run a sandbox-Stripe test:** on `dev.arcaevo.com`, sign up → magic-link (lands via SES to your verified address) → consent → checkout with `4242…` → confirm membership activates via the real webhook. Test on your devices for ~a week.

### (B) Promote to PROD (the delta — keep short, see `PRELAUNCH_CHECKLIST.md`)

Only the differences from DEV:
- **DB:** a separate **prod** Atlas cluster (encryption-at-rest, EU backups/PITR, restore-tested); set `MONGODB_URI` in Vercel **Production**.
- **Env (Production scope):** real, **distinct** secrets — new `SESSION_SECRET`, `ADMIN_PASSWORD`, `MFA_ENC_KEY`, `CRON_SECRET`, a long-random `ADMIN_PATH_SLUG`, `NEXT_PUBLIC_SITE_URL=https://arcaevo.com`.
- **Domain:** add `arcaevo.com` to Vercel, verify the A/CNAME (§4.1), HTTPS enforced.
- **Email:** **leave the SES sandbox** (request production access, `SES_SETUP.md §4`) so you can send to any recipient; same SMTP block with the production-domain creds.
- **Stripe (when charging):** restricted `rk_live_` key, live Prices (`npm run stripe:setup` with the live key), a **live** Dashboard webhook + its `STRIPE_WEBHOOK_SECRET`, Stripe Tax + IE VAT, Customer Portal config, Apple Pay domain verification (`STRIPE_SETUP.md §4`).
- **Gates:** **do NOT set** `ALLOW_DEMO_TOKEN`, `ALLOW_OPEN_WEBHOOKS`, `ALLOW_MOCK_EXTRACTION`, `RATE_LIMIT_DISABLED`, or `STRIPE_FORCE_MOCK` — anywhere.
- **First admin:** log in with `ADMIN_PASSWORD`, create real per-admin accounts, enrol MFA, then consider `ADMIN_BOOTSTRAP_DISABLED=true`.

**Everything else** (legal/DPIA/DPAs, Apple Developer + TestFlight, observability alerts, security sign-off) is the owner-tagged checklist: **`docs/PRELAUNCH_CHECKLIST.md`** (narrative: `docs/GO_LIVE_RUNBOOK.md`).
