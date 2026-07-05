/**
 * Dep-free structured error logging (IMPROVEMENT_REVIEW #5).
 *
 * A single, console-based `logError(context, err, meta?)` so failures in the
 * critical paths (webhooks, checkout, erasure, email, magic-link) are at least
 * VISIBLE in Vercel logs instead of being swallowed. One line of JSON per
 * error so Vercel/CloudWatch log processors can parse and alert on it.
 *
 * PRIVACY (hard rule): this is a log line, not an audit trail. NEVER pass
 * Art.9 health values (biomarker readings, verdicts) or raw PII (emails,
 * names, Eircodes). `context` is a short stable string; `meta` is ids, counts
 * and enums ONLY. When a real Sentry transport is added (see
 * docs/OBSERVABILITY.md) it consumes the SAME calls — keep them PII-free.
 */

/** Meta must stay to ids/counts/enums — no health values, no raw PII. */
export type LogMeta = Record<string, string | number | boolean>;

export function logError(context: string, err: unknown, meta: LogMeta = {}): void {
  const message = err instanceof Error ? err.message : String(err);
  const name = err instanceof Error ? err.name : "Error";
  // Single-line JSON keeps it greppable and machine-parseable in Vercel logs.
  console.error(
    JSON.stringify({
      level: "error",
      at: new Date().toISOString(),
      context,
      error: name,
      message,
      ...meta,
    })
  );
}
