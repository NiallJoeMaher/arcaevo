/**
 * POST /api/v1/account/delete — the real, honest account deletion (design §10
 * W11 "Delete everything"). Requires member auth (the person is signed in when
 * they arm type-DELETE).
 *
 * This is the truth behind the UI's promise. In one atomic-enough flow it:
 *  1. records the health_processing withdrawal in the append-only consent
 *     trail (the audit entry the DPC expects),
 *  2. flags the user `status:"closing"` + `closureRequestedAt` and revokes
 *     every session (via suspendProcessingForWithdrawal) so access stops now,
 *  3. enqueues a real `erasure_jobs` doc { eraseAfter: +30d } that the
 *     scheduled runner (scripts/run-erasure.ts) hard-deletes the data on,
 *  4. sends the E12 closure-confirmation email with the +30-day erasure date
 *     (NO health values).
 *
 * Idempotent: a second call while already closing just re-confirms and does
 * not queue a duplicate erasure job.
 */
import { requireMember } from "@/lib/auth";
import { siteUrl } from "@/lib/api";
import { suspendProcessingForWithdrawal } from "@/lib/consent-guard";
import { recordConsents } from "@/lib/consents";
import { collections } from "@/lib/db";
import { sendEmail } from "@/lib/emails";
import { ERASURE_GRACE_DAYS, type ConsentSurface, type ErasureJob } from "@/lib/models";

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-IE", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Dublin",
  });
}

export async function POST(req: Request) {
  const auth = await requireMember(req);
  if (auth.denied) return auth.denied;
  const member = auth.member;

  // Optional surface hint (web|ios) for the consent audit entry.
  let surface: ConsentSurface = "web";
  try {
    const body = (await req.json()) as { surface?: unknown };
    if (body?.surface === "ios") surface = "ios";
  } catch {
    /* body is optional */
  }

  const now = new Date();
  const eraseAfter = new Date(
    now.getTime() + ERASURE_GRACE_DAYS * 24 * 60 * 60 * 1000
  );

  // 1. Append the withdrawal to the consent audit trail.
  await recordConsents(
    member._id,
    [{ purpose: "health_processing", granted: false }],
    surface,
    now
  );

  // 2. Stop processing immediately: flag + revoke all sessions.
  const { sessionsRevoked } = await suspendProcessingForWithdrawal(
    member._id,
    now
  );

  // 3. Enqueue the erasure job (idempotent — one scheduled job per member).
  const jobs = await collections.erasureJobs();
  const existing = await jobs.findOne({
    userId: member._id,
    status: "scheduled",
  });
  if (!existing) {
    const count = await jobs.countDocuments();
    const job: ErasureJob = {
      _id: `erasure_${String(count + 1).padStart(4, "0")}`,
      userId: member._id,
      email: member.email,
      requestedAt: now,
      eraseAfter,
      status: "scheduled",
      completedAt: null,
    };
    await jobs.insertOne(job);
  }
  const effectiveEraseAfter = existing?.eraseAfter ?? eraseAfter;

  // 4. Confirmation email — the +30d date, never a health value.
  await sendEmail("e12_closure_confirmation", member.email, {
    firstName: member.name.split(" ")[0] || member.name,
    erasureDateLabel: formatDate(effectiveEraseAfter),
    appUrl: siteUrl(),
  });

  return Response.json({
    ok: true,
    status: "closing",
    closureRequestedAt: now,
    eraseAfter: effectiveEraseAfter,
    sessionsRevoked,
    message:
      "Your account is closing. Processing has stopped, every session is signed out, and your data is scheduled for permanent erasure within 30 days. A confirmation email with the date is on its way.",
  });
}
