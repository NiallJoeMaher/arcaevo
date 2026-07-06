import { defineConfig, devices } from "@playwright/test";
import { E2E_ENV } from "./playwright.config";

/**
 * Launch-gate e2e — the ACTUAL production ship state: BLOOD_TIERS_ENABLED
 * unset, so Essential/Performance are not on sale and /pricing shows the
 * early-access gate posting to the real waitlist.
 *
 * OPT-IN (`npm run e2e:launch`), deliberately not part of the default suite:
 * it needs its own production build (the flag is read server-side per request
 * AND the NEXT_PUBLIC_ mirror inlines at `next build`), so folding it into
 * `npm run e2e` would double the build time of every run.
 *
 * Everything else mirrors playwright.config.ts: prod build via `next build &&
 * next start`, compose Mongo on :27019, deterministic reseed (shared
 * e2e/global-setup.ts), one worker.
 */

const LAUNCH_ENV = {
  ...E2E_ENV,
  // Pinned to "" rather than deleted: an env var that EXISTS wins over a
  // developer's .env.local at `next start`/`next build` time (same rationale
  // as STRIPE_FORCE_MOCK in the main config), and "" !== "true" keeps the
  // gate fail-safe CLOSED — exactly how real production ships.
  BLOOD_TIERS_ENABLED: "",
  NEXT_PUBLIC_BLOOD_TIERS_ENABLED: "",
};

export default defineConfig({
  testDir: "./e2e-launch",
  globalSetup: "./e2e/global-setup.ts",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  forbidOnly: !!process.env.CI,
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
    command: "npm run build && npm run start",
    url: "http://localhost:3000",
    // NEVER reuse a running server: one left over from the main suite was
    // built with the blood-tier flag ON — the launch assertions would be
    // meaningless against it. Stop anything on :3000 first.
    reuseExistingServer: false,
    timeout: 240_000,
    env: LAUNCH_ENV,
  },
});
