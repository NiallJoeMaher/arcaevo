/**
 * GET /api/v1/config — PUBLIC runtime configuration (no auth, no secrets).
 *
 * The single source of truth for feature flags that clients (the iOS app in
 * particular) must read at runtime so they can be flipped server-side with no
 * app rebuild. Response shape is a stable, additive contract:
 *
 *   { "bloodTiersEnabled": boolean }
 *
 * `bloodTiersEnabled` mirrors the server-only `bloodTiersEnabled()` gate
 * (env.ts): when false, the paid blood-testing tiers (Essential / Performance
 * + lab-kit / nurse / venous orders + clinician review) are not sold or
 * activatable; Fusion is always available. More public keys may be added here
 * later, but this key stays.
 *
 * `force-dynamic` so the value is evaluated per-request from the environment
 * (flip the env var, no redeploy needed). A short `s-maxage` still lets the CDN
 * cache it briefly — it is public and non-sensitive.
 */
import { bloodTiersEnabled } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(
    { bloodTiersEnabled: bloodTiersEnabled() },
    {
      status: 200,
      headers: {
        "Cache-Control": "public, max-age=30, s-maxage=60, stale-while-revalidate=300",
      },
    }
  );
}
