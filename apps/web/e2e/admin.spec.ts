import { test, expect } from "@playwright/test";

const PASSWORD = "change-me-local";

async function login(page: import("@playwright/test").Page) {
  await page.goto("/admin/login");
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

test("unauthenticated /admin redirects to login", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login/);
});

test("wrong password shows an error and does not log in", async ({ page }) => {
  await page.goto("/admin/login");
  await page.locator('input[type="password"]').fill("nope");
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/admin\/login/);
  await expect(
    page.getByText(/incorrect|wrong|invalid|try again/i).first()
  ).toBeVisible();
});

test("login lands on dashboard with KPI cards", async ({ page }) => {
  await login(page);
  await expect(page.getByText("ACTIVE MEMBERS")).toBeVisible();
  await expect(page.getByText("MRR", { exact: true })).toBeVisible();
  await expect(page.getByText("TESTS THIS MONTH")).toBeVisible();
});

test("members, results and support tabs render seeded data", async ({
  page,
}) => {
  await login(page);

  await page.goto("/admin/members");
  // Seed creates 25 members; the demo member is Aoife Byrne.
  await expect(page.getByText("Aoife Byrne").first()).toBeVisible();

  await page.goto("/admin/results");
  await expect(page.getByText(/awaiting sign-off/i).first()).toBeVisible();

  await page.goto("/admin/support");
  // Seed creates 6 tickets.
  await expect(page.getByText(/open/i).first()).toBeVisible();
});

test("results sign-off approves a panel via the API", async ({ page }) => {
  await login(page);
  await page.goto("/admin/results");
  const signOff = page.getByRole("button", { name: /sign off/i });
  const before = await signOff.count();
  expect(before).toBeGreaterThan(0);
  await signOff.first().click();
  // router.refresh() re-renders the queue with one fewer panel.
  await expect(signOff).toHaveCount(before - 1, { timeout: 15_000 });
});
