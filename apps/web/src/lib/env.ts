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
 * Whether the password-only BOOTSTRAP OWNER login (the shared `ADMIN_PASSWORD`
 * break-glass path) is DISABLED. Set `ADMIN_BOOTSTRAP_DISABLED=true` in prod
 * once a real owner account exists + has MFA enrolled, so the shared-secret
 * owner credential (security audit finding A-1) can no longer be used at all.
 * OFF by default so dev, first-login and the e2e password flow are unaffected.
 */
export function adminBootstrapDisabled(): boolean {
  return process.env.ADMIN_BOOTSTRAP_DISABLED === "true";
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
  // ADMIN_PASSWORD is only required while the bootstrap owner login is enabled.
  // Once ADMIN_BOOTSTRAP_DISABLED=true (a real MFA-enrolled owner exists), prod
  // can — and should — boot without the shared break-glass password (A-1 fix).
  if (!adminBootstrapDisabled() && !process.env.ADMIN_PASSWORD) {
    missing.push("ADMIN_PASSWORD");
  }
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

/**
 * Authorise a scheduled cron invocation of a secured route (e.g. the GDPR
 * erasure runner). Vercel Cron sets `Authorization: Bearer $CRON_SECRET` on
 * every scheduled request. Precedence mirrors `verifyWebhookSecret`:
 *  1. If `CRON_SECRET` is configured, a matching bearer header is ALWAYS
 *     required (dev or prod). This is what real production uses.
 *  2. Otherwise, non-production is OPEN so a developer can trigger the route by
 *     hand (curl) with zero config.
 *  3. Otherwise (production, no secret configured) it is REJECTED — fail closed
 *     rather than expose an unauthenticated data-deletion endpoint.
 */
export function cronRequestAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const provided = req.headers.get("authorization") ?? "";
    return constantTimeEqual(provided, `Bearer ${secret}`);
  }
  if (!isProduction()) return true; // dev/test: allow manual triggering
  return false; // real prod misconfig ⇒ fail closed
}

/**
 * Whether the MOCK AI bloodwork extraction (`ai-extraction.mock.ts`, which
 * fabricates plausible marker values from a hash of the file name) is allowed
 * to run. It must be OFF for real users — a real person would otherwise
 * "confirm" invented numbers as their own health data. When OFF, the photo/PDF
 * upload path returns an honest `manualEntryRequired` state and routes the user
 * to manual hand-entry (which is real and safe). Auto-ON in non-production (so
 * dev + e2e keep exercising the mock, incl. the "41 or 47?" demo); in
 * production it is OFF unless explicitly opted in via `ALLOW_MOCK_EXTRACTION`.
 */
export function mockExtractionEnabled(): boolean {
  if (!isProduction()) return true;
  return process.env.ALLOW_MOCK_EXTRACTION === "true";
}

/**
 * Whether the paid BLOOD-TESTING tiers are available to buy / activate.
 *
 * Covers Essential (€329) + Performance (€399), the lab-kit / nurse / venous
 * order types + add-ons, and the clinician-reviewed-results service. The Fusion
 * tier (€119 — Apple Watch + user-uploaded bloods, no kit/nurse/clinician) is
 * ALWAYS available and is never gated by this flag.
 *
 * FAIL-SAFE OFF: enabled ONLY when `BLOOD_TIERS_ENABLED` is exactly "true".
 * Unset / anything-else = DISABLED — so production never sells a blood tier it
 * cannot yet fulfil (no lab/phlebotomy partner or real clinician live). Dev and
 * pre-prod set `BLOOD_TIERS_ENABLED=true` (plus the `NEXT_PUBLIC_` mirror for
 * client UI). This is the SERVER-ONLY source of truth; it is enforced in the
 * checkout / orders / gift routes and exposed publicly (no secrets) via
 * `GET /api/v1/config` so the iOS app can read it at runtime with no rebuild.
 */
export function bloodTiersEnabled(): boolean {
  return process.env.BLOOD_TIERS_ENABLED === "true";
}

/**
 * Whether IP rate-limiting is enforced (auth endpoints). ON everywhere by
 * default; a local prod-build stack (e2e) can opt out with
 * `RATE_LIMIT_DISABLED=true` so many scripted sign-in attempts from one host
 * don't trip the limiter and flake the suite. Real production leaves it unset.
 */
export function rateLimitingEnabled(): boolean {
  return process.env.RATE_LIMIT_DISABLED !== "true";
}
