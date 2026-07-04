/**
 * Unit tests for the REAL Stripe webhook signature verifier
 * (src/lib/stripe-signature.ts) — the replacement for the shared-secret stub.
 *
 * Covers: a correctly-signed payload verifies; a tampered body rejects; a
 * tampered signature rejects; a stale timestamp (outside tolerance) rejects;
 * secret rotation (multiple v1) passes; malformed headers reject.
 */
import { describe, expect, it } from "vitest";
import {
  constructWebhookEvent,
  parseSignatureHeader,
  signPayloadForTest,
  verifyStripeSignature,
} from "@/lib/stripe-signature";

const SECRET = "whsec_test_abc123";
const NOW = 1_770_000_000; // fixed "now" in seconds
const payload = JSON.stringify({
  id: "evt_1",
  type: "checkout.session.completed",
  data: { object: { metadata: { memberId: "mem_0001" } } },
});

function header(ts: number, secret = SECRET, body = payload): string {
  return signPayloadForTest(body, secret, ts);
}

describe("verifyStripeSignature", () => {
  it("accepts a correctly-signed, fresh payload", () => {
    const h = header(NOW);
    expect(
      verifyStripeSignature(payload, h, SECRET, { nowSeconds: NOW })
    ).toBe(true);
  });

  it("rejects a tampered body (HMAC no longer matches)", () => {
    const h = header(NOW);
    const tampered = payload.replace("mem_0001", "mem_9999");
    expect(
      verifyStripeSignature(tampered, h, SECRET, { nowSeconds: NOW })
    ).toBe(false);
  });

  it("rejects a tampered signature value", () => {
    const h = header(NOW).replace(/v1=.*/, "v1=deadbeef");
    expect(
      verifyStripeSignature(payload, h, SECRET, { nowSeconds: NOW })
    ).toBe(false);
  });

  it("rejects a stale timestamp outside the tolerance window", () => {
    const h = header(NOW - 10_000); // signed 10k s ago
    expect(
      verifyStripeSignature(payload, h, SECRET, {
        nowSeconds: NOW,
        toleranceSeconds: 300,
      })
    ).toBe(false);
  });

  it("rejects a future timestamp outside tolerance", () => {
    const h = header(NOW + 10_000);
    expect(
      verifyStripeSignature(payload, h, SECRET, { nowSeconds: NOW })
    ).toBe(false);
  });

  it("rejects the wrong signing secret", () => {
    const h = header(NOW, "whsec_wrong");
    expect(
      verifyStripeSignature(payload, h, SECRET, { nowSeconds: NOW })
    ).toBe(false);
  });

  it("accepts when ANY v1 matches (secret rotation)", () => {
    const good = signPayloadForTest(payload, SECRET, NOW).replace("t=" + NOW + ",", "");
    // Build a header carrying two v1s: one bogus, one valid.
    const validV1 = good; // "v1=<hex>"
    const combined = `t=${NOW},v1=deadbeef,${validV1}`;
    expect(
      verifyStripeSignature(payload, combined, SECRET, { nowSeconds: NOW })
    ).toBe(true);
  });

  it("rejects missing header or missing secret", () => {
    expect(verifyStripeSignature(payload, null, SECRET)).toBe(false);
    expect(verifyStripeSignature(payload, header(NOW), undefined)).toBe(false);
  });

  it("rejects a malformed header (no t / no v1)", () => {
    expect(verifyStripeSignature(payload, "garbage", SECRET)).toBe(false);
    expect(
      verifyStripeSignature(payload, `t=${NOW}`, SECRET, { nowSeconds: NOW })
    ).toBe(false);
  });
});

describe("parseSignatureHeader", () => {
  it("extracts t and all v1 values", () => {
    const parsed = parseSignatureHeader("t=123,v1=aaa,v1=bbb,v0=ccc");
    expect(parsed.timestamp).toBe(123);
    expect(parsed.v1).toEqual(["aaa", "bbb"]);
  });
});

describe("constructWebhookEvent", () => {
  it("returns the parsed event on a valid signature", () => {
    const h = header(NOW);
    const event = constructWebhookEvent(payload, h, SECRET, { nowSeconds: NOW });
    expect(event?.type).toBe("checkout.session.completed");
    expect(
      (event?.data.object.metadata as Record<string, string>).memberId
    ).toBe("mem_0001");
  });

  it("returns null on a bad signature", () => {
    expect(
      constructWebhookEvent(payload, "t=1,v1=bad", SECRET, { nowSeconds: NOW })
    ).toBeNull();
  });

  it("returns null when the verified body is not JSON", () => {
    const notJson = "not json";
    const h = signPayloadForTest(notJson, SECRET, NOW);
    expect(
      constructWebhookEvent(notJson, h, SECRET, { nowSeconds: NOW })
    ).toBeNull();
  });
});
