# Arcaevo — Assumptions & Production Readiness

This document lists the assumptions made while building Arcaevo autonomously, and what must be true/done before a real production launch. It is the companion to `MOCKED_APIS.md` (which lists mocked integrations) and `BUILD_STATE.md` (build progress).

Last updated: 2026-07-03.

## Product & business assumptions

- **Tiers & pricing taken verbatim from the design handoffs** — Fusion €119/yr, Essential €329/yr, Performance €399/yr; quarterly upgrade +€130/yr; add-ons €99/€69/€199; annual billing only at launch. These are treated as contractual; no invented copy.
- **Dublin-first launch.** Eircode allowlist is the 31 routing keys given in the handoff (`D01–D18, D20, D22, D24, D6W, A94, A96, K32, K34, K36, K45, K56, K67, K78`), stored as editable config (`eligibilityConfig` collection), not code.
- **Fusion sold worldwide** (no shipping, no eligibility gate); Essential/Performance gated to Dublin at checkout only.
- **Wellness positioning, never diagnosis.** AI narrates; deterministic RCV rules against the member's own baseline decide. Disclaimers preserved everywhere.
- **v1 wearables = Apple Watch + Apple Health only.** WHOOP/Oura/Garmin appear only as "on the roadmap".

## Architecture assumptions

- **Monorepo, no npm workspaces** — `apps/web` (Next.js), `apps/ios` (SwiftUI iOS + watchOS), `infra/cdk` are each self-contained.
- **Hosting: Vercel (EU, dub1) primary for web**, per user decision. Docker/compose + CDK kept working as the AWS escape hatch; no duplicate web hosting infra provisioned.
- **MongoDB** via the official driver (no Mongoose). Local = docker-compose Mongo; prod target = Atlas (eu-west-1) via `MONGODB_URI`. Atlas itself is external — CDK documents, does not create it.
- **Local host ports are remapped** because other projects on the build machine hold the defaults: Mongo `27019`, mongo-express `8083`, MailHog SMTP `1026` / UI `8026`. Inside the compose network, standard ports are used. Production is unaffected.

## Security assumptions (post-hardening 2026-07-03)

After an adversarial security audit, these are now enforced (see the audit-fix commits):

- **Secrets fail closed in production.** `SESSION_SECRET` and `ADMIN_PASSWORD` must be set in production or the app refuses to boot — no committed fallback secret is ever used when `NODE_ENV=production`.
- **GDPR Art. 9 consent is enforced server-side.** Every health-data read/write endpoint requires a current `health_processing` grant; withdrawal revokes sessions immediately.
- **Account deletion is real** — flags closure, revokes sessions, sends confirmation email, and queues a 30-day erasure job (`erasureJobs` collection + `npm run erase:run`). A scheduled runner must invoke this in production (assumption: ops wires a daily cron / Vercel Cron / EventBridge rule).
- **Demo bearer token and dev secrets are dev/Debug-only.** The iOS demo mode and the `demo-member-token` bypass are compiled/permitted only in non-production; production requires real magic-link auth.
- **Security headers** (CSP, HSTS, X-Frame-Options DENY, nosniff, referrer-policy) are set globally; token-bearing pages (`/verify`, `/s/[token]`) use a stricter referrer policy so tokens don't leak via `Referer`.
- **Webhooks require a shared secret in production** (mock signature verification is dev-only). Real Stripe/LGC signature verification replaces this before launch.

### Still assumed / must be done before real launch

- Real IdP-grade rate limiting (IP + global), passkeys/TOTP (designed as "coming"), Sign in with Apple later.
- Real vendor contracts + signature verification: **LetsGetChecked** (our schema is a guess — flagged in MOCKED_APIS.md §1), **Stripe** (EU entity, Products/Prices, Stripe Tax for IE VAT), the **Dublin phlebotomy** provider (no adapter yet), an **EU ESP** for real email delivery (currently outbox + MailHog).
- Clinician identity on GP shares is a **mock persona** ("Dr. S. Nolan, IMC 412887") — replace with the real reviewing clinician from the medical-ops partner.
- Critical-value SOP (clinician phones first) is modelled in data/UI but needs the real clinical operations process behind it.
- Associated Domains entitlement + AASA file for iOS universal links (magic links) — entitlement is stubbed/commented pending a real team ID and domain.
- A real production `MONGODB_URI` (Atlas), TLS, backups, and PITR; the CDK stack covers only the AWS-side footprint (exports bucket + Secrets Manager placeholders).

## Data & seeding assumptions

- **`npm run seed`** wipes the DB and loads a deterministic fixture set (anchor 2026-07-01): 25+ members, biomarker rules, orders across every state, readings with a full "did it work?" story, 90-day wearable series, waitlist/consents/gift/share fixtures.
- **`npm run seed:user`** creates a single sign-in-able account touching only that email (idempotent, non-destructive) — used for the user's own e2e testing. Default password `arcaevo-demo-2026`.
- Demo/e2e identities: `demo@arcaevo.test` / `demo-password-123` (free account), Aoife Byrne via `demo-member-token` (essential member with the full story). These are **dev/test-only** and inert in production.

## Testing assumptions

- **Unit (vitest)** covers pure logic (RCV, eligibility, magic-link/cooloff, dunning, email templates, id-uniqueness, consent guard). **e2e (Playwright)** covers the full web journeys against a real seeded Mongo + standalone build.
- **CI (GitHub Actions)** runs web typecheck/unit/build/e2e (Mongo service), `cdk synth`, `xcodebuild` for both Apple targets on a macOS runner, and the Docker image build. CI stays outbox-only for email (no MailHog); local dev additionally delivers to MailHog.
- **iOS/watch** verified by `xcodebuild` (Debug and Release compile) + running in the simulator; no XCTest UI suite yet (assumption: added post-launch).

## Known deliberate deviations from the designs

- Caption/footer gray `#7C887F` darkened to `#5F6A62` (and related) on web to pass WCAG 4.5:1 / Lighthouse ≥95 — intentional, do not revert.
- Prototype "rig" chrome (e.g. "Restart the prototype") is replaced with real app actions (Sign out, computed dates).
- Watch complication (WidgetKit accessory) is deferred; the in-app face-entry screen carries the content meanwhile.
