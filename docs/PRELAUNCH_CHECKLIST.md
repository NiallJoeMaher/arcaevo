# Arcaevo — Pre-Launch Checklist (First Closed Trial, under Codú Limited)

> **The one doc to check off before going live.** Consolidates the legal, infra, payments, email, observability, Apple, security, and app-config work into a single authoritative, owner-tagged checklist for the **first internal / closed trial** (basic/Fusion tier — wearables + user-uploaded bloods — **no** lab partner, **no** paid blood-testing, **no** real clinician yet).
>
> **Practical guidance, not a substitute for a qualified Irish solicitor.** Interim controller: **Codú Limited**. Written 2026-07-05; sources: `docs/GO_LIVE_RUNBOOK.md`, `docs/LAUNCH_READINESS.md`, `docs/legal/*`, `infra/cdk/SES_SETUP.md`, `docs/STRIPE_SETUP.md`, `docs/DEVICE_TESTING_AND_RELEASE.md`.

**Owner legend:** 👤 **Founder** (decision / credential / contract / people) · 🛠 **Engineering** (code/infra) · 👥 **Both**
**Status legend:** ☐ not started · ◐ in progress · ☑ done · ⛔ blocker for the first real user · ⏭ paid-tier only (not needed for this trial)

> **Scope note:** a tiny **internal** TestFlight with yourself + a few people who *know* it's demo-grade is fine today. A closed trial with **real strangers' real health data** is not safe until every ⛔ below is cleared. Items marked ⏭ gate only the paid blood-testing tiers and are out of scope for this trial.

---

## ✅ Completed in the 2026-07-05 engineering session (branch `post-launch-improvements`)

These are **done and verified** (web 352 vitest + iOS 48 XCTests green; app + widgets + watch BUILD SUCCEEDED):
- **AWS SES email deployed to the sandbox AWS account + proven end-to-end** — CDK stack live, `niall@codu.ie` verified, a real email sent through the SES SMTP creds; IAM keys written to a git-ignored `.env.local` (interim sender = `niall@codu.ie`; production path = a `mail.arcaevo.com` subdomain, ready in CDK). *Remaining founder step: leave the SES sandbox (§4.3).*
- **Full security audit — 0 Critical / 0 High**, no unauthenticated path to health data, all 52 routes guarded, no IDOR (`docs/SECURITY_AUDIT.md`). Fixed the one real GDPR gap (W-1: consent withdrawal now revokes GP share links + the public share page refuses when the owner is suspended) plus W-2/3/4.
- **Admin hardening** — **mandatory TOTP 2FA** now enforced for real admin accounts, the `/admin` dashboard moved behind a secret `ADMIN_PATH_SLUG` (direct `/admin` → 404 in prod), and a `ADMIN_BOOTSTRAP_DISABLED` flag closes the bootstrap-owner MFA-bypass (audit A-1).
- **Payment-gating bug fixed** — live checkout now redirects to real Stripe (was activating memberships without charging); `invoice.paid`/`invoice.payment_failed` made idempotent; DB indexes added; ingestion baseline/RCV correctness fixed.
- **Fusion made real** on the insights API — a genuine wearable×blood co-movement computed from stored data (first real reader of the wearable signals).
- **iOS background layer** — background HealthKit refresh (scores/widgets update without opening the app), DSN-gated privacy-scrubbed **Sentry (iOS)**, and a first-visit re-engagement nudge.
- **Observability (web, dep-free)** — PostHog funnel events + a `logError` helper wired into previously-silent catches (off until the key/DSN is set); Sentry-web plan in `docs/OBSERVABILITY.md`.
- **Credibility layer** — honest trust signals (RCV methodology, EU-GDPR-native, clinician-reviewed, founding cohort) replacing the (absent) testimonials.
- **SEO** — canonicals, schema, `/compare/whoop` + `/compare/oura`, `lang=en-IE`, `llms.txt` (`docs/SEO_AUDIT.md`).
- **Legal/positioning docs** — `MEDICAL_DEVICE_POSITIONING.md` (MDR risk: **LOW**), `SOC2_READINESS.md`, Codú Limited set as interim controller, `legal.ts` controller name + "Vitality Age" copy reconciled.

---

## 1. Legal / entity / data protection (do first — gates real users)

