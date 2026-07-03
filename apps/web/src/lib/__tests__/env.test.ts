/**
 * Unit tests for src/lib/env.ts — fail-closed secret validation, the demo-token
 * gate, and the mock-webhook shared-secret gate. Production is simulated with
 * `vi.stubEnv("NODE_ENV", "production")`.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  assertRequiredSecrets,
  demoTokenEnabled,
  isProduction,
  sessionSecret,
  verifyWebhookSecret,
} from "@/lib/env";

const DEV_FALLBACK = "arcaevo-dev-secret-do-not-use-in-prod";
const HEADER = "x-arcaevo-webhook-secret";

function webhookReq(headerValue?: string): Request {
  return new Request("http://localhost/api/v1/webhooks/stripe", {
    method: "POST",
    headers: headerValue ? { [HEADER]: headerValue } : {},
  });
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("sessionSecret()", () => {
  it("returns the configured SESSION_SECRET when set", () => {
    vi.stubEnv("SESSION_SECRET", "a-real-secret");
    expect(sessionSecret()).toBe("a-real-secret");
  });

  it("falls back to the dev literal ONLY outside production", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("SESSION_SECRET", "");
    expect(isProduction()).toBe(false);
    expect(sessionSecret()).toBe(DEV_FALLBACK);
  });

  it("throws in production when SESSION_SECRET is missing (fail closed)", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SESSION_SECRET", "");
    expect(() => sessionSecret()).toThrow(/SESSION_SECRET is required/);
  });

  it("returns the secret in production when it is set", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SESSION_SECRET", "prod-secret");
    expect(sessionSecret()).toBe("prod-secret");
  });
});

describe("demoTokenEnabled()", () => {
  it("is on in non-production", () => {
    vi.stubEnv("NODE_ENV", "test");
    expect(demoTokenEnabled()).toBe(true);
  });

  it("is off in production without the flag", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ALLOW_DEMO_TOKEN", "");
    expect(demoTokenEnabled()).toBe(false);
  });

  it("is on in production with ALLOW_DEMO_TOKEN=true", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ALLOW_DEMO_TOKEN", "true");
    expect(demoTokenEnabled()).toBe(true);
  });
});

describe("assertRequiredSecrets()", () => {
  it("is a no-op outside production", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("SESSION_SECRET", "");
    vi.stubEnv("ADMIN_PASSWORD", "");
    expect(() => assertRequiredSecrets()).not.toThrow();
  });

  it("throws in production listing every missing secret", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SESSION_SECRET", "");
    vi.stubEnv("ADMIN_PASSWORD", "");
    expect(() => assertRequiredSecrets()).toThrow(/SESSION_SECRET/);
    expect(() => assertRequiredSecrets()).toThrow(/ADMIN_PASSWORD/);
  });

  it("passes in production when both are set", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SESSION_SECRET", "s");
    vi.stubEnv("ADMIN_PASSWORD", "p");
    expect(() => assertRequiredSecrets()).not.toThrow();
  });
});

describe("verifyWebhookSecret()", () => {
  it("is open in non-production when no secret is configured", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "");
    expect(verifyWebhookSecret(webhookReq(), "STRIPE_WEBHOOK_SECRET", HEADER)).toBe(
      true
    );
  });

  it("rejects in production when no secret is configured and no opt-in", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "");
    vi.stubEnv("ALLOW_OPEN_WEBHOOKS", "");
    expect(verifyWebhookSecret(webhookReq(), "STRIPE_WEBHOOK_SECRET", HEADER)).toBe(
      false
    );
  });

  it("is open in a prod build when ALLOW_OPEN_WEBHOOKS=true (local e2e/docker)", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "");
    vi.stubEnv("ALLOW_OPEN_WEBHOOKS", "true");
    expect(verifyWebhookSecret(webhookReq(), "STRIPE_WEBHOOK_SECRET", HEADER)).toBe(
      true
    );
  });

  it("requires a matching header when a secret IS configured (prod)", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_123");
    expect(
      verifyWebhookSecret(webhookReq("whsec_123"), "STRIPE_WEBHOOK_SECRET", HEADER)
    ).toBe(true);
    expect(
      verifyWebhookSecret(webhookReq("wrong"), "STRIPE_WEBHOOK_SECRET", HEADER)
    ).toBe(false);
    expect(
      verifyWebhookSecret(webhookReq(), "STRIPE_WEBHOOK_SECRET", HEADER)
    ).toBe(false);
  });

  it("requires the header even in dev once a secret is configured", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_dev");
    expect(
      verifyWebhookSecret(webhookReq(), "STRIPE_WEBHOOK_SECRET", HEADER)
    ).toBe(false);
    expect(
      verifyWebhookSecret(webhookReq("whsec_dev"), "STRIPE_WEBHOOK_SECRET", HEADER)
    ).toBe(true);
  });
});
