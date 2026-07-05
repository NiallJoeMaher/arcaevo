# Arcaevo — AWS footprint (CDK v2, TypeScript)

This stack is intentionally small, because most of Arcaevo does **not** run on AWS:

- **Web app (Next.js)** — hosted on **Vercel**. Not provisioned here.
- **MongoDB** — **MongoDB Atlas** (eu-west-1), external SaaS. Not provisioned
  here; the connection string is stored in the Secrets Manager placeholder
  below and injected into Vercel/env as `MONGODB_URI`.
- **AWS (this stack, eu-west-1 only — EU data residency)**:
  - `MemberExportsBucket` — private, SSL-enforced S3 bucket for GDPR
    self-serve member data exports (objects expire after 30 days).
  - Secrets Manager **placeholders** (create now, set real values out-of-band):
    - `arcaevo/mongodb-uri` — Atlas connection string
    - `arcaevo/stripe` — Stripe secret key + webhook signing secret (mocked today)
    - `arcaevo/letsgetchecked` — LGC API credentials (mocked today)

See `docs/MOCKED_APIS.md` at the repo root: Stripe and LetsGetChecked are mock
adapters until real agreements/keys exist — these secrets are their future homes.

- **`ArcaevoEmailStack` (SES transactional email, eu-west-1)** — a separate
  stack: an SES domain identity for **arcaevo.com** (Easy DKIM + custom MAIL
  FROM), a least-privilege IAM SMTP sender (`ses:SendEmail`/`ses:SendRawEmail`
  only, scoped to the identity + a `ses:FromAddress` condition), and its access
  key, with the IAM secret parked in Secrets Manager (`arcaevo/ses-smtp`) — the
  SMTP password is **derived** from it, never output in plaintext. Feeds the
  existing nodemailer adapter (`apps/web/.../email.smtp.ts`). Full walkthrough
  — DNS records, sandbox → production, password derivation, env vars — in
  **[`SES_SETUP.md`](./SES_SETUP.md)**. The sending domain is a one-line
  constant / `-c sendingDomain=` context param (default `arcaevo.com`).

## Usage

```bash
cd infra/cdk
npm install
npx cdk synth          # emit CloudFormation (no AWS credentials needed)
npx cdk deploy         # requires bootstrapped account, eu-west-1
```

The stack pins `region: eu-west-1`; the account comes from the deploying
credentials (`CDK_DEFAULT_ACCOUNT`).

## Layout

- `bin/arcaevo.ts` — CDK app entrypoint (both stacks)
- `lib/arcaevo-stack.ts` — the core `ArcaevoStack`
- `lib/arcaevo-email-stack.ts` — the `ArcaevoEmailStack` (SES + SMTP IAM)
- `scripts/ses-smtp-password.mjs` — IAM secret → SES SMTP password derivation
- `SES_SETUP.md` — SES deploy/DNS/env walkthrough
- Standalone npm project (no workspaces) — matches the repo's ground rules.
