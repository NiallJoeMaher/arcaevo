import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AnalyticsEvent,
  POSTHOG_EU_HOST,
  analyticsEnabled,
  capture,
} from "@/lib/analytics";
import { logError } from "@/lib/log";

describe("logError", () => {
  let spy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    spy = vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => spy.mockRestore());

  it("emits a single parseable JSON line with context + meta", () => {
    logError("checkout.guest_verify_email", new Error("smtp down"), {
      memberId: "mem_0001",
    });
    expect(spy).toHaveBeenCalledOnce();
    const parsed = JSON.parse(spy.mock.calls[0][0] as string);
    expect(parsed).toMatchObject({
      level: "error",
      context: "checkout.guest_verify_email",
      error: "Error",
      message: "smtp down",
      memberId: "mem_0001",
    });
    expect(typeof parsed.at).toBe("string");
  });

  it("handles non-Error throwables without throwing", () => {
    expect(() => logError("ctx", "a string blew up")).not.toThrow();
    const parsed = JSON.parse(spy.mock.calls[0][0] as string);
    expect(parsed.message).toBe("a string blew up");
  });
});

describe("capture (PostHog EU, dep-free)", () => {
  const KEY = "NEXT_PUBLIC_POSTHOG_KEY";
  const original = process.env[KEY];
  afterEach(() => {
    if (original === undefined) delete process.env[KEY];
    else process.env[KEY] = original;
    vi.unstubAllGlobals();
  });

  it("is a no-op (no network) when no key is configured", () => {
    delete process.env[KEY];
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    expect(analyticsEnabled()).toBe(false);
    capture(AnalyticsEvent.CheckoutStarted, { tier: "essential" }, "mem_0001");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("posts the event to the EU host when a key is set", () => {
    process.env[KEY] = "phc_test";
    const fetchSpy = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("fetch", fetchSpy);
    capture(AnalyticsEvent.CheckoutCompleted, { tier: "essential" }, "mem_0001");
    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, init] = fetchSpy.mock.calls[0];
    expect(String(url)).toContain(POSTHOG_EU_HOST);
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body).toMatchObject({
      api_key: "phc_test",
      event: "checkout_completed",
      distinct_id: "mem_0001",
      properties: { tier: "essential" },
    });
  });
});

describe("AnalyticsEvent funnel names", () => {
  it("exposes stable snake_case funnel + lifecycle names", () => {
    // Renaming any of these breaks historical PostHog funnels — locked.
    expect(AnalyticsEvent).toMatchObject({
      SignupStarted: "signup_started",
      SignupCompleted: "signup_completed",
      MagicLinkVerified: "magic_link_verified",
      ConsentGranted: "consent_granted",
      CheckoutStarted: "checkout_started",
      CheckoutCompleted: "checkout_completed",
      WaitlistJoined: "waitlist_joined",
      GiftRedeemed: "gift_redeemed",
      AccountDeleted: "account_deleted",
      WebhookVerificationFailed: "webhook_verification_failed",
      ErasureRunCompleted: "erasure_run_completed",
    });
  });
});
