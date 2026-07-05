/**
 * Boot-time guard: fail fast if required production secrets are missing, so a
 * misconfigured prod server refuses to start rather than run with forgeable
 * admin auth (see src/lib/env.ts). No-op in dev/test and during `next build`.
 *
 * Also kicks off idempotent index creation (src/lib/ensure-indexes.ts) and the
 * first-boot admin bootstrap (src/lib/admin-auth.ts) — both fire-and-forget so
 * no request ever blocks on them and a Mongo blip never crashes boot.
 */
import { assertRequiredSecrets } from "@/lib/env";

export function register(): void {
  // Only validate when an actual server instance boots — never during the
  // production build phase (no server, and secrets may legitimately be absent).
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  assertRequiredSecrets();

  // These touch Mongo (node-only) — never on the edge runtime, and deliberately
  // un-awaited so boot and the first requests aren't blocked.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    void import("@/lib/ensure-indexes")
      .then((m) => m.ensureIndexes())
      .catch(() => undefined);

    // First-boot bootstrap: if the `admins` collection is empty and ADMIN_EMAIL
    // + ADMIN_PASSWORD are set, create the initial owner so someone can sign in
    // to /admin (the seed script is never run in prod). Idempotent + a no-op
    // once any admin exists. Swallow every error — must never block boot; log a
    // single non-secret line on creation (never the password).
    void import("@/lib/admin-auth")
      .then((m) => m.ensureBootstrapAdmin())
      .then((r) => {
        if (r.created) {
          console.info(`[bootstrap] owner admin created for ${r.email}`);
        }
      })
      .catch(() => undefined);
  }
}
