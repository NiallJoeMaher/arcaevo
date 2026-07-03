/**
 * Environment / secret validation — FAIL CLOSED in production.
 *
 * The admin session cookie is a self-describing HMAC token: anyone who knows
 * the signing secret can forge admin access. So in production we refuse to fall
 * back to a committed literal and instead throw. In non-production a dev
 * fallback keeps local/dev/e2e working with zero config.
 *
 * This module is deliberately dependency-free (no `node:crypto`) so it is safe
 * to import from `instrumentation.ts`, which may run in the Edge runtime.
 */

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

/** Dev-only HMAC secret. NEVER used in production (we throw instead). */
const DEV_SESSION_SECRET = "arcaevo-dev-secret-do-not-use-in-prod";

/**
 * Secret for HMAC-signing the admin session cookie.
 *  - production: MUST be set to a strong random value, else we throw.
 *  - non-production: falls back to a dev literal so local/e2e just works.
 */
export function sessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (secret && secret.length > 0) return secret;
  if (isProduction()) {
    throw new Error(
      "SESSION_SECRET is required in production — admin session cookies are " +
        "HMAC-signed with it. Set a strong random value (refusing to use the " +
        "committed dev fallback)."
    );
  }
  return DEV_SESSION_SECRET;
}

/**
 * Whether the static demo bearer token (`demo-member-token`) is honoured.
 * It maps to a real seeded member's Art.9 health data, so it must be OFF in
 * production unless explicitly opted in via `ALLOW_DEMO_TOKEN=true`.
 */
export function demoTokenEnabled(): boolean {
  if (!isProduction()) return true;
  return process.env.ALLOW_DEMO_TOKEN === "true";
}

/**
 * Validate that all required secrets are present. Called from
 * `instrumentation.ts` `register()` so a misconfigured production server fails
 * to boot instead of silently running with forgeable auth. No-op outside prod.
 */
export function assertRequiredSecrets(): void {
  if (!isProduction()) return;
  const missing: string[] = [];
  if (!process.env.SESSION_SECRET) missing.push("SESSION_SECRET");
  if (!process.env.ADMIN_PASSWORD) missing.push("ADMIN_PASSWORD");
  if (missing.length) {
    throw new Error(
      `Missing required production environment variables: ${missing.join(", ")}. ` +
        "Refusing to boot with insecure defaults (see src/lib/env.ts)."
    );
  }
}

/** Constant-time string comparison (avoids `node:crypto` for Edge safety). */
function constantTimeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
}

/**
 * Gate a mock vendor webhook (Stripe / LetsGetChecked) that has no real
 * signature verification yet. Precedence:
 *  1. If the shared secret is CONFIGURED (`<envName>` set), a matching header
 *     is ALWAYS required — dev or prod. This is what real production uses.
 *  2. Otherwise, non-production is OPEN so local e2e can drive it from the
 *     client (the /checkout page fires the webhook from the browser).
 *  3. Otherwise (production, no secret configured), it is OPEN only when the
 *     explicit `ALLOW_OPEN_WEBHOOKS=true` opt-in is set — that keeps the
 *     prod-build e2e/docker stack working. A real deployment sets the secret
 *     (case 1) and never this flag, so unauthenticated calls are rejected.
 *
 * @returns true if the request is authorised.
 */
export function verifyWebhookSecret(
  req: Request,
  envName: string,
  headerName: string
): boolean {
  const secret = process.env[envName];
  if (secret) {
    const provided = req.headers.get(headerName) ?? "";
    return constantTimeEqual(provided, secret);
  }
  if (!isProduction()) return true; // dev/test: open
  if (process.env.ALLOW_OPEN_WEBHOOKS === "true") return true; // local prod build
  return false; // real prod misconfig ⇒ fail closed
}
