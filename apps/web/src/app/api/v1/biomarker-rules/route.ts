/**
 * GET /api/v1/biomarker-rules — PUBLIC canonical RCV thresholds (no auth, no
 * secrets).
 *
 * The SINGLE SOURCE OF TRUTH for each biomarker's Reference Change Value (the
 * per-marker % a reading must move before a change is "real" vs noise), served
 * so the iOS app can fetch the live values at runtime instead of relying only
 * on hardcoded Swift constants that drift out of sync. Response shape is a
 * stable, additive contract:
 *
 *   { "rules": [ { "code": "apob", "rcvPercent": 10, "unit": "g/L",
 *                  "direction": "lower_is_better" }, … ] }
 *
 * iOS prefers these values and FALLS BACK to its matching hardcoded constants
 * on any failure, so the two engines can never silently disagree while online
 * and stay in lockstep offline (a parity test on each side guards the fallback).
 *
 * `force-dynamic` so a threshold change ships with no CDN staleness surprise;
 * a short `s-maxage` still lets the CDN cache it briefly — it is public and
 * non-sensitive.
 */
import { publicBiomarkerRules } from "@/lib/biomarker-rules";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(
    { rules: publicBiomarkerRules() },
    {
      status: 200,
      headers: {
        "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
      },
    }
  );
}
