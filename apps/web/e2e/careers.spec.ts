import { test, expect } from "@playwright/test";

test.describe("careers — empty board", () => {
  test("designed empty state renders; no role cards", async ({ page }) => {
    await page.goto("/careers");
    await expect(
      page.getByRole("heading", { name: "Nothing open right now." })
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Introduce yourself anyway →" })
    ).toHaveAttribute("href", "/contact");
    await expect(
      page.getByRole("link", { name: "We announce roles on the journal first →" })
    ).toHaveAttribute("href", "/blog");
    await expect(page.getByText("Apply →")).toHaveCount(0);
  });
});
