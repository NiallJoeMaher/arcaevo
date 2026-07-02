/**
 * PostHog EU analytics — STUBBED OFF by default (docs/MOCKED_APIS.md §6).
 *
 * No-op unless NEXT_PUBLIC_POSTHOG_KEY is set. EU host is hardcoded — no
 * US-hosted scripts, per the design handoff (EU data residency).
 */

/** Hardcoded EU ingestion host. Never point this at a US host. */
export const POSTHOG_EU_HOST = "https://eu.i.posthog.com";

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
