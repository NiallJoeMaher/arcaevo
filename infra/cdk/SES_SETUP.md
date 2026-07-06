# SES transactional email — setup walkthrough

`ArcaevoEmailStack` (in `lib/arcaevo-email-stack.ts`) provisions everything AWS
needs to send Arcaevo's transactional email (receipts, kit reminders,
results-ready, sign-in codes) over SES's SMTP endpoint, which the existing
nodemailer adapter (`apps/web/src/lib/vendors/email.smtp.ts`) already speaks.
Region is **eu-west-1** — EU data residency, which keeps the GDPR posture clean
(SES processes the mail inside the EU; sign a DPA / note the AWS EU terms before
real users, same bar as any ESP — see `docs/MOCKED_APIS.md §7`).

Nothing in `apps/web` changes: this stack only produces the credentials + DNS
records that adapter consumes.

## Sending domain

The domain is a **single constant** at the top of `lib/arcaevo-email-stack.ts`:

```ts
const DEFAULT_SENDING_DOMAIN = "arcaevo.com";
```

It defaults to **arcaevo.com** (not finally confirmed vs `arcaevo.health`).
Switch it **without editing code** via CDK context:

```bash
npx cdk synth  -c sendingDomain=arcaevo.health
npx cdk deploy -c sendingDomain=arcaevo.health
```

…or set `"sendingDomain": "arcaevo.health"` under `"context"` in `cdk.json`.

## What the stack creates

| Resource | Purpose |
| --- | --- |
| `AWS::SES::EmailIdentity` | Domain identity for `arcaevo.com`, **Easy DKIM** on, custom MAIL FROM `mail.arcaevo.com`. |
| `AWS::IAM::User` (`arcaevo-ses-smtp`) | Least-privilege app identity (name kept for continuity — renaming would replace the user and rotate its keys). Two grants: (1) `ses:SendEmail` + `ses:SendRawEmail`, scoped to this identity, with a `ses:FromAddress` `*@arcaevo.com` condition; (2) `bedrock:InvokeModel` on the Claude Haiku EU cross-region inference profile **and** its underlying foundation-model ARNs (profile invocations authorize against both) — powers AI narration via the same `ARCAEVO_AWS_*` keys (live-verified 2026-07-06). |
| `AWS::IAM::AccessKey` | The programmatic credential. Its **access key id = the SES-SMTP username**. |
| `AWS::SecretsManager::Secret` (`arcaevo/ses-smtp`) | Holds the IAM **secret access key** (never emitted in a plaintext output). This is the input to the SMTP-password derivation — it is **not** the SMTP password itself. |

## Step-by-step

### 1. Deploy the stack

```bash
cd infra/cdk
npm install
npx cdk deploy ArcaevoEmailStack          # eu-west-1, bootstrapped account
```

Note the outputs: `SmtpUsername`, `SmtpSecretArn`, `SmtpEndpoint`,
`MailFromDomain`, and six `DkimCname*` values.

### 2. Add the DNS records to the arcaevo.com zone

**a) Easy DKIM — 3 CNAMEs (required; SES verifies via these).** From the
`DkimCname{1,2,3}Name` / `DkimCname{1,2,3}Value` outputs:

```
<DkimCname1Name>   CNAME   <DkimCname1Value>
<DkimCname2Name>   CNAME   <DkimCname2Value>
<DkimCname3Name>   CNAME   <DkimCname3Value>
```

**b) Custom MAIL FROM (`mail.arcaevo.com`) — MX + SPF (recommended).** Aligns
the Return-Path to our own domain:

```
mail.arcaevo.com   MX    10 feedback-smtp.eu-west-1.amazonses.com
mail.arcaevo.com   TXT   "v=spf1 include:amazonses.com ~all"
```

(If you skip these, the stack sets `BehaviorOnMxFailure: USE_DEFAULT_VALUE`, so
sending still works using the amazonses.com Return-Path.)

**c) Domain SPF + DMARC (manual, recommended).** SES can't create these for you:

```
arcaevo.com          TXT   "v=spf1 include:amazonses.com ~all"
_dmarc.arcaevo.com   TXT   "v=DMARC1; p=none; rua=mailto:dmarc@arcaevo.com; fo=1"
```

Start DMARC at `p=none` (monitor), then tighten to `quarantine` / `reject`
once DKIM+SPF are confirmed aligned in the aggregate reports.

### 3. Wait for verification

SES flips the identity to **Verified** once the DKIM CNAMEs resolve (minutes to
~72h depending on DNS). Check in the SES console → Identities, or:

```bash
aws ses get-identity-verification-attributes --identities arcaevo.com --region eu-west-1
aws ses get-identity-dkim-attributes        --identities arcaevo.com --region eu-west-1
```

### 4. Leave the SES sandbox (production access)

New SES accounts start in the **sandbox**: you can only send **to** verified
addresses, with a low quota. To send to arbitrary recipients you must request
**production access**:

- Console: **SES → Account dashboard → Request production access**, or
- **SES → Account dashboard → "Get set up" / "Request production access"** button.

Provide the use case (transactional wellness-membership email: receipts, kit
reminders, results-ready, sign-in codes), expected volume, and your
bounce/complaint handling. Approval is usually < 24h. Until then, add each test
recipient as a verified identity in the console.

### 5. Retrieve the IAM secret and derive the SMTP password

The SMTP **username** is the IAM access key id (the `SmtpUsername` output). The
SMTP **password** is **not** the raw IAM secret — it's a SigV4 HMAC derivation
of it. Fetch the secret, then derive:

```bash
# Fetch the IAM secret access key that the stack stored:
SECRET=$(aws secretsmanager get-secret-value \
  --secret-id arcaevo/ses-smtp --region eu-west-1 \
  --query SecretString --output text)

# Derive the SES SMTP password (region defaults to eu-west-1):
node scripts/ses-smtp-password.mjs "$SECRET" eu-west-1
```

The printed value is your `SMTP_PASS`. (The script implements AWS's documented
"convert IAM secret → SMTP password" algorithm: HMAC-SHA256 chain keyed by the
region + `SendRawEmail`, version byte `0x04`, base64.)

### 6. Set the web env vars

Point the nodemailer adapter at SES (Vercel project env, or `.env`):

```bash
EMAIL_PROVIDER=smtp
SMTP_HOST=email-smtp.eu-west-1.amazonaws.com
SMTP_PORT=587                     # STARTTLS. Use 465 for TLS-on-connect.
SMTP_USER=<SmtpUsername output>   # the IAM access key id
SMTP_PASS=<derived password>      # from step 5 — never the raw IAM secret
SMTP_SECURE=false                 # false for :587 (STARTTLS); true for :465
EMAIL_FROM=Arcaevo <hello@arcaevo.com>
```

Notes:
- `:587` + `SMTP_SECURE=false` (STARTTLS) is the default choice; for `:465` set
  `SMTP_SECURE=true`.
- `EMAIL_FROM` must be an address **at the verified domain** — the IAM policy's
  `ses:FromAddress` condition rejects anything not `*@arcaevo.com`
  (e.g. `no-reply@arcaevo.com` also works).
- The Mongo outbox write still happens regardless — SES is the additional,
  fire-and-forget real-delivery path (see `docs/MOCKED_APIS.md §7`).

## Rotating the credential

Deploying a new `AWS::IAM::AccessKey` mints a fresh key and updates the
`arcaevo/ses-smtp` secret. Re-run step 5 to derive the new `SMTP_PASS`, update
the web env, then deactivate the old key in IAM.
