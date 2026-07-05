import { defineConfig, devices } from "@playwright/test";

/**
 * Arcaevo e2e suite (Phase 9).
 *
 * Runs against a PRODUCTION build (`next build && next start`) with the local
 * docker-compose Mongo (host port 27019 — see docker-compose.yml). The DB is
 * re-seeded deterministically before every run (e2e/global-setup.ts), so all
 * assertions can rely on the seed script's fixed data.
 */

const MONGODB_URI =
  process.env.MONGODB_URI ?? "mongodb://localhost:27019/arcaevo";

export const E2E_ENV = {
  MONGODB_URI,
  ADMIN_PASSWORD: "change-me-local",
  SESSION_SECRET: "e2e-secret",
  NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
  // The suite runs a PRODUCTION build (`next start` ⇒ NODE_ENV=production), but
  // it is a local dev environment: opt back into the demo bearer token and the
  // open (secretless) mock webhooks that the tests + client-fired checkout rely
  // on. Real production sets neither of these and stays locked down.
  ALLOW_DEMO_TOKEN: "true",
  ALLOW_OPEN_WEBHOOKS: "true",
  // Pin the deterministic MOCK payments vendor for the suite even though a dev's
  // .env.local may carry a real sk_test key (which `next start` would otherwise
  // load ⇒ live checkout). The specs rely on the mock's fake URL + the
  // client-fired checkout.session.completed webhook. Real prod leaves this unset.
  STRIPE_FORCE_MOCK: "true",
  // Keep the MOCK AI bloodwork extraction ON for the prod-build e2e (the
  // upload/confirm specs + the "41 or 47?" demo drive it). Real prod leaves
  // this unset, so the photo/PDF path returns a manual-entry state instead.
  ALLOW_MOCK_EXTRACTION: "true",
  // Disable IP rate-limiting for the suite: it fires many scripted sign-in /
  // verify attempts from one host and would otherwise trip the limiter. Real
  // production leaves this unset (limiter ON).
  RATE_LIMIT_DISABLED: "true",
  // Blood tiers (Essential/Performance + kit/nurse/venous orders + gifting) are
  // fail-safe OFF unless BLOOD_TIERS_ENABLED=true. The suite exercises the full
  // paid flow (checkout, orders, gift), so turn them ON here — both the server
  // gate and the NEXT_PUBLIC_ mirror (inlined at `next build` time). Real prod
  // leaves both unset until the lab partner + clinician are live.
  BLOOD_TIERS_ENABLED: "true",
  NEXT_PUBLIC_BLOOD_TIERS_ENABLED: "true",
  // Emails always land in the Mongo outbox. Locally we ALSO deliver them via
  // SMTP to the compose mailhog container (host :1026, UI :8026) so
  // email.spec.ts can assert real delivery; CI has no mailhog, so it stays
  // outbox-only (and email.spec.ts skips its MailHog assertions there).
  // Pass-through lets either be overridden per run.
  EMAIL_PROVIDER: process.env.EMAIL_PROVIDER ?? (process.env.CI ? "" : "mailhog"),
  SMTP_HOST: process.env.SMTP_HOST ?? "localhost",
  SMTP_PORT: process.env.SMTP_PORT ?? "1026",
};

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  forbidOnly: !!process.env.CI,
  // Serial execution: the suite shares ONE seeded Mongo, and several specs
  // mutate it (consent withdrawal, session revoke, checkout, research toggle).
  // Parallel workers would race on that shared state, causing intermittent
  // cross-test failures. One worker + no parallelism keeps runs deterministic.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // output:"standalone" (Dockerfile) — this Next version still serves via
    // `next start` (it logs a warning only), which keeps e2e on the prod build.
    command: "npm run build && npm run start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    env: E2E_ENV,
  },
});
