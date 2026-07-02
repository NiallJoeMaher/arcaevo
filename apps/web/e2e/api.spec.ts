import { test, expect } from "@playwright/test";

/** API smoke: demo auth, member profile, mock-LGC order lifecycle, guards. */

const BEARER = { Authorization: "Bearer demo-member-token" };

test("demo auth returns the demo token and member", async ({ request }) => {
  const res = await request.post("/api/v1/auth/demo");
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.token).toBe("demo-member-token");
  expect(body.member.name).toBe("Aoife Byrne");
});

test("members/me returns the demo member with bearer token", async ({
  request,
}) => {
  const res = await request.get("/api/v1/members/me", { headers: BEARER });
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(JSON.stringify(body)).toContain("Aoife Byrne");
});

test("members/me without token is rejected", async ({ request }) => {
  const res = await request.get("/api/v1/members/me");
  expect(res.status()).toBe(401);
});

test("order lifecycle: create add-on, status advances one step per poll", async ({
  request,
}) => {
  const create = await request.post("/api/v1/orders", {
    headers: BEARER,
    data: { type: "kit", panel: "recheck" },
  });
  expect(create.status()).toBe(201);
  const { order, checkout } = await create.json();
  expect(order.status).toBe("ordered");
  expect(order.panel).toBe("recheck");
  // Included in plan → €0, else add-on price €69; either way consistent.
  expect(order.priceEur).toBe(order.includedInPlan ? 0 : 69);
  if (!order.includedInPlan) {
    expect(checkout.url).toContain("mock"); // MOCK Stripe session
  }

  // MOCK LGC advances exactly one state per status poll.
  const poll1 = await request.get(`/api/v1/orders/${order._id}`, {
    headers: BEARER,
  });
  expect(poll1.status()).toBe(200);
  const after1 = (await poll1.json()).order;
  expect(after1.status).toBe("shipped");

  const poll2 = await request.get(`/api/v1/orders/${order._id}`, {
    headers: BEARER,
  });
  const after2 = (await poll2.json()).order;
  expect(after2.status).toBe("delivered");
});

test("wearable sync rejects non-Apple sources with roadmap message", async ({
  request,
}) => {
  const res = await request.post("/api/v1/sync/wearables", {
    headers: BEARER,
    data: {
      source: "whoop",
      signals: [{ type: "hrv", value: 62, date: "2026-07-01" }],
    },
  });
  expect(res.status()).toBe(422);
  const body = await res.json();
  expect(body.message).toMatch(/on the roadmap/i);
});

test("wearable sync accepts apple_health", async ({ request }) => {
  const res = await request.post("/api/v1/sync/wearables", {
    headers: BEARER,
    data: {
      source: "apple_health",
      signals: [{ type: "hrv", value: 64, date: "2026-07-02" }],
    },
  });
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.ok).toBe(true);
  expect(body.total).toBe(1);
});

test("admin KPIs require a session", async ({ request }) => {
  const res = await request.get("/api/v1/admin/kpis");
  expect(res.status()).toBe(401);
});