| # | Item | Owner | Status |
|---|---|---|---|
| 1.1 | ⛔ Confirm **Codú Limited** as interim data controller; record its **CRO number** in `docs/legal/RECORDS_OF_PROCESSING.md`; note the plan to form a dedicated entity on monetisation. | 👤 | ☐ |
| 1.2 | ✅ **Company attribution set to Codú Limited; privacy/terms hardened (pending solicitor sign-off).** Public copy (`apps/web/src/content/legal.ts`, footer, `/legal/[doc]`, `/contact`, `/about`) now carries "Arcaevo is a product of Codú Limited, registered in Ireland", names Codú Limited (CRO `[TODO: CRO number]`) as data controller, and the privacy policy is expanded to Art. 9 depth (special-category data, Art. 6 + Art. 9(2)(a) consent, transfers/SCCs, retention + erasure, all DSAR rights, DPC complaint, Art. 22 note, cookies, security, children, versioning). **Still needs 1.4 solicitor sign-off + real CRO number.** | 👥 | ◐ |
| 1.3 | ⛔ **DPIA sign-off** — the draft (`docs/legal/DPIA.md`) is reviewed + signed by a DPO/solicitor before the first real user. | 👤 | ☐ |
| 1.4 | ⛔ **Solicitor review** of privacy policy, consent copy, terms, sub-processor page. | 👤 | ☐ |
| 1.5 | ⛔ **DPO decision** — appoint one, or document "no DPO required at trial scale" + name a **privacy contact**. | 👤 | ☐ |
| 1.6 | ⛔ **Reconcile the privacy/controller contact email** — pick `privacy@arcaevo.com` (deliverable via SES) and/or interim `niall@codu.ie`; align all legal docs + public copy. | 👥 | ☐ |
| 1.7 | ⛔ **Wellness / MDR disclaimers present + consistent** across site, App Store, onboarding, in-app, email — per `docs/legal/MEDICAL_DEVICE_POSITIONING.md` §4. Fix the "biological age" → "Vitality Age (wellness index)" copy (§3.5). | 👥 | ☐ |
| 1.8 | ⛔ **File the MDR/IVDR intended-purpose self-assessment** (`MEDICAL_DEVICE_POSITIONING.md` is its backbone) — dated, on file. Best estimate: **LOW risk** under current framing. | 👤 | ☐ |
| 1.9 | ⛔ **Breach-response contacts filled** (`BREACH_RESPONSE.md` [TBD]s) + confirm the **DPC breach-notification portal** route. | 👤 | ☐ |
| 1.10 | ⛔ **Cyber / data-breach insurance** in place (strongly advised for a health-data controller). | 👤 | ☐ |
| 1.11 | **Product/professional liability insurance** appropriate to a wellness product. | 👤 | ☐ |
| 1.12 | **Records of Processing (Art. 30)** + **retention schedule** finalised with statutory periods for Codú Limited's tax records. | 👤 | ◐ |

---

## 2. Sub-processor DPAs (⛔ all required before real users; SCCs where US-parented)

| # | Vendor | Owner | Status |
|---|---|---|---|
| 2.1 | ⛔ **MongoDB Atlas** DPA + SCCs (US-parented, EU-hosted). | 👤 | ☐ |
| 2.2 | ⛔ **Vercel** DPA + SCCs. | 👤 | ☐ |
| 2.3 | ⛔ **EU ESP** DPA (AWS SES → AWS DPA + SCCs; or Scaleway TEM = EU adequacy; or Postmark EU + SCCs). Choose first (see §4). | 👤 | ☐ |
| 2.4 | ⛔ **PostHog EU** DPA — *before analytics is enabled with real users* (or keep analytics OFF at launch). | 👤 | ☐ |
| 2.5 | ⏭ Stripe (EU entity), LetsGetChecked, phlebotomy vendor, EU OCR, LLM narration — paid-tier DPAs. | 👤 | ⏭ |
| — | *All DPAs signed **by Codú Limited**; novate to the dedicated entity on monetisation.* | 👤 | — |

---

## 3. Production infrastructure

