# Observability

Web (`apps/web`) observability plan and current state. Two independent
channels, both **dep-free today** and both **privacy-scrubbed by design**:

1. **Product analytics** — PostHog (EU host), funnel + lifecycle events.
2. **Error visibility** — structured `logError()` today; **Sentry** when the
   dependency ban lifts.

The hard rule for BOTH: **never send an Art.9 health value** (a biomarker
reading, a verdict, a score) **or raw PII** (email, name, Eircode). Ids, counts,
enums and prices only. A member id is fine; a biomarker value is not.

---

## 1. PostHog events (live now, no-op until keyed)

`src/lib/analytics.ts` exposes `capture(event, properties, distinctId)`. It is a
**no-op unless `NEXT_PUBLIC_POSTHOG_KEY` is set**, and always posts to the
hardcoded EU host (`https://eu.i.posthog.com`) — never a US host. So the wiring
is safe to ship and lights up the moment the key is added.

Event names live in `AnalyticsEvent` (same file), ordered as the member journey
so a PostHog funnel reads straight down the list. Renaming a value breaks
historical funnels — treat them as an API (locked by a unit test in
`src/lib/__tests__/observability.test.ts`).

| Event (`AnalyticsEvent`)      | value                          | Emitted from                                   | distinctId        | properties (PII-free)                     |
| ----------------------------- | ------------------------------ | ---------------------------------------------- | ----------------- | ----------------------------------------- |
| `SignupStarted`               | `signup_started`               | `POST /api/v1/checkout` (guest, before create) | anonymous         | `{ source }`                              |
| `SignupCompleted`             | `signup_completed`             | `POST /api/v1/checkout` (guest created)        | member id         | `{ source }`                              |
| `MagicLinkVerified`           | `magic_link_verified`          | `POST /api/v1/auth/magic-link/verify`          | member id         | `{ via: link\|code }`                     |
| `ConsentGranted`              | `consent_granted`              | `POST /api/v1/consents` (health_processing on) | member id         | `{ surface, version, grants }`            |
| `CheckoutStarted`             | `checkout_started`             | `POST /api/v1/checkout` (pending membership)   | member id         | `{ tier, cadenceUpgrade, priceEur }`      |
| `CheckoutCompleted`           | `checkout_completed`           | `POST /api/v1/webhooks/stripe` (both paths)    | member id         | `{ tier, path: mock\|stripe }`            |
| `WaitlistJoined`              | `waitlist_joined`              | `POST /api/v1/waitlist` (new join only)        | waitlist id       | `{ county, routingKey, position }`        |
| `GiftRedeemed`                | `gift_redeemed`                | `POST /api/v1/gift/redeem`                      | member id         | `{ tier }`                                |
| `AccountDeleted`              | `account_deleted`              | `POST /api/v1/account/delete`                  | member id         | `{ sessionsRevoked, reScheduled }`        |
| `WebhookVerificationFailed`   | `webhook_verification_failed`  | `POST /api/v1/webhooks/stripe` (bad signature) | `"system"`        | `{ source: stripe }`                      |
| `ErasureRunCompleted`         | `erasure_run_completed`        | `GET\|POST /api/v1/cron/run-erasure`           | `"system"`        | `{ executed, pending }`                   |

Notes:
- `county` / `routingKey` are **coarse geography** (a routing key is a 3-char
  area shared by thousands), not identifying — same fields already used in the
  E10/E11 emails. Never attach a full Eircode.
- `priceEur` is a contractual price, not health data — safe to send.

## 2. Structured error logging (live now)

`src/lib/log.ts` exposes `logError(context, err, meta?)` — writes **one line of
JSON** (`{ level, at, context, error, message, ...meta }`) to `console.error`,
so failures surface in Vercel logs instead of being swallowed. `context` is a
short stable string; `meta` is ids/counts/enums only.

Wired into the previously-silent catch blocks on the critical paths:

| Path                     | context                          | Behaviour                                              |
| ------------------------ | -------------------------------- | ----------------------------------------------------- |
| Stripe webhook           | `webhook.stripe.invalid_signature` | + `WebhookVerificationFailed` event; 400 (Stripe retries) |
| Checkout (guest email)   | `checkout.guest_verify_email`    | Log + **continue** — a dead mailer no longer fails checkout |
| Erasure cron             | `cron.run_erasure.failed`        | Log + 500 so the cron is marked failed and retried    |
| Email (SMTP delivery)    | `email.smtp.delivery_failed`     | Log (outbox id + template only); fire-and-forget      |

## 3. Sentry (planned — DO NOT import until installed)

`@sentry/nextjs` is on the **dep ban** (see `docs/BUILD_STATE.md` → Wanted
deps). Importing it now breaks the build, so there is deliberately **no Sentry
import or config in the tree**. When the ban lifts:

1. `npm i @sentry/nextjs` in `apps/web`.
2. Add config files: `sentry.server.config.ts`, `sentry.edge.config.ts`, and a
   client `Sentry.init` in `instrumentation-client.ts`; register
   `instrumentation.ts` (`register()` → import the server/edge configs). Wrap
   `next.config.ts` with `withSentryConfig` for source maps.
3. Env: `SENTRY_DSN` (server/edge) + `NEXT_PUBLIC_SENTRY_DSN` (client). Use an
   **EU Sentry project** to match the EU-residency posture. DSN goes in Vercel
   env, never committed.
4. Route errors through it: have `src/lib/log.ts` `logError()` also call
   `Sentry.captureException(err, { tags: { context }, extra: meta })` — one
   call site, so every existing `logError` becomes a Sentry issue for free.
5. **Privacy scrubbing (required)** — set `sendDefaultPii: false` and a
   `beforeSend`/`beforeSendTransaction` that drops any health value or PII:
   scrub request bodies/headers (cookies, `authorization`, email, Eircode) and
   never let a biomarker reading/verdict reach Sentry. This mirrors the same
   ids/counts/enums rule the analytics + `logError` layers already follow, and
   the wellness-not-diagnosis posture in
   `docs/legal/MEDICAL_DEVICE_POSITIONING.md`.

Until then, `logError` + Vercel logs are the error channel and PostHog is the
funnel channel — both already PII/health-free.
