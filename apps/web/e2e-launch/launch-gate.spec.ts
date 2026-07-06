import { test, expect } from "@playwright/test";

/**
 * The production launch state (BLOOD_TIERS_ENABLED unset — see
 * playwright.launch.config.ts): Essential/Performance are not on sale, so
 * /pricing routes demand into the on-page early-access gate instead of
 * checkout, Fusion stays purchasable, and the rest of the site is unaffected.
 * These assertions mirror what a real visitor sees on arcaevo.com at launch.
 */

test("pricing: tested plans gate to early access; Fusion stays live", async ({
  page,
}) => {
  await page.goto("/pricing");

  // Essential + Performance CTAs are anchors into the gate — no checkout.
  await expect(
    page.getByRole("link", { name: "Get early access →" })
  ).toHaveCount(2);
  await expect(
    page.getByRole("link", { name: "Start Essential" })
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Start Performance" })
  ).toHaveCount(0);

  // The on-page gate itself (EarlyAccessSection), with the honest pills.
  await expect(page.locator("#early-access")).toBeVisible();
  await expect(
    page.getByText("Kits and nurses are almost ready.")
  ).toBeVisible();

  // Fusion is NEVER gated — nothing ships, nothing to fulfil.
  await expect(page.getByRole("link", { name: "Start Fusion" })).toHaveAttribute(
    "href",
    "/join"
  );
});

test("early-access form: a launch-area routing key (D08) joins the list", async ({
  page,
}) => {
  await page.goto("/pricing#early-access");

  // D08 is ELIGIBLE (Dublin allowlist) — with the flag off the API must take
  // the join (no 409 'head to checkout' dead end; checkout is closed).
  await page.getByLabel("Name").fill("Launch Gate");
  await page
    .getByLabel("Email")
    .fill(`launch.gate.${Date.now()}@example.ie`);
  await page.getByLabel(/Eircode/).fill("D08");
  await page
    .getByRole("button", { name: "Join the early-access list" })
    .click();

  // Confirmation card, with the default plan chip (Essential) noted.
  await expect(
    page.getByRole("heading", { name: "You're on the list." })
  ).toBeVisible();
  await expect(page.getByText("Noted for Essential.")).toBeVisible();
});

test("careers empty state is unaffected by the launch gate", async ({
  page,
}) => {
  await page.goto("/careers");
  await expect(
    page.getByRole("heading", { name: "Nothing open right now." })
  ).toBeVisible();
  await expect(page.getByText("Apply →")).toHaveCount(0);
});

test("home final CTA offers early access instead of Essential", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("link", { name: "Get early access" })
  ).toHaveAttribute("href", "/pricing#early-access");
});
