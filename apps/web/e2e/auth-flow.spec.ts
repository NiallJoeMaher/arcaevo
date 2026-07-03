import { test, expect } from "@playwright/test";
import { DEMO_EMAIL, latestSigninCode, latestVerifyToken } from "./v2-helpers";

/**
 * v2 auth journey (design §03–§04): /join → outbox magic link → /verify →
 * /consent → /account, plus the designed sign-in edge states.
 *
 * The email is unique per run (Date.now()); global-setup reseeds — and the
 * seed wipes every collection — so reruns can never collide either way.
 */

const RUN_EMAIL = `e2e+${Date.now()}@arcaevo.test`;

test("join → verify (outbox link) → consent → free account", async ({
  page,
}) => {
  // W1 — create the account with just an email.
  await page.goto("/join");
  await page.locator("#join-email").fill(RUN_EMAIL);
  await page.getByRole("checkbox").check(); // over 18 + terms
  await page.getByRole("button", { name: "Create account" }).click();

  // W2 — check-inbox state.
  await expect(
    page.getByRole("heading", { name: "Check your inbox" })
  ).toBeVisible();
  await expect(page.getByText(RUN_EMAIL)).toBeVisible();

  // E1 lands in the Mongo outbox — fish the /verify?token=… link out.
  let token: string | null = null;
  await expect
    .poll(async () => (token = await latestVerifyToken(RUN_EMAIL)), {
      message: "verify email should land in the Mongo outbox",
    })
    .not.toBeNull();

  // /verify no longer auto-POSTs the token (prefetch-safe): the human taps a
  // "Confirm sign-in" button, which redeems the link and routes fresh accounts
  // to the consent gate.
  await page.goto(`/verify?token=${token}`);
  await expect(
    page.getByRole("heading", { name: "Confirm sign-in" })
  ).toBeVisible();
  await page.getByRole("button", { name: "Confirm sign-in" }).click();
  await expect(page).toHaveURL(/\/consent/);
  await expect(
    page.getByRole("heading", { name: "Your health data, on your terms" })
  ).toBeVisible();

  // W4 — the two required purposes are fixed on; research stays OFF.
  const research = page.getByRole("checkbox");
  await expect(research).not.toBeChecked();
  await page.getByRole("button", { name: "Agree & continue" }).click();

  // Onward to the account home — a free account, no membership.
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByText("Free account")).toBeVisible();
  await expect(page.getByText("NO MEMBERSHIP")).toBeVisible();
});

test("signin with a wrong password shows the designed error and promotes the magic link", async ({
  page,
}) => {
  await page.goto("/signin");
  await page.locator("#signin-email").fill(DEMO_EMAIL);
  await page.locator("#signin-password").fill("definitely-not-the-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();

  // Non-revealing server copy, verbatim (§03).
  await expect(page.locator("#signin-error")).toHaveText(
    "That didn't work — check the details, or skip the password and we'll email you a link."
  );
  // The magic-link button is promoted after a failure.
  await expect(
    page.getByRole("button", {
      name: "Or skip the password — we'll email you a link.",
    })
  ).toBeVisible();
});

test("signed-out /account redirects to /signin", async ({ page }) => {
  await page.goto("/account");
  await expect(page).toHaveURL(/\/signin/);
});

test("prefetch-safe CODE path: request link → read code from outbox → verify {email, code} → 200 + session", async ({
  page,
}) => {
  const email = `e2e+code${Date.now()}@arcaevo.test`;

  // Create the account (E1 verify email carries both the link AND the code).
  const signup = await page.request.post("/api/v1/auth/signup", {
    data: { email },
  });
  expect(signup.status()).toBe(202);

  // Fish the typed code out of the same Mongo outbox the human would read.
  let code: string | null = null;
  await expect
    .poll(async () => (code = await latestSigninCode(email)), {
      message: "the sign-in code should land in the Mongo outbox",
    })
    .not.toBeNull();

  // A scanner can never do this — POST {email, code} to the verify endpoint.
  const res = await page.request.post("/api/v1/auth/magic-link/verify", {
    data: { email, code },
  });
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.ok).toBe(true);
  expect(body.sessionToken).toBeTruthy();
  expect(body.member.email).toBe(email.toLowerCase());

  // Single-use: the same code a second time is dead.
  const replay = await page.request.post("/api/v1/auth/magic-link/verify", {
    data: { email, code },
  });
  expect(replay.status()).toBe(401);
});

test("an expired/used link surfaces the code hint on the verify endpoint", async ({
  page,
}) => {
  const email = `e2e+hint${Date.now()}@arcaevo.test`;
  await page.request.post("/api/v1/auth/signup", { data: { email } });

  let token: string | null = null;
  await expect
    .poll(async () => (token = await latestVerifyToken(email)))
    .not.toBeNull();

  // First redemption succeeds (single-use burn).
  const first = await page.request.post("/api/v1/auth/magic-link/verify", {
    data: { token },
  });
  expect(first.status()).toBe(200);

  // Second time the link is dead — the JSON hints the code fallback exists.
  const second = await page.request.post("/api/v1/auth/magic-link/verify", {
    data: { token },
  });
  expect(second.status()).toBe(401);
  const body = await second.json();
  expect(body.error).toBe("link_expired");
  expect(body.codeAvailable).toBe(true);
});
