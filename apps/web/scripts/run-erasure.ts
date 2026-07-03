/**
 * Arcaevo GDPR erasure runner — `npm run erase:run` (tsx scripts/run-erasure.ts).
 *
 * Drains the `erasure_jobs` queue: every scheduled job whose 30-day grace
 * window (eraseAfter) has passed is executed — the member's PII/health data is
 * hard-deleted across ALL collections EXCEPT the append-only consent audit
 * trail (retained as proof the erasure happened; see src/lib/erasure.ts) — and
 * the job is marked "done".
 *
 * Idempotent + safe to run repeatedly. In production a scheduled invoker
 * (cron / EventBridge → Lambda, or a Vercel Cron) MUST call this daily; that
 * is the "operationally guaranteed" half of the erasure promise. See
 * docs/MOCKED_APIS.md.
 *
 * Nothing is deleted early: a job stays put until now >= eraseAfter.
 */
import { closeClient } from "../src/lib/db";
import { runDueErasures } from "../src/lib/erasure";

async function main() {
  const now = new Date();
  console.log(`[erase:run] scanning erasure_jobs at ${now.toISOString()}…`);

  const { executed, pending } = await runDueErasures(now);

  if (executed.length === 0) {
    console.log(
      `[erase:run] nothing due. ${pending} scheduled job(s) still inside their grace window.`
    );
  }
  for (const { job, counts } of executed) {
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    console.log(
      `[erase:run] erased ${job.userId} (${job.email}) — ${total} docs across ${
        Object.keys(counts).length
      } collections; consent audit trail retained:`
    );
    console.table(counts);
  }
  console.log(
    `[erase:run] done. executed ${executed.length}, ${pending} still pending.`
  );
}

main()
  .catch((err) => {
    console.error("[erase:run] failed:", err);
    process.exitCode = 1;
  })
  .finally(() => closeClient());
