/**
 * Unit tests for src/lib/vendors/stripe.mock.ts — pure, no Mongo, no network.
 *
 * Refund rule (from the pricing FAQ, enforced in our code): full refund only
 * while the order is still "ordered"; nothing once the kit ships / draw is
 * booked / sample is processed. Ids are deterministic (fnv1a of the inputs).
 */
import { describe, expect, it } from "vitest";
import { ORDER_STATUS_SEQUENCE } from "@/lib/models";
import {
  isRefundable,
  mockSubscriptionId,
  paymentsVendor,
} from "@/lib/vendors/stripe.mock";

describe("isRefundable", () => {
  it('is true only for "ordered"', () => {
    expect(isRefundable("ordered")).toBe(true);
  });

  it("is false for every later pipeline status", () => {
    for (const status of ORDER_STATUS_SEQUENCE.filter((s) => s !== "ordered")) {
      expect(isRefundable(status)).toBe(false);
    }
  });
});

describe("refundOrder", () => {
  it('refunds the full amount while the order is still "ordered"', async () => {
    const result = await paymentsVendor.refundOrder({
      orderId: "ord_0001",
      amountEur: 99,
      orderStatus: "ordered",
    });
    expect(result.refunded).toBe(true);
    expect(result.amountEur).toBe(99);
    expect(result.reason).toBeTruthy();
  });

  it("refunds nothing once the sample has been processed", async () => {
    for (const orderStatus of [
      "sample_registered",
      "in_lab",
      "results_ready",
    ] as const) {
      const result = await paymentsVendor.refundOrder({
        orderId: "ord_0001",
        amountEur: 199,
        orderStatus,
      });
      expect(result.refunded).toBe(false);
      expect(result.amountEur).toBe(0);
    }
  });

  it("refunds nothing once the kit has shipped or been delivered", async () => {
    for (const orderStatus of ["shipped", "delivered"] as const) {
      const result = await paymentsVendor.refundOrder({
        orderId: "ord_0001",
        amountEur: 69,
        orderStatus,
      });
      expect(result.refunded).toBe(false);
      expect(result.amountEur).toBe(0);
    }
  });
});

describe("deterministic ids", () => {
  it("createCheckoutSession: same input → same session id and url", async () => {
    const params = {
      memberId: "mem_0001",
      description: "Add-on: full panel",
      amountEur: 99,
    };
    const a = await paymentsVendor.createCheckoutSession(params);
    const b = await paymentsVendor.createCheckoutSession(params);
    expect(a.sessionId).toBe(b.sessionId);
    expect(a.url).toBe(b.url);
    expect(a.sessionId).toMatch(/^cs_mock_[0-9a-f]{8}$/);
    expect(a.url).toContain(a.sessionId);
    expect(a.amountEur).toBe(99);
  });

  it("createCheckoutSession: different input → different session id", async () => {
    const a = await paymentsVendor.createCheckoutSession({
      memberId: "mem_0001",
      description: "Add-on: full panel",
      amountEur: 99,
    });
    const b = await paymentsVendor.createCheckoutSession({
      memberId: "mem_0002",
      description: "Add-on: full panel",
      amountEur: 99,
    });
    const c = await paymentsVendor.createCheckoutSession({
      memberId: "mem_0001",
      description: "Add-on: recheck",
      amountEur: 69,
    });
    expect(a.sessionId).not.toBe(b.sessionId);
    expect(a.sessionId).not.toBe(c.sessionId);
  });

  it("mockSubscriptionId: deterministic per member, sub_mock_ prefixed", () => {
    expect(mockSubscriptionId("mem_0001")).toBe(mockSubscriptionId("mem_0001"));
    expect(mockSubscriptionId("mem_0001")).toMatch(/^sub_mock_[0-9a-f]{8}$/);
    expect(mockSubscriptionId("mem_0001")).not.toBe(
      mockSubscriptionId("mem_0002")
    );
  });
});

describe("getSubscription", () => {
  it("resolves any sub_mock_ id to an active subscription", async () => {
    const id = mockSubscriptionId("mem_0001");
    const sub = await paymentsVendor.getSubscription(id);
    expect(sub).not.toBeNull();
    expect(sub?.subscriptionId).toBe(id);
    expect(sub?.status).toBe("active");
  });

  it("returns null for non-mock ids", async () => {
    expect(await paymentsVendor.getSubscription("sub_real_123")).toBeNull();
    expect(await paymentsVendor.getSubscription("")).toBeNull();
  });
});