| # | Item | Owner | Status |
|---|---|---|---|
| 3.1 | ⛔ **MongoDB Atlas** cluster created in **eu-west-1**; `MONGODB_URI` set. | 👤 | ☐ |
| 3.2 | ⛔ Confirm Atlas **encryption-at-rest ON**, **backups/PITR enabled AND EU-region**, **IP allow-list**, **least-privilege DB user**; run one **restore test**. | 👥 | ☐ |
| 3.3 | ⛔ **Vercel** project connected, **EU region (dub1/fra1)** confirmed for **functions** (not a US default). | 👥 | ☐ |
| 3.4 | ⛔ Point **`arcaevo.com`** (or chosen domain) at Vercel; HTTPS enforced. | 👤 | ☐ |
| 3.5 | ⛔ **Production env vars set:** `MONGODB_URI`, `SESSION_SECRET` (long random), `ADMIN_PASSWORD` (bootstrap owner), `ADMIN_EMAIL`, `MFA_ENC_KEY` (long random), `CRON_SECRET` (long random), `NEXT_PUBLIC_SITE_URL`. | 👤 | ☐ |
| 3.6 | ⛔ **Do NOT set** `ALLOW_DEMO_TOKEN`, `ALLOW_OPEN_WEBHOOKS`, `ALLOW_MOCK_EXTRACTION`, `RATE_LIMIT_DISABLED`, `STRIPE_FORCE_MOCK` in prod. | 🛠 | ☐ |
| 3.7 | ⛔ **Erasure cron** live — `vercel.json` (`0 3 * * *` → `/api/v1/cron/run-erasure`) with `CRON_SECRET` set; **monitor success + keep proof it ran** (§6). Runner is built. | 👥 | ◐ |
| 3.8 | Confirm PostHog **account region is EU** (not just ingest host), or keep analytics off. | 👥 | ☐ |

---

## 4. Email (magic-link auth depends on it — ⛔ blocker)

| # | Item | Owner | Status |
|---|---|---|---|
| 4.1 | ⛔ **Pick the ESP.** Recommended for this trial: **AWS SES** (`eu-west-1`) — the CDK stack + walkthrough already exist (`infra/cdk/SES_SETUP.md`), sending domain **`arcaevo.com`**. Cleanest EU-transfer alternative: **Scaleway TEM**. Sign the DPA. | 👤 | ☐ |
| 4.2 | ⛔ **Verify the sending domain** — add DKIM CNAMEs + custom MAIL FROM (`mail.arcaevo.com`) + SPF/DMARC to the `arcaevo.com` DNS zone; wait for SES "Verified". | 👤 | ☐ |
| 4.3 | ⛔ **Leave the SES sandbox** — request production access (otherwise you can only send to pre-verified addresses). | 👤 | ☐ |
| 4.4 | **Wire it** — set `EMAIL_PROVIDER=smtp`, `SMTP_*`, `EMAIL_FROM`. **DONE in the sandbox** (SES SMTP creds in `.env.local`, real send verified `niall@codu.ie`). Re-do with the production domain creds when 4.1/4.2 land. Adapter supports auth+TLS. | 🛠 | ☑ |
| 4.5 | Decide the **interim `From`/reply-to** — `no-reply@arcaevo.com` for sends, `privacy@arcaevo.com` and/or `niall@codu.ie` for contact. Align with §1.6. | 👤 | ☐ |
| 4.6 | Confirm **IP rate-limiting** on magic-link request/verify/signin (already on — `rate-limit.ts`). | 🛠 | ☑ |

---

## 5. Payments (Stripe) — ⏭ mostly paid-tier; basic trial can run free

| # | Item | Owner | Status |
|---|---|---|---|
| 5.1 | If the trial charges a membership fee: **Stripe account (EU entity — Stripe Payments Europe Ltd)**, restricted **live key** (`rk_live_`). Else skip for a free trial. | 👤 | ⏭ |
| 5.2 | Run `npm run stripe:setup` with the live key to create live Products/Prices (test-mode ones exist — `docs/STRIPE_SETUP.md`). | 👥 | ⏭ |
| 5.3 | Create prod **webhook endpoint** `https://<domain>/api/v1/webhooks/stripe`; set `STRIPE_WEBHOOK_SECRET`. | 👤 | ⏭ |
| 5.4 | Configure **Stripe Tax + Irish VAT**, Customer Portal, Apple Pay domain verification. | 👤 | ⏭ |
| 5.5 | Sign the **Stripe DPA** (controller/processor mix) before taking real payments. | 👤 | ⏭ |
| — | *Checkout, webhook verification, activation guard, portal route are built + test-verified.* | 🛠 | ☑ |

---

## 6. Observability (⛔ the highest-leverage technical gap)

| # | Item | Owner | Status |
|---|---|---|---|
| 6.1 | **Error monitoring** — **Sentry (iOS) wired** (DSN-gated, PII/health-scrubbed) — set `SENTRY_DSN`. **Web Sentry** needs `@sentry/nextjs` installed (repo forbade the install) — plan in `docs/OBSERVABILITY.md`; `logError` already writes structured errors to Vercel logs meanwhile. | 🛠 | ◐ |
| 6.2 | ⛔ **Erasure-cron success alerting** — alert if the daily drain fails or doesn't run; retain the run record as DPC proof. | 🛠 | ☐ |
| 6.3 | **Uptime / health-check monitoring** on the prod domain. | 🛠 | ☐ |
| 6.4 | **Analytics decision** — funnel events now **wired** (ids/counts/enums only, no health values — the invariant is coded); no-op until `NEXT_PUBLIC_POSTHOG_KEY` set. Decide EU-on (needs DPA §2.4 + consent gating) or off. | 👥 | ◐ |

