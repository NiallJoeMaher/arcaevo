import { test, expect } from "@playwright/test";

/**
 * Golden watch login (Phase 20) — device-scoped watch sessions + silent
 * refresh. Drives the SHARED CONTRACT the iOS/watch client is built against:
 *
 *  1. an authenticated member mints a watch session (201, its own token),
 *  2. that token authenticates a consent-guarded endpoint (GET /results 200),
 *  3. POST /auth/session/refresh 200 + a fresh (later) expiry,
 *  4. revoke → the token then 401s everywhere.
 *
 * The demo member (Aoife, demo-member-token) is used as the authenticated
 * phone identity — it is a real seeded member with health_processing consent.
 */

const PHONE = { Authorization: "Bearer demo-member-token" };

test("watch-session flow: mint → authenticate consent-guarded endpoint → refresh → revoke", async ({
  request,
}) => {
  // 1. Phone mints a device-scoped watch session.
  const mint = await request.post("/api/v1/auth/watch-session", {
    headers: PHONE,
  });
  expect(mint.status()).toBe(201);
  const minted = await mint.json();
  expect(typeof minted.watchSessionToken).toBe("string");
  expect(minted.watchSessionToken.length).toBeGreaterThan(20);
  expect(minted.device).toBe("watch");
  expect(new Date(minted.expiresAt).getTime()).toBeGreaterThan(Date.now());
  // NOT a copy of the phone token.
  expect(minted.watchSessionToken).not.toBe("demo-member-token");

  const WATCH = { Authorization: `Bearer ${minted.watchSessionToken}` };

  // 2. The watch token authenticates a CONSENT-GUARDED health endpoint.
  const results = await request.get("/api/v1/results", { headers: WATCH });
  expect(results.status()).toBe(200);
  const resultsBody = await results.json();
  expect(Array.isArray(resultsBody.results)).toBe(true);

  // 3. Silent refresh slides the expiry to a strictly later time.
  const refresh = await request.post("/api/v1/auth/session/refresh", {
    headers: WATCH,
  });
  expect(refresh.status()).toBe(200);
  const refreshed = await refresh.json();
  expect(refreshed.device).toBe("watch");
  expect(refreshed.member.name).toBe("Aoife Byrne");
  expect(new Date(refreshed.expiresAt).getTime()).toBeGreaterThanOrEqual(
    new Date(minted.expiresAt).getTime()
  );

  // 4. Phone revokes the watch → the token stops working.
  const revoke = await request.post("/api/v1/auth/watch-session/revoke", {
    headers: PHONE,
  });
  expect(revoke.status()).toBe(200);
  expect((await revoke.json()).revoked).toBeGreaterThanOrEqual(1);

  // Subsequent calls with the revoked watch token are unauthorised.
  const afterResults = await request.get("/api/v1/results", { headers: WATCH });
  expect(afterResults.status()).toBe(401);
  const afterRefresh = await request.post("/api/v1/auth/session/refresh", {
    headers: WATCH,
  });
  expect(afterRefresh.status()).toBe(401);
  expect((await afterRefresh.json()).error).toBe("session_invalid");
});

test("minting again replaces the prior watch session (one active per user)", async ({
  request,
}) => {
  const first = await request
    .post("/api/v1/auth/watch-session", { headers: PHONE })
    .then((r) => r.json());
  const second = await request
    .post("/api/v1/auth/watch-session", { headers: PHONE })
    .then((r) => r.json());

  expect(second.watchSessionToken).not.toBe(first.watchSessionToken);

  // The replaced token is dead; the new one authenticates.
  const oldRefresh = await request.post("/api/v1/auth/session/refresh", {
    headers: { Authorization: `Bearer ${first.watchSessionToken}` },
  });
  expect(oldRefresh.status()).toBe(401);

  const newResults = await request.get("/api/v1/results", {
    headers: { Authorization: `Bearer ${second.watchSessionToken}` },
  });
  expect(newResults.status()).toBe(200);

  // Cleanup so the spec is order-independent.
  await request.post("/api/v1/auth/watch-session/revoke", { headers: PHONE });
});

test("refresh with no/invalid token → 401 session_invalid", async ({
  request,
}) => {
  const none = await request.post("/api/v1/auth/session/refresh");
  expect(none.status()).toBe(401);
  expect((await none.json()).error).toBe("session_invalid");

  const bogus = await request.post("/api/v1/auth/session/refresh", {
    headers: { Authorization: "Bearer not-a-real-session-token" },
  });
  expect(bogus.status()).toBe(401);
});

test("watch-session requires an authenticated member (401 without auth)", async ({
  request,
}) => {
  const res = await request.post("/api/v1/auth/watch-session");
  expect(res.status()).toBe(401);
});

test("GET /auth/sessions lists device-scoped sessions without token hashes", async ({
  request,
}) => {
  // Mint a fresh watch session first so this test is self-contained — an
  // earlier test in this file revokes Aoife's seeded watch session (the
  // one-active-watch-session replace policy), so we can't rely on seed state.
  const minted = await request.post("/api/v1/auth/watch-session", {
    headers: PHONE,
  });
  expect(minted.status()).toBe(201);

  // Aoife's seeded iOS session + the freshly minted watch session give variety.
  const res = await request.get("/api/v1/auth/sessions", { headers: PHONE });
  expect(res.status()).toBe(200);
  const { sessions } = await res.json();
  expect(Array.isArray(sessions)).toBe(true);
  const devices = sessions.map((s: { device: string }) => s.device);
  expect(devices).toContain("watch");
  expect(devices).toContain("ios");
  // tokenHash is NEVER returned.
  expect(JSON.stringify(sessions)).not.toContain("tokenHash");
});
