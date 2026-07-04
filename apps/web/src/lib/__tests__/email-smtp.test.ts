/**
 * Unit tests for src/lib/vendors/email.smtp.ts — the OPTIONAL auth + TLS knobs
 * that make the adapter a config-change away from a real EU ESP.
 *
 * These assert on the transport CONFIG only (buildSmtpTransportConfig) — no
 * socket is ever opened, so the suite runs without a live SMTP server.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildSmtpTransportConfig, smtpDeliveryEnabled } from "@/lib/vendors/email.smtp";

const SMTP_KEYS = [
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_SECURE",
  "SMTP_USER",
  "SMTP_PASS",
  "EMAIL_PROVIDER",
] as const;

let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = {};
  for (const k of SMTP_KEYS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
});

afterEach(() => {
  for (const k of SMTP_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe("MailHog defaults (no auth, no TLS)", () => {
  it("points at localhost:1026, secure=false, and omits auth", () => {
    const cfg = buildSmtpTransportConfig();
    expect(cfg.host).toBe("localhost");
    expect(cfg.port).toBe(1026);
    expect(cfg.secure).toBe(false);
    expect(cfg.auth).toBeUndefined();
  });
});

describe("real ESP config is env-driven", () => {
  it("adds auth only when BOTH user and pass are set", () => {
    process.env.SMTP_USER = "apikey";
    process.env.SMTP_PASS = "s3cret";
    const cfg = buildSmtpTransportConfig();
    expect(cfg.auth).toEqual({ user: "apikey", pass: "s3cret" });
  });

  it("omits auth when only one credential is set", () => {
    process.env.SMTP_USER = "apikey";
    const cfg = buildSmtpTransportConfig();
    expect(cfg.auth).toBeUndefined();
  });

  it("enables TLS-on-connect only for SMTP_SECURE=true", () => {
    process.env.SMTP_SECURE = "true";
    expect(buildSmtpTransportConfig().secure).toBe(true);

    process.env.SMTP_SECURE = "false";
    expect(buildSmtpTransportConfig().secure).toBe(false);
  });

  it("respects SMTP_HOST/SMTP_PORT overrides", () => {
    process.env.SMTP_HOST = "smtp.tem.scaleway.com";
    process.env.SMTP_PORT = "465";
    const cfg = buildSmtpTransportConfig();
    expect(cfg.host).toBe("smtp.tem.scaleway.com");
    expect(cfg.port).toBe(465);
  });
});

describe("smtpDeliveryEnabled toggles on EMAIL_PROVIDER", () => {
  it("is true for mailhog/smtp, false otherwise", () => {
    expect(smtpDeliveryEnabled()).toBe(false);
    process.env.EMAIL_PROVIDER = "mailhog";
    expect(smtpDeliveryEnabled()).toBe(true);
    process.env.EMAIL_PROVIDER = "smtp";
    expect(smtpDeliveryEnabled()).toBe(true);
    process.env.EMAIL_PROVIDER = "mock";
    expect(smtpDeliveryEnabled()).toBe(false);
  });
});
