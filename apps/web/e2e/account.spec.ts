import { test, expect } from "@playwright/test";
import { signinViaApi } from "./v2-helpers";

/**
 * Account pages (design §10, §15, §17) as the seeded password member
 * (demo@arcaevo.test — free account, all three consents granted incl.
 * research). Signed in via POST /api/v1/auth/signin (the httpOnly session
 * cookie lands in the context's jar); the UI signin path is covered by
 * checkout.spec.ts.
 *
 * The delete-account flow is tested up to type-DELETE arming only — never
 * submitted — so the member survives for later specs in the same run.
 */

test.beforeEach(async ({ page }) => {
  await signinViaApi(page);
});

test("privacy: the research consent toggle POSTs and flips (and persists)", async ({
  page,
}) => {
  await page.goto("/account/privacy");
  const research = page.getByRole("switch", { name: "Anonymised research" });
  await expect(research).toHaveAttribute("aria-checked", "true"); // seeded opt-in

  await research.click();
  await expect(research).toHaveAttribute("aria-checked", "false");
  await expect(page.getByText(/Saved — your consent trail/)).toBeVisible();

  // Server-side persistence (append-only trail; the page rereads it).
  await page.reload();
  const reloaded = page.getByRole("switch", { name: "Anonymised research" });
  await expect(reloaded).toHaveAttribute("aria-checked", "false");

  // Flip back on — restores the seeded state for anything running after.
  await reloaded.click();
  await expect(reloaded).toHaveAttribute("aria-checked", "true");
});

test("privacy: GP share link create → listed → revoke → public gone state", async ({
  page,
}) => {
  await page.goto("/account/privacy");
  await page.getByRole("button", { name: "Create secure link" }).click();

  // The notice carries the fresh URL; the list refreshes with the new row.
  const notice = page.getByText(/Link created — /);
  await expect(notice).toBeVisible();
  const token = /\/s\/([A-Za-z0-9_-]+)/.exec((await notice.textContent()) ?? "")?.[1];
  expect(token).toBeTruthy();

  const row = page.locator("li").filter({ hasText: `/s/${token}` });
  await expect(row).toBeVisible();
  await expect(row.getByText("Not opened yet")).toBeVisible();

  // Revoke — the row flips to REVOKED, the public page shows the gone state.
  await row.getByRole("button", { name: "Revoke" }).click();
  await expect(row.getByText("REVOKED")).toBeVisible();

  const res = await page.goto(`/s/${token}`);
  expect(res?.status()).toBe(200);
  await expect(
    page.getByRole("heading", { name: "This link is no longer live" })
  ).toBeVisible();
});

test("security: lists at least one session, current device marked NOW", async ({
  page,
}) => {
  await page.goto("/account/security");
  await expect(
    page.getByRole("heading", { name: /Where you.re signed in/ })
  ).toBeVisible();
  // The API signin from beforeEach is this context's live session.
  await expect(page.getByText("NOW", { exact: true })).toBeVisible();
  await expect(page.getByText("this device")).toBeVisible();
});

test("privacy: type-DELETE arms the delete button (never submitted)", async ({
  page,
}) => {
  await page.goto("/account/privacy");
  await page.getByRole("button", { name: "Delete everything" }).click();

  const confirm = page.locator("#delete-confirm");
  await expect(confirm).toBeVisible();
  const armButton = page.getByRole("button", { name: "Delete everything" });
  await expect(armButton).toBeDisabled();

  await confirm.fill("delete-me"); // wrong text keeps it disarmed
  await expect(armButton).toBeDisabled();

  await confirm.fill("DELETE");
  await expect(armButton).toBeEnabled();
  // Deliberately NOT clicked — arming is the safe e2e boundary (§10 W11).
});
