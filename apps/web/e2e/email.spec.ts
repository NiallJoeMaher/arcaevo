import { test, expect } from "@playwright/test";
import { latestVerifyToken } from "./v2-helpers";

/**
 * Email infrastructure spec.
 *
 * (a) The Mongo outbox is the source of truth: a signup request lands E1
 *     ("Confirm it's you") in the `outbox` collection with a /verify?token=
 *     link — every environment, no SMTP needed.
 * (b) When MailHog is reachable on localhost:8026 (docker compose up -d
 *     mailhog; playwright.config.ts wires EMAIL_PROVIDER=mailhog locally),
 *     the SAME email must also arrive over real SMTP with the right
 *     from/to/subject. CI has no mailhog → the SMTP test skips.
 */

const MAILHOG_API = "http://localhost:8026/api/v2";

/** MailHog message shape (the bits we assert on). */
interface MailhogMessage {
  Content: { Headers: Record<string, string[]> };
}

async function mailhogReachable(): Promise<boolean> {
  try {
    const res = await fetch(`${MAILHOG_API}/messages?limit=1`, {
      signal: AbortSignal.timeout(2_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function mailhogSearchTo(email: string): Promise<MailhogMessage | null> {
  const res = await fetch(
    `${MAILHOG_API}/search?kind=to&query=${encodeURIComponent(email)}`
  );
  if (!res.ok) return null;
  const data = (await res.json()) as { items: MailhogMessage[] };
  return data.items?.[0] ?? null;
}

test("signup email (E1) lands in the Mongo outbox with a /verify?token= link", async ({
  page,
}) => {
  const email = `e2e-outbox+${Date.now()}@arcaevo.test`;
  const res = await page.request.post("/api/v1/auth/signup", {
    data: { email },
  });
  expect(res.status()).toBe(202);

  let token: string | null = null;
  await expect
    .poll(async () => (token = await latestVerifyToken(email)), {
      message: "E1 verify email should land in the Mongo outbox",
    })
    .not.toBeNull();
  expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
});

test("the same email arrives in MailHog via SMTP with correct from/to/subject", async ({
  page,
}) => {
  test.skip(
    !(await mailhogReachable()),
    "MailHog not reachable on localhost:8026 — CI runs outbox-only. Locally: `docker compose up -d mailhog` (SMTP host :1026, UI :8026)."
  );

  const email = `e2e-mailhog+${Date.now()}@arcaevo.test`;
  const res = await page.request.post("/api/v1/auth/signup", {
    data: { email },
  });
  expect(res.status()).toBe(202);

  // Outbox first (always), then the SMTP copy in MailHog.
  await expect
    .poll(async () => latestVerifyToken(email), {
      message: "E1 verify email should land in the Mongo outbox",
    })
    .not.toBeNull();

  let message: MailhogMessage | null = null;
  await expect
    .poll(async () => (message = await mailhogSearchTo(email)), {
      message:
        "E1 should arrive in MailHog over SMTP — is the webServer running with EMAIL_PROVIDER=mailhog + SMTP_PORT=1026? (An older already-running server on :3000 won't have it — stop it and rerun.)",
      timeout: 15_000,
    })
    .not.toBeNull();

  const headers = message!.Content.Headers;
  expect(headers.From?.[0]).toBe("Arcaevo <hello@arcaevo.com>");
  expect(headers.To?.[0]).toBe(email);
  expect(headers.Subject?.[0]).toBe("Confirm it's you");
});
