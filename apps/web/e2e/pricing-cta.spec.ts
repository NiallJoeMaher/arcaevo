import { test, expect } from "@playwright/test";

/**
 * Phase 12 marketing deltas: the pricing CTAs route into the v2 flows —
 * Fusion → /join (never gated, nothing ships), Essential/Performance →
 * /checkout (Eircode gate first) — each with its eligibility hint line
 * verbatim from Pricing.dc.html.
 */

test("pricing CTAs target the v2 flows with both hint lines verbatim", async ({
  page,
}) => {
  await page.goto("/pricing");

  await expect(page.getByRole("link", { name: "Start Fusion" })).toHaveAttribute(
    "href",
    "/join"
  );
  await expect(
    page.getByRole("link", { name: "Start Essential" })
  ).toHaveAttribute("href", "/checkout?tier=essential");
  await expect(
    page.getByRole("link", { name: "Start Performance" })
  ).toHaveAttribute("href", "/checkout?tier=performance");

  // Hint lines, verbatim: one for Fusion, one under each gated plan.
  await expect(
    page.getByText("Available everywhere — nothing ships")
  ).toBeVisible();
  await expect(
    page.getByText("Dublin service area — quick Eircode check first")
  ).toHaveCount(2);
});
