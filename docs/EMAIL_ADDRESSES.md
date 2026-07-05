# Email addresses — arcaevo.com scheme & setup

> **DRAFT — operational setup guide.** Captures the `arcaevo.com` email address scheme, the critical send-vs-receive split, and the DNS records to publish. Pairs with [`../infra/cdk/SES_SETUP.md`](../infra/cdk/SES_SETUP.md) (the CDK walkthrough that generates the real DKIM/SPF values) and the privacy docs under `legal/` that reference `privacy@arcaevo.com` ([`RECORDS_OF_PROCESSING.md`](./legal/RECORDS_OF_PROCESSING.md), [`BREACH_RESPONSE.md`](./legal/BREACH_RESPONSE.md), [`DPO_NOT_REQUIRED_MEMO.md`](./legal/DPO_NOT_REQUIRED_MEMO.md)).

The **canonical domain is `arcaevo.com`** — the app/marketing host and the SES-verified sending domain (`DEFAULT_SENDING_DOMAIN = "arcaevo.com"` in `infra/cdk/lib/arcaevo-email-stack.ts`). The public copy's older `@arcaevo.health` placeholders have been reconciled to `@arcaevo.com`.

---

## 1. The address list

| Address | Purpose | Direction | Notes |
|---|---|---|---|
| **`no-reply@arcaevo.com`** | Transactional **sending** — the `EMAIL_FROM` for receipts, kit reminders, results-ready, sign-in codes | **Send only** (SES) | Send-only by design; replies should be discarded or auto-answered. The IAM policy allows any `*@arcaevo.com` From, so `no-reply@` / `hello@` both work. Today the app's `EMAIL_FROM` is `Arcaevo <hello@arcaevo.com>` (`apps/web/src/lib/emails.ts`); prefer `no-reply@` for machine sends and keep `hello@` for human-answerable mail. |
| **`privacy@arcaevo.com`** | **Data-protection / DSR contact** — access, export, erasure, objection, consent questions; the address wired across the privacy policy, `/consent`, `/account/privacy`, `/contact` and every legal doc | **Receive** (must be monitored) | Role-based, durable, **actively monitored** — DSR deadline is **~1 month** (GDPR Art. 12(3)); a breach-notification clock (Art. 33/34) can also land here. Do **not** label it "DPO" (see §5). |
| **`support@arcaevo.com`** *(or keep `hello@`)* | User support — account help, orders, app questions | **Receive** | The contact page currently lists `hello@arcaevo.com` for general & support; pick one of `support@` / `hello@` as the support alias and route both to the same mailbox via catch-all. |
| **`hello@arcaevo.com`** | General enquiries / catch-all landing | **Send + receive** | Human-answerable; also a valid `From` for warmer transactional mail. |
| **`security@arcaevo.com`** | Vulnerability reports; the address published in `/.well-known/security.txt` | **Receive** | Monitored; short SLA expected by reporters. |
| **`dmarc@arcaevo.com`** | **DMARC aggregate (RUA) reports** | **Receive** (machine) | Referenced in the `_dmarc` TXT `rua=`. Can be a mailbox or forwarded to a DMARC-analytics service. |
| **`dpo@arcaevo.com`** | **RESERVED** for a future Data Protection Officer | — | **DO NOT advertise or use until a DPO is actually appointed.** Provisioning the address is fine; publishing it is not (see §5). |

Optional extras used elsewhere in copy (reconcile to `.com` if kept): `clinical@arcaevo.com`, `press@arcaevo.com` (currently `@arcaevo.health` on the contact page — out of scope of the privacy reconciliation, tidy up when convenient).

---

## 2. The critical distinction — SES is SEND-ONLY

**AWS SES, as configured here, only *sends* mail.** It gives us DKIM-signed outbound delivery for transactional email; it does **not** provide inboxes. Mail sent *to* `privacy@arcaevo.com`, `support@arcaevo.com`, `security@arcaevo.com`, etc. will **not be received** by SES.

To **receive** at those addresses you need a **mailbox provider** with a **catch-all** (or explicit aliases) on `arcaevo.com`:

| Provider | EU-hosted? | Notes for the GDPR posture |
|---|---|---|
| **Migadu** | **Yes (EU — France/Switzerland region)** | Cheap, catch-all/alias-friendly, no per-mailbox pricing — good fit for a small role-based scheme. **Recommended** for the EU-hosting posture. |
| **Fastmail** | Partly (US-headquartered, servers US) | Excellent catch-all/alias support; but US-parented — weaker on the EU-data-residency signal. |
| **Zoho Mail** | Yes (EU data centre option) | Free/low tiers; select the **EU DC** at signup. |
| **Google Workspace** | Data can be pinned to the EU, but US-parented | Familiar, but the heaviest option and US-parented; pick only if already standardised on it. |

