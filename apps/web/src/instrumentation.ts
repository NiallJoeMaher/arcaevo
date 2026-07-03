/**
 * Boot-time guard: fail fast if required production secrets are missing, so a
 * misconfigured prod server refuses to start rather than run with forgeable
 * admin auth (see src/lib/env.ts). No-op in dev/test and during `next build`.
 */
import { assertRequiredSecrets } from "@/lib/env";

export function register(): void {
  // Only validate when an actual server instance boots — never during the
  // production build phase (no server, and secrets may legitimately be absent).
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  assertRequiredSecrets();
}
