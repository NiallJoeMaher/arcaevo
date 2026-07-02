import { MongoClient, type Db } from "mongodb";
import { expect, type Page } from "@playwright/test";

/**
 * Shared fixtures/helpers for the v2 (Phase 14) e2e specs.
 *
 * Magic-link emails never leave the box — they land in the Mongo `outbox`
 * collection (email.mock.ts), so tests fish the /verify?token=… link straight
 * out of the same database the webServer uses.
 */

export const MONGODB_URI =
  process.env.MONGODB_URI ?? "mongodb://localhost:27019/arcaevo";

/** Seeded e2e password member (scripts/seed.ts, mem_0026, no membership). */
export const DEMO_EMAIL = "demo@arcaevo.test";
export const DEMO_PASSWORD = "demo-password-123";
export const DEMO_NAME = "Demo Tester";

export async function withDb<T>(fn: (db: Db) => Promise<T>): Promise<T> {
  const client = new MongoClient(MONGODB_URI);
  try {
    await client.connect();
    return await fn(client.db()); // db name comes from the URI path
  } finally {
    await client.close();
  }
}

/** Newest /verify?token=… link mailed to `email` (from the Mongo outbox). */
export async function latestVerifyToken(email: string): Promise<string | null> {
  return withDb(async (db) => {
    const doc = await db
      .collection<{ to: string; body: string; createdAt: Date }>("outbox")
      .find({ to: email.toLowerCase() })
      .sort({ createdAt: -1 })
      .limit(1)
      .next();
    const match = /\/verify\?token=([A-Za-z0-9_-]+)/.exec(doc?.body ?? "");
    return match ? match[1] : null;
  });
}

/** Password sign-in through the real /signin UI (W3). */
export async function signinViaUI(page: Page): Promise<void> {
  await page.goto("/signin");
  await page.locator("#signin-email").fill(DEMO_EMAIL);
  await page.locator("#signin-password").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/account/);
}

/**
 * Fast path: POST /api/v1/auth/signin via the context's request — the
 * httpOnly session cookie lands in the browser context's cookie jar.
 */
export async function signinViaApi(page: Page): Promise<void> {
  const res = await page.request.post("/api/v1/auth/signin", {
    data: { email: DEMO_EMAIL, password: DEMO_PASSWORD },
  });
  expect(res.status()).toBe(200);
}
