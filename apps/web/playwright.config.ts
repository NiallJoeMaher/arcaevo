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
};

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  forbidOnly: !!process.env.CI,
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
