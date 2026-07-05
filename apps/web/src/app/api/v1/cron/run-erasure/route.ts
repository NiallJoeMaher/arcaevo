/**
 * GET|POST /api/v1/cron/run-erasure — scheduled GDPR Art.17 erasure drain
 * (audit must-fix #1). This is the operationally-guaranteed half of the
 * "erased within 30 days" promise: a Vercel Cron (see apps/web/vercel.json)
 * hits this daily and it drains every due `erasure_jobs` doc via the SAME
 * `runDueErasures()` the CLI runner (`npm run erase:run`) uses. The CLI stays
 * as the AWS/manual fallback.
 *
 * SECURITY: gated by `cronRequestAuthorized` (src/lib/env.ts). Vercel sets
 * `Authorization: Bearer $CRON_SECRET` on cron requests; when `CRON_SECRET` is
 * configured a matching bearer is required in every environment, and in
 * production WITHOUT the secret the route fails closed (401). Dev/e2e without a
 * secret is open so it can be triggered by hand.
 *
 * The response carries only counts + internal user ids — NEVER any health
 * values (consistent with the E12 closure email + the audit posture).
 */
import { runDueErasures } from "@/lib/erasure";
import { cronRequestAuthorized } from "@/lib/env";

// Never statically optimised — it mutates the database on every call.
export const dynamic = "force-dynamic";

async function handle(req: Request): Promise<Response> {
  if (!cronRequestAuthorized(req)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const { executed, pending } = await runDueErasures();

  return Response.json({
    ok: true,
    ranAt: new Date().toISOString(),
    executed: executed.length,
    pending,
    // Minimal per-job proof-of-run: internal id + total docs erased. No PII
    // values, no per-collection health detail beyond the aggregate count.
    erased: executed.map(({ job, counts }) => ({
      userId: job.userId,
      docsErased: Object.values(counts).reduce((a, b) => a + b, 0),
    })),
  });
}

export const GET = handle;
export const POST = handle;
