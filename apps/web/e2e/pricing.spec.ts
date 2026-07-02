import { test, expect } from "@playwright/test";

/** Business-model figures must appear verbatim (handoff hard constraint). */

test("pricing page shows all tier and add-on figures verbatim", async ({
  page,
}) => {
  await page.goto("/pricing");
  const body = page.locator("body");
  await expect(body).toContainText("€119");
  await expect(body).toContainText("€329");
  await expect(body).toContainText("€399");
  await expect(body).toContainText("MOST POPULAR");
  await expect(body).toContainText("€130");
  await expect(body).toContainText("€99");
  await expect(body).toContainText("€69");
  await expect(body).toContainText("€199");
  // Annual-only at launch is explained on the page.
  await expect(body).toContainText(/annual/i);
});

test("home pricing teaser shows the three tiers", async ({ page }) => {
  await page.goto("/");
  const body = page.locator("body");
  await expect(body).toContainText("€119");
  await expect(body).toContainText("€329");
  await expect(body).toContainText("€399");
});