**Recommendation:** use an **EU-hosted** provider (Migadu or Zoho-EU) with a **catch-all** on `arcaevo.com` so every role address resolves to a monitored inbox, and set **`privacy@` (and `security@`) as actively monitored** — not a black hole. Keep **SES purely for outbound**; the receiving provider's MX records live on the **apex** `arcaevo.com`, while SES's MAIL FROM MX lives only on the **`mail.arcaevo.com`** subdomain (see §3), so the two do not collide.

> **Monitoring is a compliance control, not a nicety.** `privacy@` maps to statutory deadlines (DSR ~1 month; breach notification 72 hours to the DPC). An unmonitored privacy mailbox is a finding waiting to happen — see [`legal/DPO_NOT_REQUIRED_MEMO.md`](./legal/DPO_NOT_REQUIRED_MEMO.md) §5.

---

## 3. DNS records to add to the `arcaevo.com` zone

These are the records the SES stack (`ArcaevoEmailStack`) expects, **plus** the receiving-provider MX. Exact DKIM token values come from the CDK outputs — leave as placeholders here and paste the real values from `npx cdk deploy` (see [`../infra/cdk/SES_SETUP.md`](../infra/cdk/SES_SETUP.md) §2).

**a) Easy DKIM — 3 CNAMEs (required; SES verifies via these).** From the `DkimCname{1,2,3}Name` / `DkimCname{1,2,3}Value` CDK outputs:

```
<DkimCname1Name>   CNAME   <DkimCname1Value>
<DkimCname2Name>   CNAME   <DkimCname2Value>
<DkimCname3Name>   CNAME   <DkimCname3Value>
```

**b) Custom MAIL FROM (`mail.arcaevo.com`) — MX + SPF (recommended; aligns the Return-Path).** On the **subdomain only**:

```
mail.arcaevo.com   MX    10 feedback-smtp.eu-west-1.amazonses.com
mail.arcaevo.com   TXT   "v=spf1 include:amazonses.com ~all"
```

**c) Apex SPF + DMARC (manual; SES can't create these).** On the **apex** `arcaevo.com`:

```
arcaevo.com          TXT   "v=spf1 include:amazonses.com ~all"
_dmarc.arcaevo.com   TXT   "v=DMARC1; p=none; rua=mailto:dmarc@arcaevo.com; fo=1"
```

Start DMARC at `p=none` (monitor via `dmarc@`), then tighten to `quarantine` → `reject` once DKIM+SPF are confirmed aligned in the aggregate reports.

> If you add a `include:` in the apex SPF for the **receiving provider** (some providers want their own SPF include for any mail they relay), merge it into the **single** apex SPF TXT — do not publish two SPF records.

**d) Receiving MX (from your chosen mailbox provider).** On the **apex** `arcaevo.com`, e.g. (Migadu shown — use your provider's actual hostnames/priorities):

```
arcaevo.com   MX   10 aspmx1.migadu.com
arcaevo.com   MX   20 aspmx2.migadu.com
```

This is what actually delivers mail to `privacy@` / `support@` / `security@` / `dmarc@` inboxes. **SES does not do this.**

---

## 4. Wiring it into the app

The web app already sends via SES over SMTP (`apps/web/src/lib/vendors/email.smtp.ts`); nothing changes structurally. Confirm the env `From` is a verified `arcaevo.com` address:

```bash
EMAIL_FROM=Arcaevo <no-reply@arcaevo.com>   # or hello@arcaevo.com for human-answerable sends
```

(The full SMTP env — `SMTP_HOST/PORT/USER/PASS/SECURE` — is derived in `infra/cdk/SES_SETUP.md` §5–6.)

---

## 5. Naming caution — no `dpo@` advertised yet

`dpo@arcaevo.com` is **reserved and unadvertised**. Publicly designating a "DPO" (including a `dpo@` address in the privacy policy or contact page) can be read as a **voluntary DPO appointment** under GDPR Art. 37(7)/WP243, which triggers the full Art. 37–39 regime we have deliberately **not** taken on at trial scale (see [`legal/DPO_NOT_REQUIRED_MEMO.md`](./legal/DPO_NOT_REQUIRED_MEMO.md)). Until a DPO is actually appointed:

- **Use `privacy@arcaevo.com`** and the labels "privacy contact" / "privacy team" / "data-protection enquiries" everywhere user-facing.
- **Do not** print `dpo@arcaevo.com` in copy, `security.txt`, legal docs, or DNS-visible places that imply a DPO exists.
- Flip to advertising `dpo@` **only** when the DPO appointment is made (a §7 review trigger in the memo).
