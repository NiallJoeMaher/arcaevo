import { test, expect } from "@playwright/test";
import { DEMO_EMAIL, latestVerifyToken } from "./v2-helpers";

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

  // /verify redeems the link and routes fresh accounts to the consent gate.
  await page.goto(`/verify?token=${token}`);
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
