/**
 * Boot-time guard: fail fast if required production secrets are missing, so a
 * misconfigured prod server refuses to start rather than run with forgeable
 * admin auth (see src/lib/env.ts). No-op in dev/test and during `next build`.
 *
 * Also kicks off idempotent index creation (src/lib/ensure-indexes.ts) —
 * fire-and-forget so no request ever blocks on it.
 */
import { assertRequiredSecrets } from "@/lib/env";

export function register(): void {
  // Only validate when an actual server instance boots — never during the
  // production build phase (no server, and secrets may legitimately be absent).
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  assertRequiredSecrets();

  // Index creation touches Mongo (node-only) — never on the edge runtime, and
  // deliberately un-awaited so boot and the first requests aren't blocked.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    void import("@/lib/ensure-indexes")
      .then((m) => m.ensureIndexes())
      .catch(() => undefined);
  }
}
