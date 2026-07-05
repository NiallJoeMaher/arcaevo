/**
 * PostHog EU analytics — STUBBED OFF by default (docs/MOCKED_APIS.md §6).
 *
 * No-op unless NEXT_PUBLIC_POSTHOG_KEY is set. EU host is hardcoded — no
 * US-hosted scripts, per the design handoff (EU data residency).
 */

/** Hardcoded EU ingestion host. Never point this at a US host. */
export const POSTHOG_EU_HOST = "https://eu.i.posthog.com";

/**
 * Funnel + lifecycle event names. Ordered top-to-bottom as the member journey
 * so a PostHog funnel reads straight down this list. Values are stable strings
 * (renaming one breaks historical funnels) — treat them as an API.
 *
 * PRIVACY: when emitting these, `distinctId` may be an internal id (member id,
 * waitlist id) and properties may carry ids/counts/enums/prices ONLY — NEVER an
 * Art.9 health value (a biomarker reading/verdict) or raw PII (email, name,
 * Eircode). See src/lib/log.ts for the same rule on error logs.
 */
export const AnalyticsEvent = {
  // acquisition → activation funnel
  SignupStarted: "signup_started",
  SignupCompleted: "signup_completed",
  MagicLinkVerified: "magic_link_verified",
  ConsentGranted: "consent_granted",
  CheckoutStarted: "checkout_started",
  CheckoutCompleted: "checkout_completed", // membership active
  // adjacent lifecycle
  WaitlistJoined: "waitlist_joined",
  GiftRedeemed: "gift_redeemed",
  AccountDeleted: "account_deleted",
  // operational health
  WebhookVerificationFailed: "webhook_verification_failed",
  ErasureRunCompleted: "erasure_run_completed",
} as const;

export type AnalyticsEventName =
  (typeof AnalyticsEvent)[keyof typeof AnalyticsEvent];

export function analyticsEnabled(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_POSTHOG_KEY);
}

/**
 * Capture an event. Fire-and-forget; failures are swallowed (analytics must
 * never break the product). No-op when no key is configured.
 */
export function capture(
  event: string,
  properties: Record<string, unknown> = {},
  distinctId = "anonymous"
): void {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return; // stubbed off

  void fetch(`${POSTHOG_EU_HOST}/i/v0/e/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: key,
      event,
      distinct_id: distinctId,
      properties,
    }),
  }).catch(() => {
    /* analytics is best-effort */
  });
}