---

## 7. Security (the audit's fixes)

| # | Item | Owner | Status |
|---|---|---|---|
| 7.1 | **Per-admin accounts + roles + `admin_access_log` + IP rate-limiting** — shipped (`ADMIN_AUTH_OPTIONS.md`). | 🛠 | ☑ |
| 7.2 | ⛔ **First admin bootstrap** — deploy, log in with `ADMIN_PASSWORD`, create real per-admin accounts at `/admin/admins`, then consider disabling the bootstrap-password path. | 👤 | ☐ |
| 7.3 | **MFA now MANDATORY** for real admin accounts (enforced enrollment gate — shipped). Founder step: enroll each admin at `/admin/security`; decide the owner-driven **recovery** flow for a lost authenticator. | 👥 | ◐ |
| 7.4 | **Fail-closed secrets** (`SESSION_SECRET`/`ADMIN_PASSWORD`/`MFA_ENC_KEY`/`CRON_SECRET`) — enforced in code; just set them (see 3.5). | 🛠 | ☑ |
| 7.5 | **Mock AI bloodwork extraction is gated** — `ALLOW_MOCK_EXTRACTION` unset in prod ⇒ honest manual-entry-only (shipped). Just don't set the flag in prod (§3.6). | 🛠 | ☑ |
| 7.6 | Two security reviews passed. Consider a **third-party pen test** before any wider (non-internal) launch. | 👤 | ⏭ |

---

## 8. App configuration & product integrity

| # | Item | Owner | Status |
|---|---|---|---|
| 8.1 | ⛔ **HealthKit primer lists only signals actually ingested** — no "Workouts" claim until ingestion ships (integrity + App Review risk). | 🛠 | ☐ |
| 8.2 | ⛔ **Insights / Ask-Arcaevo** — ship real generated (rules-decide/AI-narrates) content **or clearly label as "coming"** so users aren't shown fabricated insights about real data. Constrain any narration to the wellness/MDR line. | 👥 | ☐ |
| 8.3 | ⛔ Confirm **critical/flagged values never enter the scoring engine** (`BiomarkerPenalty.derive` excludes them) and route to the human clinician-first flow. Verify in code before real bloods. | 🛠 | ☐ |
| 8.4 | Verify **cycle/menstrual data** is never synced unless cycle-aware baselines are enabled (only if cycle features ship). | 🛠 | ⏭ |
| 8.5 | Confirm the **blood-layer ON/OFF toggle** behaves as a true config flag (the MDR fallback). | 🛠 | ☐ |
| 8.6 | ⏭ **Real IMC-registered clinician + medical-ops partner** — replaces the mock "Dr. S. Nolan." **Must not reach real users on paid tiers.** Basic tier doesn't gate on this (self-reported bloods are never shown as clinician-reviewed). | 👤 | ⏭ |

---

## 9. Apple — iOS build & TestFlight

*(Detailed Apple Developer Program guidance in §10 below.)*

| # | Item | Owner | Status |
|---|---|---|---|
| 9.1 | ⛔ **Apple Developer Program** membership (€99/yr) — see §10 for **Individual vs Organization (Codú Limited)** recommendation. | 👤 | ☐ |
| 9.2 | ⛔ Set **`DEVELOPMENT_TEAM`** on all four targets in `apps/ios/project.yml`. | 👥 | ☐ |
| 9.3 | ⛔ **App ID capabilities:** HealthKit, App Groups (`group.co.arcaevo.app`), Background Modes, Associated Domains (`applinks:<domain>`), Push (when ready). | 👤 | ☐ |
| 9.4 | ⛔ Host **AASA** at `https://<domain>/.well-known/apple-app-site-association`; uncomment associated-domains in `project.yml` (magic-link opens app). | 👥 | ☐ |
| 9.5 | ⛔ **HealthKit purpose strings** name each read type in plain language; **cycle tracking is a separate purpose string requested only on enable** — never in the first sheet. Don't list a type you don't read. | 🛠 | ◐ |
| 9.6 | ⛔ **App Privacy labels** declare health data as **linked to the user**; health **not** used for advertising/tracking. | 👤 | ☐ |
| 9.7 | Confirm Release build points at `https://<domain>/api/v1` (HTTPS-only — already set). | 🛠 | ☑ |
| 9.8 | Keep web-checkout as **Safari link-outs**, never an in-app IAP sheet (service consumed outside the app); be ready to justify to review. | 👥 | ☐ |
| 9.9 | ⛔ **Internal TestFlight** → yourself + a few testers. Then External (Beta App Review) with a **seeded demo login + written HealthKit/data-handling explanation** for the reviewer. | 👤 | ☐ |

