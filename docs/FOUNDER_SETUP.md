# Arcaevo — Founder Setup (everything YOU personally sign up for)

> **What this is.** A single checkbox list of every external **account, credential, contract, or signature** that only *you* (the founder) can create — as distinct from engineering work, which is largely **done and verified** (SES sandbox proven, Stripe wired in test mode, analytics wired-but-dark, security audited, erasure cron built). For each item: **what it is · why · rough cost · where to sign up (EU-hosting noted where it matters for GDPR) · the value you hand back to me to wire in.**
>
> Written 2026-07-05. Companion docs (don't re-derive — follow them): `docs/ENVIRONMENTS_AND_SETUP.md` (where every value goes), `docs/PRELAUNCH_CHECKLIST.md` (the owner-tagged gate list), `infra/cdk/SES_SETUP.md` (SES/DKIM values), `docs/EMAIL_ADDRESSES.md`, `docs/STRIPE_SETUP.md`, `docs/DEVICE_TESTING_AND_RELEASE.md`, `docs/OBSERVABILITY.md`.

---

## ⚡ The "give me three things and dev is live the same day" callout

Everything backend is built. To stand up a real **Dev** environment I need exactly **three** values from you. Get me these and I can have `dev.arcaevo.com` serving the whole app, on your phone, the same day:

1. **A dev MongoDB Atlas URI** — one free `M0` cluster in **eu-west-1**, a DB user, the SRV `mongodb+srv://…` string. → I set `MONGODB_URI`.
2. **A Vercel project** — import the repo with **Root Directory = `apps/web`** (the one setting that matters), region **`dub1`**. Invite me and I fill in the env vars.
3. **A verified SES sender** — the sandbox is already proven end-to-end (`niall@codu.ie` verified, a real email sent). For dev you can **stay in the sandbox** and just verify each test recipient. No new work needed to start — the SMTP creds are already in `.env.local`.

Stripe test keys are already in, so a sandbox card charge works on dev with zero extra credentials. Everything below the dev line is what turns dev into a **public production** launch.

---

# PART A — What unblocks DEV (test on your own devices for ~a week)

| ☐ | Item | Cost | Where | What you hand me |
|---|---|---|---|---|
| ☐ | **MongoDB Atlas — dev cluster** | Free (`M0`) | [cloud.mongodb.com](https://cloud.mongodb.com) → cluster in **eu-west-1** | The SRV `MONGODB_URI` → I set it in Vercel **Preview** |
| ☐ | **Vercel account + import repo** | Free (Hobby) to start; **Pro €20/mo** for Cron | [vercel.com](https://vercel.com) → Add New → Project → **Root Directory `apps/web`**, region **`dub1`** | Add me as a member; I set env vars + deploy |
| ☐ | **`dev.arcaevo.com` subdomain** | — (needs the domain, Part B) | Vercel → Domains → assign to a `dev` branch | Nothing — I point iOS at it |
| ☐ | **SES sandbox sender** | Free | Already done — verify each test recipient in the SES console | Already in `.env.local`; nothing new |
| ☐ | **Apple Developer — Individual** | **€99/yr** | [developer.apple.com](https://developer.apple.com) → enrol (same-day) | Your 10-char **Team ID** → I set `DEVELOPMENT_TEAM`, build to your iPhone |

### A1. MongoDB Atlas — dev cluster
- **What:** the app's database (members, consents, readings, waitlist, gifts). **Why:** the whole backend needs a real DB the Vercel deploy can reach; docker Mongo is Mac-only.
- **How:** create a **free M0 cluster in eu-west-1** (Ireland). Add a **least-privilege DB user** and allow `0.0.0.0/0` for Vercel's dynamic egress (tighten later). Copy the connection string.
- **Value:** the `MONGODB_URI`. I seed it (`npm run seed` + `seed:user EMAIL=niall@codu.co`) and set it in Vercel Preview. *(Ref: `ENVIRONMENTS_AND_SETUP.md §7`.)*

### A2. Vercel — account + import the repo
- **What:** where the Next.js web app runs. **Why:** it's the primary host (dub1/Dublin = EU residency).
- **The one critical setting:** **Root Directory = `apps/web`.** This is a non-workspace monorepo (no root `package.json`); Vercel must build from `apps/web` or nothing resolves. Framework auto-detects as Next.js; leave build/output defaults alone.
- **Cron note:** the daily GDPR erasure job (`vercel.json` → `/api/v1/cron/run-erasure`) needs **Vercel Pro** (Cron isn't on Hobby). Fine to start on Hobby for dev; Pro is required before prod.
- **Value:** a project I can add env vars to + a dev deploy. *(Ref: `ENVIRONMENTS_AND_SETUP.md §2`.)*

### A3. Apple Developer — Individual (build to your own devices now)
- **What:** Apple Developer Program membership under **your personal name**. **Why:** HealthKit on a distributed build, App Groups, and TestFlight all need a paid membership (€99/yr); a free Apple ID only signs 7-day builds to your own device.
- **How:** enrol as an **Individual** — same-day. Grab your **Team ID** (Xcode → Settings → Accounts, or developer.apple.com → Membership).
- **Value:** the Team ID → I set `DEVELOPMENT_TEAM` on all four iOS targets and push an **Internal** TestFlight to you + a few people who know it's demo-grade.
- **Start the Organization enrolment in parallel** — see B6; it's the slow one, front-load it. *(Ref: `PRELAUNCH_CHECKLIST.md §10`.)*

---

# PART B — What's needed for PROD / public launch

> None of this gates a private dev test on your own devices. All of it gates a **closed trial with real strangers' real health data** — which is not safe until every legal/DPA item below is signed. Order roughly = priority.

## B1. Domain & DNS — `arcaevo.com`

| ☐ | Item | Cost | Where |
|---|---|---|---|
| ☐ | Registrar access to **arcaevo.com** | ~€10–15/yr (already owned?) | wherever it was bought |
| ☐ | Move DNS to Vercel (recommended) **or** add records at the registrar | — | Vercel → Domains, or registrar panel |

- **What:** control of the `arcaevo.com` DNS zone. **Why:** you need to add the app records (A/CNAME) **and** the SES email records (DKIM/SPF/DMARC) **and** the mailbox-provider MX.
- **Recommended:** point the domain's **nameservers at Vercel DNS** so app + email records live in one place.
- **Value:** the ability to add the exact records — **don't re-derive them.** Vercel shows the app A/CNAME; the DKIM CNAME values come from the SES CDK outputs. Follow **`ENVIRONMENTS_AND_SETUP.md §4`** and **`SES_SETUP.md §2`** verbatim. *(Records summarised in `EMAIL_ADDRESSES.md §3`.)*

## B2. AWS — real account + SES production access + a mailbox provider

| ☐ | Item | Cost | Where | Note |
|---|---|---|---|---|
| ☐ | **Production AWS account** | Free tier covers SES send volume | [aws.amazon.com](https://aws.amazon.com) | Sandbox account already exists for dev |
| ☐ | **SES production access** (leave the sandbox) | Free | SES → Account dashboard → **Request production access** | Approval usually < 24h |
| ☐ | **Sign the AWS DPA** (SES sub-processor) | Free | AWS Artifact | GDPR sub-processor requirement |
| ☐ | **Mailbox provider — EU-hosted, catch-all** | ~€5–20/yr | **Migadu** (EU) or **Zoho-EU** | To *receive* at privacy@/support@ |

- **SES sends, it does not receive.** SES gives you DKIM-signed *outbound* transactional email (sign-in codes, receipts, results-ready). Leaving the sandbox is what lets you send to **any** recipient, not just pre-verified ones. *(Ref: `SES_SETUP.md §4`.)*
- **You still need inboxes.** `privacy@arcaevo.com` and `security@arcaevo.com` map to **statutory deadlines** (DSR ~1 month, breach notification 72h) — they must be **monitored**, not black holes. Add an **EU-hosted mailbox provider with a catch-all** on the apex `arcaevo.com`: **Migadu** (France/Switzerland — recommended for the EU posture) or **Zoho Mail EU DC**. Avoid US-parented Fastmail/Google Workspace unless already standardised on them. *(Ref: `EMAIL_ADDRESSES.md §2`.)*
- **`dpo@` caution:** do **not** advertise a `dpo@` address anywhere — publishing it can be read as a voluntary DPO appointment you've deliberately not taken on. Use `privacy@` / "privacy contact". *(Ref: `EMAIL_ADDRESSES.md §5`.)*
- **Value:** production-domain SMTP creds (re-derived per `SES_SETUP.md §5`) + a monitored inbox behind every role address.

## B3. MongoDB Atlas — prod cluster + DPA

| ☐ | Item | Cost | Where |
|---|---|---|---|
| ☐ | Separate **prod cluster** in eu-west-1 | ~$0 (M0) to ~$57/mo (M10) | cloud.mongodb.com |
| ☐ | Confirm encryption-at-rest ON, **EU-region backups/PITR**, IP allow-list, least-privilege user, one **restore test** | included | Atlas console |
| ☐ | **Sign the Atlas DPA + SCCs** (US-parented, EU-hosted) | Free | Atlas legal |

- **What:** a production DB isolated from dev data. **Value:** the prod `MONGODB_URI` for Vercel **Production**. *(Ref: `ENVIRONMENTS_AND_SETUP.md §7`, `PRELAUNCH_CHECKLIST.md §3.2`.)*

## B4. Vercel — production posture + DPA

| ☐ | Item | Cost | Where |
|---|---|---|---|
| ☐ | **Upgrade to Pro** (Cron + the erasure job) | €20/mo | Vercel billing |
| ☐ | Add `arcaevo.com` (+ `www` redirect) | — | Vercel → Domains |
| ☐ | Confirm **functions region = dub1** (not a US default) | — | Settings → Functions |
| ☐ | **Sign the Vercel DPA + SCCs** | Free | Vercel legal |

*(Ref: `ENVIRONMENTS_AND_SETUP.md §2`, `PRELAUNCH_CHECKLIST.md §2.2/§3.3`.)*

## B5. Stripe — real account + live keys (only when you charge)

| ☐ | Item | Cost | Where |
|---|---|---|---|
| ☐ | **Stripe account — Ireland/EU entity** (Stripe Payments Europe Ltd) | Free; ~1.5% + €0.25/txn EU cards | [stripe.com](https://stripe.com) |
| ☐ | Create a **restricted live key** (`rk_live_…`) | — | Dashboard → API keys |
| ☐ | Create the **live webhook endpoint** → `https://arcaevo.com/api/v1/webhooks/stripe` | — | Dashboard → Webhooks |
| ☐ | Enable **Stripe Tax + IE VAT registration**, configure the **Customer Portal**, verify **Apple Pay** domain | — | Dashboard settings |
| ☐ | **Sign the Stripe DPA** | Free | Stripe legal |

- **Test mode is fully wired today** (test keys in `.env.local`, `4242…` charges flow through the real LIVE-vendor code path on dev). Live is only needed when you actually take money — a **free trial can launch without any of this**.
- **Value:** the `rk_live_` key + `STRIPE_WEBHOOK_SECRET`. I run `npm run stripe:setup` with the live key to create the 8 live Prices (€119/€329/€399, +€130, €99/€69/€199, €69 recheck kit). *(Ref: `STRIPE_SETUP.md §4`, `ENVIRONMENTS_AND_SETUP.md §6`.)*

## B6. Apple Developer — Organization under Codú Limited (branded beta)

| ☐ | Item | Cost | Where |
|---|---|---|---|
| ☐ | Confirm/obtain **Codú Limited D-U-N-S number** | Free | Apple's D-U-N-S lookup → Dun & Bradstreet |
| ☐ | Enrol the **Organization** account (Account Holder = you, authority to bind Codú) | €99/yr | developer.apple.com |

- **Why a second account:** the moment the app is publicly attributed to "Arcaevo"/Codú (External TestFlight, App Store), the seller must be the **company**, not your personal name. Organization enrolment is **slow** (D-U-N-S verification, days-to-weeks) — **start it now in parallel** with the Individual account (A3).
- **Caveat:** an app uploaded under the Individual account can't be silently reassigned to the org — publish the branded build under the Organization **from the start of the external phase**. Keep the Individual account for throwaway internal builds. *(Ref: `PRELAUNCH_CHECKLIST.md §10`.)*

## B7. PostHog — EU analytics (likely the ONLY observability you need at first launch)

| ☐ | Item | Cost | Where |
|---|---|---|---|
| ☐ | **PostHog account — EU region** (not just EU ingest host) | Free (1M events/mo) | [eu.posthog.com](https://eu.posthog.com) |
| ☐ | **Sign the PostHog-EU DPA** before real users | Free | PostHog legal |

- **What:** product analytics. **Why:** the funnel is **fully wired and dark** — the entire member journey (`SignupStarted → … → CheckoutCompleted`, `WaitlistJoined`, `GiftRedeemed`, `ErasureRunCompleted`) is coded and PII/health-free by design; it stays a **no-op until `NEXT_PUBLIC_POSTHOG_KEY` is set.**
- **This is very likely the only observability you need for launch.** **Sentry is a deliberate fast-follow** (the `@sentry/nextjs` dependency is currently banned; `logError` already writes structured errors to Vercel logs meanwhile). Don't block launch on it.
- **Value:** the project key. I set it in Vercel; funnels light up the moment it lands. *(Ref: `OBSERVABILITY.md §1`, `PRELAUNCH_CHECKLIST.md §2.4`.)*

## B8. Legal & compliance — the real gate (👤 founder, needs a solicitor)

> **This is the actual critical path.** Engineering is done; a closed trial on real health data is blocked almost entirely on **founder decisions and signatures**. None is legal advice — engage a **qualified Irish solicitor** and an MDR-competent reviewer.

| ☐ | Item | Cost (indicative) | Who |
|---|---|---|---|
| ☐ | **Record Codú Limited CRO number** as interim controller | — | you (`RECORDS_OF_PROCESSING.md`) |
| ☐ | **DPIA sign-off** — draft is ready (`docs/legal/DPIA.md`) | solicitor/DPO fee | solicitor / DPO |
| ☐ | **"DPO not required" memo** signed (or appoint a DPO + name a privacy contact) | — | solicitor (memo drafted) |
| ☐ | **Solicitor review** — privacy policy, consent copy, terms, sub-processor page | solicitor fee | solicitor |
| ☐ | **MDR/IVDR intended-purpose self-assessment** filed & dated (best estimate: **LOW risk**) | — | you + MDR reviewer |
| ☐ | **Sub-processor DPAs** — Atlas, Vercel, AWS/SES, PostHog (SCCs where US-parented), all signed **by Codú Limited** | free | you |
| ☐ | **Cyber / data-breach insurance** (strongly advised for a health-data controller) | ~€1–3k/yr | insurer/broker |
| ☐ | **Product/professional liability insurance** | broker quote | insurer/broker |
| ☐ | **Breach-response contacts** filled + DPC breach-portal route confirmed | — | you (`BREACH_RESPONSE.md`) |

- **The DPAs are individually free** but must each be signed by Codú Limited (novate to a dedicated entity on monetisation). Bundle them with the solicitor review.
- **Value:** signed docs on file + the CRO number for the public copy. Without the DPIA sign-off and the four DPAs, no real user can be onboarded. *(Ref: `PRELAUNCH_CHECKLIST.md §1–2`, `GO_LIVE_RUNBOOK.md Phase 0`.)*

---

## Rough annual budget (indicative)

| Line | ~€/yr |
|---|---|
| Vercel Pro | €240 |
| MongoDB Atlas (M0 free → M10 if needed) | €0–700 |
| Apple Developer ×2 (Individual + Organization, during overlap) | €198 |
| Mailbox provider (Migadu/Zoho-EU) | €5–20 |
| Domain | €10–15 |
| PostHog / SES / Stripe base | €0 (usage-based) |
| Cyber + liability insurance | €1–3k |
| Solicitor (DPIA + policy review + DPAs) | one-off, get a quote |

**Net:** dev costs ~nothing and moves today; the real spend and the real gate for a public health-data trial is **legal + insurance**, not infrastructure.
