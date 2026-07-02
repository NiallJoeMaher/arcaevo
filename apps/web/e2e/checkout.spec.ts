import { test, expect } from "@playwright/test";
import { DEMO_NAME, signinViaUI } from "./v2-helpers";

/**
 * Checkout (design §05–§07): the Eircode gate, the three steps, the mock
 * payment, and the waitlist path when the gate says no.
 *
 * Seed fixtures: D08 is on the launch allowlist; T12 maps to Cork (one
 * seeded Cork waitlist entry → a new join lands at position 2).
 */

test("essential checkout: D08 passes → details → mock payment → welcome → account ACTIVE", async ({
  page,
}) => {
  await signinViaUI(page); // demo@arcaevo.test via the real /signin form

  await page.goto("/checkout?tier=essential");

  // W5 · step 1 — the Eircode gate; blur triggers the designed pass state.
  await expect(
    page.getByText("STEP 1 OF 3 · ESSENTIAL — €329/YR")
  ).toBeVisible();
  await page.locator("#checkout-eircode").fill("D08 XY24");
  await page.locator("#checkout-eircode").blur();
  await expect(page.getByText(/in the Dublin service area/)).toBeVisible();
  await page.getByRole("button", { name: "Continue to your details" }).click();

  // W7 · step 2 — details incl. DOB (lab requirement); name prefilled.
  await expect(
    page.getByRole("heading", { name: "Where do we send the kit?" })
  ).toBeVisible();
  await expect(page.locator("#checkout-name")).toHaveValue(DEMO_NAME);
  await page
    .locator("#checkout-address")
    .fill("14 Emmet Road, Inchicore, Dublin 8");
  await page.locator("#checkout-dob").fill("14 / 03 / 1991");
  await page.getByRole("button", { name: "Continue to payment" }).click();

  // W8 · step 3 — MOCK Stripe payment.
  await expect(page.getByText("STEP 3 OF 3 · PAYMENT")).toBeVisible();
  await expect(page.getByText("Due today")).toBeVisible();
  await page.getByRole("button", { name: "Pay €329.00" }).click();

  // W9 — plan-aware welcome (Essential leads with the kit shipping).
  await expect(page).toHaveURL(/\/welcome\?tier=essential/);
  await expect(
    page.getByRole("heading", { name: /a member, Demo/ })
  ).toBeVisible();
  await expect(page.getByText("Your kit ships today.")).toBeVisible();

  // W10 — the membership card shows ACTIVE and the test allowance.
  await page.goto("/account");
  await expect(page.getByText("Essential · €329/yr")).toBeVisible();
  await expect(page.getByText("ACTIVE", { exact: true })).toBeVisible();
  await expect(page.getByText("0 of 2 tests used")).toBeVisible();
});

test("T12 fails the gate → early-access carries the Eircode → Cork waitlist position", async ({
  page,
}) => {
  await page.goto("/checkout?tier=essential");
  await page.locator("#checkout-eircode").fill("T12 AB90");
  await page.locator("#checkout-eircode").blur();

  // W6 inline — the refusal names the county and keeps the Eircode.
  await expect(
    page.getByRole("heading", { name: /Not in Cork/ })
  ).toBeVisible();
  const earlyAccess = page.getByRole("link", {
    name: "Join the early-access list",
  });
  await expect(earlyAccess).toHaveAttribute(
    "href",
    "/early-access?eircode=T12%20AB90"
  );
  await earlyAccess.click();

  // /early-access — county looked up from the carried Eircode.
  await expect(page).toHaveURL(/\/early-access\?eircode=T12/);
  await expect(
    page.getByRole("heading", { name: /Not in Cork/ })
  ).toBeVisible();
  await page
    .locator("#waitlist-email")
    .fill(`e2e-waitlist+${Date.now()}@arcaevo.test`);
  await page
    .getByRole("button", { name: "Join the early-access list" })
    .click();

  // Position + county receipt (seed has one Cork entry → position 2).
  await expect(
    page.getByRole("heading", { name: /on the list, Cork/ })
  ).toBeVisible();
  await expect(page.getByText("number 2")).toBeVisible();
  await expect(page.getByText(/in Cork/)).toBeVisible();
});
