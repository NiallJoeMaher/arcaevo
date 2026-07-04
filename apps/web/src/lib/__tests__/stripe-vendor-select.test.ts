/**
 * Unit tests for the payments vendor-selection factory (src/lib/vendors/stripe.ts).
 *
 * The factory must keep CI / e2e / docker on the MOCK (no key configured) so the
 * whole existing suite passes, and only choose LIVE when a real key is present
 * and not force-mocked.
 *
 * `@/lib/db` is mocked (the live vendor imports it) so no Mongo is touched.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  collections: {
    users: async () => ({ findOne: async () => null, updateOne: async () => ({}) }),
  },
}));

import {
  getPaymentsVendor,
  selectedPaymentsVendorKind,
} from "@/lib/vendors/stripe";
import { paymentsVendor as mockVendor } from "@/lib/vendors/stripe.mock";
import { stripeLiveVendor } from "@/lib/vendors/stripe.live";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("selectedPaymentsVendorKind", () => {
  it("is 'mock' when no key is set (CI / e2e / docker)", () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "");
    expect(selectedPaymentsVendorKind()).toBe("mock");
    expect(getPaymentsVendor()).toBe(mockVendor);
  });

  it("is 'mock' when the key is not a plausible sk_ key", () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "not-a-key");
    expect(selectedPaymentsVendorKind()).toBe("mock");
  });

  it("is 'live' when a test/live sk_ key is set", () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_deadbeef");
    expect(selectedPaymentsVendorKind()).toBe("live");
    expect(getPaymentsVendor()).toBe(stripeLiveVendor);
  });

  it("is 'mock' when STRIPE_FORCE_MOCK=true even with a key", () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_deadbeef");
    vi.stubEnv("STRIPE_FORCE_MOCK", "true");
    expect(selectedPaymentsVendorKind()).toBe("mock");
    expect(getPaymentsVendor()).toBe(mockVendor);
  });
});
