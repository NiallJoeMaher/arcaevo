import { test, expect } from "@playwright/test";

/** Help accordion: ONE item open at a time across the page, +/− swap. */

test("accordion opens one item at a time with +/− swap", async ({ page }) => {
  await page.goto("/help");
  const buttons = page.locator("button[aria-expanded]");
  const count = await buttons.count();
  expect(count).toBeGreaterThanOrEqual(8);

  // Exactly one open by default (prototype opens item 0-0).
  await expect(page.locator('button[aria-expanded="true"]')).toHaveCount(1);
  const first = buttons.first();
  await expect(first).toHaveAttribute("aria-expanded", "true");
  await expect(first).toContainText("−");

  // Open a different item → the first closes; still exactly one open.
  const other = buttons.nth(3);
  await expect(other).toContainText("+");
  await other.click();
  await expect(other).toHaveAttribute("aria-expanded", "true");
  await expect(other).toContainText("−");
  await expect(first).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator('button[aria-expanded="true"]')).toHaveCount(1);

  // Clicking the open item closes it → zero open.
  await other.click();
  await expect(page.locator('button[aria-expanded="true"]')).toHaveCount(0);
});
