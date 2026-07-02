import { test, expect, type APIRequestContext } from "@playwright/test";

/**
 * GP share links (design §15): the public clinician summary at /s/[token],
 * the designed gone state, and the access log that grows on every open.
 *
 * Seed fixture: /s/k7f2demo belongs to Aoife Byrne (mem_0001), 1 logged open.
 */

const BEARER = { Authorization: "Bearer demo-member-token" }; // Aoife

async function openedCount(request: APIRequestContext): Promise<number> {
  const res = await request.get("/api/v1/share", { headers: BEARER });
  expect(res.status()).toBe(200);
  const { links } = (await res.json()) as {
    links: { token: string; openedCount: number }[];
  };
  const link = links.find((l) => l.token === "k7f2demo");
  expect(link).toBeTruthy();
  return link!.openedCount;
}

test("/s/k7f2demo renders the reviewer's IMC number and result rows", async ({
  page,
}) => {
  await page.goto("/s/k7f2demo");
  await expect(page.getByRole("heading", { name: "Aoife Byrne" })).toBeVisible();
  await expect(page.getByText("IMC 412887")).toBeVisible();

  // The prev/current/verdict table.
  await expect(page.getByText("Marker", { exact: true })).toBeVisible();
  await expect(page.getByText("Previous", { exact: true })).toBeVisible();
  await expect(page.getByText("Verdict", { exact: true })).toBeVisible();
  // Aoife's seeded recheck story includes verdict rows.
  await expect(
    page.getByText(/^(Improved|No real change|Worsened)$/).first()
  ).toBeVisible();
});

test("unknown token renders the designed gone state (HTTP 200 page)", async ({
  page,
}) => {
  const res = await page.goto("/s/not-a-real-token");
  expect(res?.status()).toBe(200); // the page renders the designed screen
  await expect(
    page.getByRole("heading", { name: "This link is no longer live" })
  ).toBeVisible();
  await expect(page.getByText(/Links expire after 30 days/)).toBeVisible();
});

test("every open of the share API is appended to the access log", async ({
  request,
}) => {
  const before = await openedCount(request);

  // Open twice — the public GET, no auth needed.
  for (let i = 0; i < 2; i += 1) {
    const res = await request.get("/api/v1/share/k7f2demo");
    expect(res.status()).toBe(200);
  }

  const after = await openedCount(request);
  expect(after).toBe(before + 2);
});
