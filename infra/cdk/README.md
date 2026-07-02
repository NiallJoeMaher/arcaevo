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

- `bin/arcaevo.ts` — CDK app entrypoint
- `lib/arcaevo-stack.ts` — the single `ArcaevoStack`
- Standalone npm project (no workspaces) — matches the repo's ground rules.