---

## 10. Apple Developer Program — do you need Codú Limited membership?

**Short answer:** For the **earliest internal TestFlight**, an **Individual** account (Niall's own) is enough and is the fastest way to get building today. For **any real trial where the app is publicly attributed to "Arcaevo" / Codú Limited** (External TestFlight beta, App Store), move to an **Organization** account under **Codú Limited**. Start Individual, plan the Organization enrolment in parallel because it takes longer.

### Individual vs Organization

| | **Individual** | **Organization** |
|---|---|---|
| Seller/team name shown | Your **personal name** | **Codú Limited** (the company) |
| Cost | €99/yr | €99/yr (same) |
| Requirement | Apple ID + 2FA | **D-U-N-S number** for Codú Limited + legal-entity verification; you must have **authority to bind** the company |
| Enrolment time | Usually same day | **Longer** — days to weeks (D-U-N-S lookup/verification, Apple's entity check) |
| Team members / roles | Just you | Multiple users with roles (Admin, Developer, App Manager) — needed once you add help |
| Best for | Earliest internal testing | Anything user-facing / branded / multi-person |

### D-U-N-S number (the Organization gate)
- Apple requires a **D-U-N-S number** to verify Codú Limited as a legal entity. It's **free** from Dun & Bradstreet; an established Irish company like **Codú Limited very likely already has one** (check Apple's D-U-N-S lookup tool first — many companies are already registered).
- If it doesn't exist, request it free — allow **up to ~2 weeks** (often faster). Do this **now, in parallel**, so it isn't the critical path.
- The company details Apple sees (legal name, address) must **match** the D-U-N-S record exactly.

### Account holder / authority
- The **Account Holder** for the Organization must be a person with **legal authority to bind Codú Limited** to Apple's agreements — that's **Niall** as the company's principal. Apple may verify this.
- You can later invite additional users with limited roles; the Account Holder role stays with the binding individual.

### Concrete recommendation for the trial phase
1. **Today:** enrol/renew **Niall's Individual** Apple Developer account (€99, same-day). Set `DEVELOPMENT_TEAM` to that team, build, and push an **Internal** TestFlight to yourself + a handful of people who know it's demo-grade. This unblocks device testing immediately.
2. **In parallel (start now):** confirm/obtain **Codú Limited's D-U-N-S** and begin **Organization** enrolment (€99). It's the slow item — front-load it.
3. **Before the app is attributed to "Arcaevo" publicly** (External TestFlight beta with real trial users, or App Store): switch to the **Codú Limited Organization** team. Rebuild with the org `DEVELOPMENT_TEAM`; re-provision the App ID + capabilities under the org.
   - *Caveat:* an app already uploaded under the Individual account **cannot be silently reassigned** to the org — plan to publish the branded build under the Organization from the start of the external phase to avoid a bundle-ID migration headache. Keep the Individual account purely for throwaway internal builds.

**Net:** Individual now to move fast; Organization under Codú Limited before real, branded trial users. €99/yr each — budget for both during the overlap; you can drop the Individual once the org is live.

---

## 11. The top blockers — what actually stops the first test

Everything engineering-side for the basic tier is largely built and verified. The gating items are almost all **👤 founder** decisions/credentials. In priority order:

1. **Legal foundation (§1):** confirm **Codú Limited** as controller, **DPIA sign-off**, solicitor-reviewed privacy copy, DPO decision, wellness/MDR disclaimers + self-assessment on file.
2. **DPAs (§2):** signed with **Atlas, Vercel, the chosen ESP, PostHog** (SCCs where US-parented).
3. **Production DB + env (§3):** Atlas eu-west-1 (encryption-at-rest, EU backups, restore-tested) + all prod env vars set + erasure cron monitored.
4. **EU email (§4):** pick + verify the ESP (SES on `arcaevo.com` is the fastest path), leave the SES sandbox, wire SMTP — magic link is the only way in.
5. **Apple Developer account (§9/§10):** Individual now to build; **Codú Limited Organization** (D-U-N-S) in parallel for the branded external beta.

Give Engineering the **DB string + ESP creds** and the backend can be production-configured the same day. The bloodwork partner + named clinician (⏭) gate only the **paid** tiers, not this trial.

---

_Practical guidance only, not legal advice. Have an Irish solicitor confirm the legal/entity items and an MDR-competent professional confirm the wellness positioning before the first real user._
