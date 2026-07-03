import { test, expect } from "@playwright/test";
import { latestVerifyToken } from "./v2-helpers";

/**
 * GDPR Art.9 consent ENFORCEMENT (FIX 1) + immediate-stop on withdrawal.
 *
 * A freshly signed-up member has verified their email but NOT consented yet
 * (the consent gate is the next screen). The health-data API must refuse them
 * with 403 until they grant health_processing — and withdrawing it again must
 * kill their live session at once.
 */

/** Sign up + verify a brand-new member; return a bearer session token. */
async function freshVerifiedSession(
  request: import("@playwright/test").APIRequestContext
): Promise<{ email: string; sessionToken: string; needsConsent: boolean }> {
  const email = `consent-e2e-${Date.now()}-${Math.floor(Math.random() * 1e6)}@arcaevo.test`;
  const signup = await request.post("/api/v1/auth/signup", {
    data: { email, password: "consent-e2e-pass-123" },
  });
  expect(signup.status()).toBe(202);

  const token = await latestVerifyToken(email);
  expect(token, "verify token should land in the outbox").toBeTruthy();

  const verify = await request.post("/api/v1/auth/magic-link/verify", {
    data: { token },
  });
  expect(verify.status()).toBe(200);
  const { sessionToken, needsConsent } = await verify.json();
  return { email, sessionToken, needsConsent };
}

test("health endpoint is 403 without consent, 200 after consenting", async ({
  request,
}) => {
  const { sessionToken, needsConsent } = await freshVerifiedSession(request);
  expect(needsConsent).toBe(true); // no health_processing grant yet
  const headers = { Authorization: `Bearer ${sessionToken}` };

  // Before consent → 403 consent_required (not decorative any more).
  const before = await request.get("/api/v1/results", { headers });
  expect(before.status()).toBe(403);
  const body = await before.json();
  expect(body.error).toBe("consent_required");
  expect(body.needsConsent).toBe(true);

  // Grant health_processing.
  const grant = await request.post("/api/v1/consents", {
    headers,
    data: { surface: "web", grants: [{ purpose: "health_processing", granted: true }] },
  });
  expect(grant.status()).toBe(200);

  // After consent → 200 (empty results, but the door is open).
  const after = await request.get("/api/v1/results", { headers });
  expect(after.status()).toBe(200);
  expect(Array.isArray((await after.json()).results)).toBe(true);
});

test("withdrawing health_processing revokes the live session immediately", async ({
  request,
}) => {
  const { sessionToken } = await freshVerifiedSession(request);
  const headers = { Authorization: `Bearer ${sessionToken}` };

  // Consent, confirm access works.
  await request.post("/api/v1/consents", {
    headers,
    data: { surface: "web", grants: [{ purpose: "health_processing", granted: true }] },
  });
  expect((await request.get("/api/v1/results", { headers })).status()).toBe(200);

  // Withdraw → session revoked. The same bearer no longer resolves a member.
  const withdraw = await request.post("/api/v1/consents", {
    headers,
    data: { surface: "web", grants: [{ purpose: "health_processing", granted: false }] },
  });
  expect(withdraw.status()).toBe(200);

  const after = await request.get("/api/v1/results", { headers });
  // Session deleted → 401 (auth fails before the consent check even runs).
  expect(after.status()).toBe(401);
});
