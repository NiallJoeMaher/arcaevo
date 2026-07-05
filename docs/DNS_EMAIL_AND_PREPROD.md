# DNS, Email & Pre-prod — the founder's setup guide

_A precise, do-it-once walkthrough for wiring **arcaevo.com** end to end: where DNS lives and the single combined record set to publish; adding arcaevo.com + alias emails to your existing **Google Workspace** mailbox; and standing up a **pre-prod / staging** environment so you can test the **TestFlight** build against **sandbox Stripe** without touching production._

**The setup at a glance:**
- **App hosting:** Vercel (region `dub1`, Dublin).
- **Sending email (app → user):** AWS SES (`eu-west-1`) — receipts, kit reminders, results-ready, magic-link sign-in codes. Send-only; provides no inbox.
- **Receiving email (human → you):** your existing **Google Workspace** account, with `arcaevo.com` added and the role addresses as **aliases on your personal mailbox**.
- **DNS:** one authoritative zone for `arcaevo.com` holding app records **and** all email records.

> **The one thing you must get right:** a domain may publish **exactly one** `v=spf1` record. Because `arcaevo.com` sends via **both** Google (your human mail) **and** Amazon SES (app mail), the apex SPF must **combine both includes into a single record**. Two separate SPF records silently break SPF for everything. See [Part 1 → The critical gotcha](#the-critical-gotcha--one-spf-record-only).

Companion docs (this one is self-contained on DNS/email/pre-prod, but these go deeper):
`docs/ENVIRONMENTS_AND_SETUP.md` (full env-var matrix) · `infra/cdk/SES_SETUP.md` (SES/DKIM value generation) · `docs/EMAIL_ADDRESSES.md` (address scheme) · `docs/STRIPE_SETUP.md` (Stripe runbook) · `apps/web/.env.example` (canonical var list).

---

# Part 1 — Where DNS lives, and the one combined record set

## 1.1 DNS records go wherever arcaevo.com's *authoritative* DNS is

Every record below (app + email) has to be added in **one place**: whichever service is authoritative for `arcaevo.com`. You have two clean options.

| | **(A) Move nameservers to Vercel** — _recommended_ | **(B) Keep DNS at the registrar** |
|---|---|---|
| What you do | In Vercel → **Domains** → add `arcaevo.com`; Vercel shows you **2 nameservers** (e.g. `ns1.vercel-dns.com`, `ns2.vercel-dns.com`). Set those at the registrar. Then manage **all** records in Vercel → Domains → arcaevo.com → DNS Records. | Leave the registrar's nameservers in place. Add the app records Vercel gives you **and** every email record in the registrar's DNS panel. |
| Records live in | One dashboard (Vercel) | Two dashboards (Vercel for the app hookup values it tells you; registrar for the actual records) |
| Trade-off | Vercel becomes your single source of truth — but Vercel DNS is your dependency, and moving away later means re-pointing nameservers. | Nothing new to depend on; but you manage records in two places and it's easier to fumble the SPF merge. |

**Recommendation: option (A).** With app DNS and email DNS in one zone you can see the SPF, DKIM, MX and DMARC records side by side — which is exactly what stops the "two SPF records" mistake. The trade-off is a soft dependency on Vercel DNS; that's an acceptable one for a single-domain product.

> Whichever you choose, **propagation** after a nameserver change can take anywhere from minutes to ~48h. Don't panic if verification is not instant; re-check with `dig`/`nslookup` before assuming a record is wrong.

## 1.2 The single consolidated record set

Add **all** of the following to the `arcaevo.com` zone. Grouped by purpose. Placeholders in `<angle brackets>` are values a specific service hands you at setup time — use the real value it shows, not the placeholder.

| # | Type | Host / Name | Value | Purpose |
|---|---|---|---|---|
| **Vercel app** ||||
| 1 | A **or** ALIAS | `arcaevo.com` (apex) | `<exact target Vercel shows when you add the domain>` (e.g. an A record to `76.76.21.21`, or an ALIAS/flattened CNAME to `cname.vercel-dns.com` if your host supports it at the apex) | Apex → production app |
| 2 | CNAME | `www` | `cname.vercel-dns.com` (use Vercel's exact value) | `www` → production app |
| 3 | CNAME | `dev` | `cname.vercel-dns.com` (use Vercel's exact value) | `dev.arcaevo.com` → **pre-prod** deployment (Part 3) |
| **AWS SES — sending** ||||
| 4 | CNAME | `<DkimCname1Name>` (ends in `._domainkey.arcaevo.com`) | `<DkimCname1Value>` | SES Easy DKIM (selector 1) |
| 5 | CNAME | `<DkimCname2Name>` (ends in `._domainkey.arcaevo.com`) | `<DkimCname2Value>` | SES Easy DKIM (selector 2) |
| 6 | CNAME | `<DkimCname3Name>` (ends in `._domainkey.arcaevo.com`) | `<DkimCname3Value>` | SES Easy DKIM (selector 3) |
| 7 | MX | `mail` (`mail.arcaevo.com`) | `10 feedback-smtp.eu-west-1.amazonses.com` | SES custom MAIL FROM (bounce/Return-Path) |
| 8 | TXT | `mail` (`mail.arcaevo.com`) | `"v=spf1 include:amazonses.com ~all"` | SPF for the SES MAIL-FROM **subdomain** (separate name — this is allowed) |
| **Google Workspace — receiving** ||||
| 9 | MX | `arcaevo.com` (apex) | `1 smtp.google.com` (modern single record) | Deliver inbound human mail to Google |
| 10 | TXT | `arcaevo.com` (apex) | `google-site-verification=<from Google Admin console>` | Prove domain ownership to Google |
| 11 | TXT | `google._domainkey` (`google._domainkey.arcaevo.com`) | `<Google DKIM value from Admin → Gmail → Authenticate email>` | Google DKIM (`google` selector) |
| **Shared email auth (apex) — get these RIGHT** ||||
| 12 | TXT | `arcaevo.com` (apex) | `"v=spf1 include:_spf.google.com include:amazonses.com ~all"` | **The one combined SPF** (Google + SES). See gotcha below. |
| 13 | TXT | `_dmarc` (`_dmarc.arcaevo.com`) | `"v=DMARC1; p=none; rua=mailto:dmarc@arcaevo.com; fo=1"` | DMARC policy + aggregate reports |

Notes on specific rows:

- **Rows 1–3 (Vercel):** *"Vercel shows the exact target values when you add the domain — use those."* Don't hardcode an IP from this table; Vercel tells you the current apex target and the `www`/`dev` CNAME target when you add each domain. `dev` is assigned to your pre-prod branch (Part 3).
- **Rows 4–6 (SES DKIM):** the three hostnames and values come from `infra/cdk/SES_SETUP.md` / the CDK stack outputs (`DkimCname{1,2,3}Name` / `DkimCname{1,2,3}Value` after `npx cdk deploy ArcaevoEmailStack`). All three hostnames **end in `._domainkey.arcaevo.com`**. SES flips the domain identity to **Verified** once these resolve (minutes to ~72h).
- **Row 8 (SES MAIL-FROM SPF):** this SPF lives on the **`mail.arcaevo.com`** subdomain — a *different name* from the apex — so it happily coexists with the combined apex SPF. Do **not** try to fold this one into the apex; the MAIL-FROM domain needs its own SES-only SPF.
- **Row 9 (Google MX):** the **modern** Google config is the single record `MX 1 smtp.google.com`. If the Google setup wizard instead shows the **legacy 5-record set**, that's the equivalent alternative:
  ```
  arcaevo.com   MX   1   ASPMX.L.GOOGLE.COM
  arcaevo.com   MX   5   ALT1.ASPMX.L.GOOGLE.COM
  arcaevo.com   MX   5   ALT2.ASPMX.L.GOOGLE.COM
  arcaevo.com   MX   10  ALT3.ASPMX.L.GOOGLE.COM
  arcaevo.com   MX   10  ALT4.ASPMX.L.GOOGLE.COM
  ```
  Use **one or the other**, not both. The single-record form is preferred on new setups.

## 1.3 The critical gotcha — ONE SPF record only

A domain may have **exactly one** `v=spf1` TXT record on a given name. Publishing two is not "additive" — receivers that see multiple SPF records treat it as a `permerror` and SPF **fails for all your mail**, Google's and SES's alike.

`arcaevo.com` sends from **two** systems:
- **Google Workspace** — when you reply to a customer from Gmail, or "send as" `privacy@arcaevo.com`.
- **Amazon SES** — every transactional app email (`no-reply@arcaevo.com`).

So the apex SPF must contain **both includes in one record** (table row 12):

```
arcaevo.com   TXT   "v=spf1 include:_spf.google.com include:amazonses.com ~all"
```

- **Do NOT** create `"v=spf1 include:_spf.google.com ~all"` and `"v=spf1 include:amazonses.com ~all"` as two separate records. That breaks SPF.
- If Google's wizard tells you to add its SPF and you've *already* got the SES one (or vice-versa), **merge** — edit the existing record to hold both `include:` mechanisms, keep the single `~all` at the end.
- The `mail.arcaevo.com` SPF (row 8) is a **separate name** and stays SES-only — that's correct and is not a second apex record.

## 1.4 DMARC

One record (table row 13):

```
_dmarc.arcaevo.com   TXT   "v=DMARC1; p=none; rua=mailto:dmarc@arcaevo.com; fo=1"
```

- Start at **`p=none`** (monitor only — no mail is affected while you confirm alignment).
- `rua=mailto:dmarc@arcaevo.com` sends the daily aggregate reports to your `dmarc@` alias (Part 2).
- Once the reports show DKIM **and** SPF passing/aligned for both Google and SES over a week or two, tighten to **`p=quarantine`**, then later **`p=reject`**.

## 1.5 Why SES DKIM and Google DKIM both live here (and that's fine)

DKIM is keyed by a **selector** (a subdomain label under `_domainkey`). SES uses its own three selectors (rows 4–6); Google uses the `google` selector (row 11). Because these are **different names**, both sets of DKIM records coexist with zero conflict — that is expected and correct. A message signed by SES validates against the SES selectors; a message you send from Gmail validates against the `google` selector. Neither touches the other.

---

# Part 2 — Google Workspace: add arcaevo.com + alias emails to your personal mailbox

You already have a Google Workspace business account on **another domain**. Goal: receive mail sent to `privacy@arcaevo.com`, `support@arcaevo.com`, etc. **in your existing inbox**, without paying for new user seats.

## 2.1 Secondary domain vs alias — pick the right model

When you add a domain in Google Workspace you choose how it behaves:

| Model | What it is | Use when |
|---|---|---|
| **Secondary domain** | A domain on which you can create **separate user accounts** (`x@arcaevo.com` is its own mailbox/login). | You want distinct mailboxes/logins per address. |
| **Domain alias** | Every user automatically gets a mirror address at the new domain — mail to `you@arcaevo.com` lands in `you@yourolddomain.com`. | You want a 1:1 mirror of all users onto arcaevo.com. |
| **Alternate emails (user aliases)** ← _recommended here_ | Specific addresses added to **one existing user**, all delivering to that one inbox. Up to **30 per user**. | You want `privacy@`, `support@`, etc. to just drop into **your** inbox. |

For "aliases to my existing personal mailbox," add `arcaevo.com` and then attach the role addresses as **alternate email addresses (aliases) on your existing user**. This keeps everything in one inbox, needs no extra seat, and is the least moving parts.

## 2.2 Steps

1. **Add the domain.** Admin console (`admin.google.com`) → **Account → Domains → Manage domains → Add a domain** → enter `arcaevo.com`. Choose to add it as a **secondary domain** (this is the mode that lets you attach it and then use per-user aliases; you are *not* creating separate accounts).
2. **Verify ownership.** Google gives you a **`google-site-verification=…` TXT** record — add it to the apex (table **row 10**) and click Verify.
3. **Add the MX** so Google can receive for the domain — table **row 9** (`MX 1 smtp.google.com`, or the legacy 5-record set). Without MX, nothing routes to Google.
4. **Turn on Gmail DKIM.** Admin → **Apps → Google Workspace → Gmail → Authenticate email** → select `arcaevo.com` → **Generate new record** → publish the value as the `google._domainkey` TXT (table **row 11**) → back in the console click **Start authentication**.
5. **Create the aliases** on your existing user. Admin → **Directory → Users → [your user] → Alternate email addresses ("Add alternate emails")** and add:

   | Alias | Monitored? | Notes |
   |---|---|---|
   | `privacy@arcaevo.com` | **Yes — actively** | Data-subject requests (access/export/erasure) have a statutory ~1-month deadline; a breach clock can also land here. Not a black hole. |
   | `support@arcaevo.com` | Yes | User/account/app help. |
   | `hello@arcaevo.com` | Yes | General enquiries / catch-all landing. |
   | `security@arcaevo.com` | Yes | Vulnerability reports (published in `/.well-known/security.txt`); short SLA expected. |
   | `dmarc@arcaevo.com` | Yes (machine mail) | Receives the DMARC `rua=` aggregate reports (row 13). |

   Not created as a mailbox:
   - **`no-reply@arcaevo.com`** — this is **sent by SES**, never received. It needs **no mailbox and no alias**. (Replies to it can be discarded.)
   - **`dpo@arcaevo.com`** — **reserve it; do not create or advertise it yet.** Publicly designating a "DPO" can be read as a *voluntary* DPO appointment under GDPR Art. 37(7), triggering a regime you have deliberately not taken on at trial scale. Use `privacy@` and the label "privacy contact" everywhere user-facing. Flip to advertising `dpo@` only when a DPO is actually appointed. (See `docs/EMAIL_ADDRESSES.md §5`.)

## 2.3 Sending *as* an arcaevo.com address from Gmail

An alias lets you **receive**. To also **send** as e.g. `privacy@arcaevo.com` from Gmail:

- Gmail → **Settings → Accounts and Import → "Send mail as" → Add another email address** → `privacy@arcaevo.com`.
- Because you added `arcaevo.com` as a Workspace domain, Gmail routes the send through Google's servers — so it's **already covered by the combined SPF (`include:_spf.google.com`) and the Google DKIM** you set up above. No extra DNS needed.

## 2.4 Privacy note

`privacy@` is a **compliance control**, not a nicety. It maps to statutory deadlines (data-subject requests ~1 month; breach notification 72 hours to the DPC). Make sure it's genuinely watched — an unmonitored privacy mailbox is an audit finding waiting to happen.

---

# Part 3 — Pre-prod / staging for TestFlight with SANDBOX Stripe

Goal: a safe **pre-prod** environment where you can install the **TestFlight** build and run a **real sandbox-Stripe** checkout end to end — exercising the live-vendor code path (hosted Checkout → server-to-server webhook → membership activation) — **without touching production data or live money**.

## 3.1 The shape of it

| Piece | Pre-prod value |
|---|---|
| Hosting scope | **Vercel Preview** environment |
| URL | `https://dev.arcaevo.com` (the `dev` CNAME, table row 3, assigned to a long-lived `dev` branch) |
| Database | A **separate dev Atlas cluster** in `eu-west-1` — **never** prod data |
| Email | AWS SES (sandbox is fine for the test — verify each recipient, or use the on-screen magic-link code) |
| Stripe | **TEST** mode (`sk_test_…` / `pk_test_…`) + a **test-mode** webhook endpoint |
| iOS build | Release/TestFlight variant pointed at `https://dev.arcaevo.com/api/v1` |

Assign `dev.arcaevo.com` to a branch in Vercel → **Settings → Domains → Edit → Git Branch** (e.g. a long-lived `dev` branch) so every push to that branch redeploys the same stable URL — instead of a fresh random `*.vercel.app` preview URL each time. The full env-var matrix is in `docs/ENVIRONMENTS_AND_SETUP.md §3`; the TestFlight + Stripe-sandbox specifics below are self-contained.

> **Why Preview behaves like prod:** anything deployed on Vercel runs with `NODE_ENV=production`. So the Preview deploy enforces the same fail-closed secrets and keeps the mock gates **off** — it's a faithful rehearsal of prod, just with dev credentials and dev data.

## 3.2 Pre-prod env vars (Vercel **Preview** scope)

Set these under Vercel → **Settings → Environment Variables**, ticking **Preview** only. All secrets stay in Vercel (encrypted at rest) — **never committed**.

| Variable | Value | Notes |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | `https://dev.arcaevo.com` | Canonical URL for links in email, metadata, OG. |
| `MONGODB_URI` | `<dev Atlas SRV string>` | The **dev** cluster — never the prod one. |
| `SESSION_SECRET` | `<long random>` | Distinct from prod. Fail-closed in prod-grade runtime. |
| `ADMIN_PASSWORD` | `<long random>` | Bootstrap owner. |
| `MFA_ENC_KEY` | `<long random>` | Seals admin TOTP. |
| `CRON_SECRET` | `<long random>` | If you want to prove the erasure cron here. |
| `ADMIN_PATH_SLUG` | `<long random>` | Obscures the admin dashboard path. |
| `EMAIL_PROVIDER` | `ses` | Selects the SES v2 API send path (native HTTPS — best fit for Vercel serverless). |
| `ARCAEVO_AWS_REGION` | `eu-west-1` | (Bare `AWS_*` names are reserved on Vercel's runtime — use the `ARCAEVO_AWS_*` names.) |
| `ARCAEVO_AWS_ACCESS_KEY_ID` | `AKIA…` | The SES IAM access key id. |
| `ARCAEVO_AWS_SECRET_ACCESS_KEY` | `<secret>` | The SES IAM secret (never logged). |
| `EMAIL_FROM` | `Arcaevo <no-reply@arcaevo.com>` | Must be `*@arcaevo.com` (IAM `ses:FromAddress` condition). |
| `STRIPE_SECRET_KEY` | `sk_test_…` | A real **test** key selects the LIVE vendor against test mode. |
| `STRIPE_PUBLISHABLE_KEY` | `pk_test_…` | For future client Elements; harmless to set. |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` | From the **test-mode** Dashboard endpoint (§3.4). |

**Leave UNSET (this is deliberate):** the four dev-only gates and the mock pin —
`ALLOW_DEMO_TOKEN`, `ALLOW_OPEN_WEBHOOKS`, `ALLOW_MOCK_EXTRACTION`, `RATE_LIMIT_DISABLED`, and `STRIPE_FORCE_MOCK`.
Setting any of them on a Vercel deploy is a security hole. Leaving them unset is what makes the **real live-Stripe-vendor path run against your test keys** — i.e. a genuine test-mode checkout and a genuine test-mode webhook, exactly like production would behave.

> If you'd rather use SMTP than the SES v2 API, the equivalent block is `EMAIL_PROVIDER=smtp`, `SMTP_HOST=email-smtp.eu-west-1.amazonaws.com`, `SMTP_PORT=587`, `SMTP_SECURE=false`, `SMTP_USER=<SES access key id>`, `SMTP_PASS=<derived SMTP password>` (see `infra/cdk/SES_SETUP.md §5–6`). Either path sends from the same verified `arcaevo.com` identity.

## 3.3 Seed the dev DB

Give yourself data to test against — run these with `MONGODB_URI` pointed at the **dev** cluster:

```bash
cd apps/web
MONGODB_URI="<dev-atlas-uri>" npm run seed                       # deterministic demo data + bootstrap admin
MONGODB_URI="<dev-atlas-uri>" npm run seed:user EMAIL=niall@codu.co   # add your own member
```

## 3.4 Stripe sandbox webhook for pre-prod

This is what makes the checkout *real* end to end (not the browser mock):

1. In the Stripe **Dashboard**, switch to **Test mode** (toggle top-right).
2. **Developers → Webhooks → Add endpoint** → URL `https://dev.arcaevo.com/api/v1/webhooks/stripe`.
3. Subscribe to: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`.
4. Copy the endpoint's **signing secret** (`whsec_…`) into `STRIPE_WEBHOOK_SECRET` in Vercel **Preview** scope.
5. (First time) create the test-mode products/prices: `cd apps/web && npm run stripe:setup` (reads the test key; idempotent).

Once `STRIPE_WEBHOOK_SECRET` is set, the webhook route does **real `Stripe-Signature` verification** and membership activates **only** via the genuine test-mode webhook Stripe fires server-side. A checkout with card `4242 4242 4242 4242` (any future expiry, any CVC) → real test-mode webhook → membership active.

> **`stripe listen` is for LOCAL only.** `stripe listen --forward-to localhost:3000/...` (or forwarding to your Mac) is the local-dev path. For the deployed `dev.arcaevo.com` you want a **Dashboard test-mode endpoint** as above, so Stripe reaches the public URL directly.

## 3.5 Point the TestFlight / iOS build at pre-prod

The iOS app is **not** on Vercel — it's a native app that talks to a backend URL via the `ARCAEVO_API_BASE_URL` Info.plist key (per build configuration, from `apps/ios/project.yml`).

For the **pre-prod TestFlight build**, its `ARCAEVO_API_BASE_URL` **must be `https://dev.arcaevo.com/api/v1`** — so the beta build hits pre-prod, **not** prod.

1. Set the build configuration's `ARCAEVO_API_BASE_URL` to `https://dev.arcaevo.com/api/v1` in `apps/ios/project.yml` (it's HTTPS, so App Transport Security is fully satisfied — no local-networking exception needed).
2. `cd apps/ios && xcodegen generate && open Arcaevo.xcodeproj`.
3. Archive that variant and **upload to App Store Connect → TestFlight**.
4. Add yourself/testers to an **internal** TestFlight group — **internal testing needs no Beta App Review**, so the build is available to install within minutes.

> Keep the real **Release/production** `ARCAEVO_API_BASE_URL` at `https://arcaevo.com/api/v1`. Only this pre-prod beta variant points at `dev.`.

## 3.6 Pre-prod smoke test on TestFlight — checklist

Run this on your device once the pre-prod deploy is green:

- [ ] **Install** the pre-prod build via TestFlight.
- [ ] **Magic-link sign-in** — request the link; the email sends via **SES**. In the SES *sandbox* you can only send to **verified** recipients, so either verify your test address first, or use the on-screen **6-character code** fallback.
- [ ] **Grant HealthKit** permissions (real HealthKit needs a physical iPhone + worn Apple Watch).
- [ ] **Run a sandbox checkout** with card `4242 4242 4242 4242` (any future expiry/CVC).
- [ ] **Confirm membership is active** — the real test-mode webhook fired and activated it (not the browser mock).
- [ ] **Confirm the receipt email** arrived (SES).
- [ ] **Confirm no prod data was touched** — the run used the **dev** Atlas cluster and **test-mode** Stripe throughout.

---

## Appendix — quick verification commands

```bash
# SES identity + DKIM verification state
aws ses get-identity-verification-attributes --identities arcaevo.com --region eu-west-1
aws ses get-identity-dkim-attributes        --identities arcaevo.com --region eu-west-1

# Confirm there is exactly ONE apex SPF record (this must return a single v=spf1 line)
dig +short TXT arcaevo.com | grep spf1

# Google + SES DKIM selectors resolve independently
dig +short TXT google._domainkey.arcaevo.com
dig +short CNAME <DkimCname1Name>

# MX routing (Google on the apex; SES MAIL-FROM on the subdomain)
dig +short MX arcaevo.com
dig +short MX mail.arcaevo.com

# DMARC
dig +short TXT _dmarc.arcaevo.com
```

If `dig +short TXT arcaevo.com | grep spf1` ever returns **more than one line**, stop and merge them — that is the single most common way this setup breaks.
