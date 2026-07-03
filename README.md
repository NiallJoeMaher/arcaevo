# Arcaevo

Health membership for Ireland: members connect their Apple Watch, order a blood test, and the app fuses the two into plain-language insights read off their own baseline.

> Not a medical device. Not a diagnosis. Consult a doctor.

## Repo layout

| Path | What |
|---|---|
| `apps/web` | Next.js 15 (App Router, TS, Tailwind v4) — marketing site, `/admin` ops dashboard, and `/api/v1` REST API consumed by the iOS app |
| `apps/ios` | SwiftUI iOS app + watchOS companion (XcodeGen project) |
| `infra/cdk` | AWS CDK v2 (TypeScript, eu-west-1) |
| `design_handoff/` | Versioned copy of the design package (open `designs/*.dc.html` in a browser) |
| `docs/` | [BUILD_STATE.md](docs/BUILD_STATE.md) (build progress), [MOCKED_APIS.md](docs/MOCKED_APIS.md) (every mocked integration and how to productionise it) |

## Quick start

```bash
# Full stack (web :3000 + Mongo host :27019 + mongo-express :8083 + MailHog)
docker compose up --build

# Or web dev server against dockerised Mongo (exposed on host port 27019)
docker compose up -d mongo mailhog
cd apps/web && npm install
MONGODB_URI=mongodb://localhost:27019/arcaevo npm run dev   # http://localhost:3000

# Seed demo data (WIPES the db first — deterministic fixture set)
cd apps/web && MONGODB_URI=mongodb://localhost:27019/arcaevo npm run seed

# Personal account you can actually sign in with (safe: touches ONLY that email;
# rerun it after every `npm run seed`, which wipes the db)
cd apps/web && MONGODB_URI=mongodb://localhost:27019/arcaevo \
  EMAIL=you@example.com NAME="Your Name" TIER=performance npm run seed:user
# → sign in at /signin with your email / "arcaevo-demo-2026" (override via PASSWORD=…)
```

**Emails**: every transactional email lands in the Mongo `outbox` collection, and — when
`EMAIL_PROVIDER=mailhog` (the compose default) — is also delivered via SMTP to MailHog:
browse them at **http://localhost:8026** (SMTP on host :1026). See `docs/MOCKED_APIS.md` §7.

### iOS / watchOS

```bash
brew install xcodegen
cd apps/ios && xcodegen generate
open Arcaevo.xcodeproj
```

### Infra

```bash
cd infra/cdk && npm install && npx cdk synth
```

## Environment

Copy `apps/web/.env.example` to `apps/web/.env.local`. Key vars: `MONGODB_URI`, `ADMIN_PASSWORD`, `NEXT_PUBLIC_SITE_URL`.

## CI & deploy

GitHub Actions (`.github/workflows/ci.yml`) runs web typecheck/unit/build/e2e (with a Mongo service), `cdk synth`, `xcodebuild` for both Apple targets on a macOS runner, and the Docker image build. Web deploys to Vercel (region `dub1`, `apps/web` as project root — `apps/web/vercel.json`).

## Integrations status

**Everything third-party is mocked** (LetsGetChecked, Stripe, email, auth IdP, clinician review). See [docs/MOCKED_APIS.md](docs/MOCKED_APIS.md) before wiring anything real.
