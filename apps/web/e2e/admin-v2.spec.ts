import { test, expect } from "@playwright/test";

/**
 * Phase 13 admin ops views (design_handoff_v2 §18): waitlist demand,
 * Eircode allowlist editor, consent audit. Read-only assertions — the
 * allowlist itself is never mutated so the checkout specs stay deterministic.
 */

const PASSWORD = "change-me-local";

async function login(page: import("@playwright/test").Page) {
  await page.goto("/admin/login");
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

test("waitlist demand shows Cork (ADM-1)", async ({ page }) => {
  await login(page);
  await page.goto("/admin/waitlist");
  await expect(page.getByText("Where do we open next?")).toBeVisible();
  await expect(page.getByText("TOTAL SIGNUPS")).toBeVisible();
  // Seeded demand: one Cork + one Galway entry.
  await expect(page.getByText("Cork").first()).toBeVisible();
  await expect(page.getByText("TOP ROUTING KEYS")).toBeVisible();
});

test("eligibility allowlist renders 31 launch keys incl. D08, with the editor (ADM-2)", async ({
  page,
}) => {
  await login(page);
  await page.goto("/admin/eligibility");
  await expect(
    page.getByText("The gate is data, not a deploy")
  ).toBeVisible();

  // The launch allowlist: 31 routing-key chips, each removable.
  const chips = page.locator('button[aria-label^="Remove "]');
  await expect(chips).toHaveCount(31);
  await expect(page.getByRole("button", { name: "Remove D08" })).toBeVisible();

  // The add/remove editor exists (edits go via POST /api/v1/admin/eligibility).
  await expect(
    page.getByRole("textbox", { name: "Routing key to add" })
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Add", exact: true })).toBeVisible();
});

test("consent audit renders grants and the purpose filter works (ADM-3)", async ({
  page,
}) => {
  await login(page);

  // Unfiltered — every purpose is on the table.
  await page.goto("/admin/consent");
  await expect(page.getByText(/CURRENT NOTICE VERSION/)).toBeVisible();
  await expect(page.getByText("Aoife Byrne").first()).toBeVisible();
  await expect(page.getByText("GRANTED").first()).toBeVisible();
  // Table purpose cells use the design's hyphenated spelling, exact text.
  await expect(
    page.getByText("clinician-review", { exact: true }).first()
  ).toBeVisible();

  // ?purpose=research — only research decisions remain in the table.
  await page.goto("/admin/consent?purpose=research");
  await expect(
    page.getByText("research", { exact: true }).first()
  ).toBeVisible();
  await expect(page.getByText("clinician-review", { exact: true })).toHaveCount(
    0
  );
  // Both decisions exist for research in the seed (granted + declined).
  await expect(page.getByText("GRANTED").first()).toBeVisible();
  await expect(page.getByText("DECLINED").first()).toBeVisible();
});
