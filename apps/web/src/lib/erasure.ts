/**
 * GDPR Art. 17 right-to-erasure execution.
 *
 * `eraseUserData` hard-deletes one member's PII/health data across EVERY
 * collection that holds it — EXCEPT the append-only consent audit trail
 * (`consents`) and the `erasure_jobs` record itself, which are RETAINED so
 * Arcaevo can prove to the DPC that a lawful erasure happened, and when.
 * (DPC guidance: keeping the minimal record of the erasure request + consent
 * decisions is compatible with Art.17 — it is the evidence the erasure was
 * performed, not the personal data being erased.)
 *
 * `runDueErasures` drains the queue: every `erasure_jobs` doc whose
 * `eraseAfter` has passed and is still "scheduled" is executed, then marked
 * "done". Idempotent — re-running deletes nothing new and skips done jobs; a
 * job whose user is already gone simply deletes zero rows and completes.
 *
 * The scheduled runner is scripts/run-erasure.ts (`npm run erase:run`); in
 * production a cron/Lambda must invoke it (documented in docs/MOCKED_APIS.md).
 */
import { collections } from "@/lib/db";
import type { ErasureJob } from "@/lib/models";

/** Per-collection deleted-document counts (audit trail retained, not counted). */
export interface ErasureCounts {
  users: number;
  memberships: number;
  testOrders: number;
  biomarkerReadings: number;
  wearableSignals: number;
  bloodworkUploads: number;
  sessions: number;
  shareLinks: number;
  referralCodes: number;
  giftCodes: number;
  supportTickets: number;
  waitlist: number;
  magicLinkTokens: number;
  outbox: number;
}

/**
 * Hard-delete every trace of one member EXCEPT the consent audit trail.
 * `email` is needed for the collections keyed by email, not memberId
 * (outbox, waitlist, magic links, purchased gift codes).
 */
export async function eraseUserData(
  userId: string,
  email: string
): Promise<ErasureCounts> {
  const lowerEmail = email.toLowerCase();

  const [
    users,
    memberships,
    testOrders,
    biomarkerReadings,
    wearableSignals,
    bloodworkUploads,
    sessions,
    shareLinks,
    referralCodes,
    giftCodes,
    supportTickets,
    waitlist,
    magicLinkTokens,
    outbox,
  ] = await Promise.all([
    collections.users(),
    collections.memberships(),
    collections.testOrders(),
    collections.biomarkerReadings(),
    collections.wearableSignals(),
    collections.bloodworkUploads(),
    collections.sessions(),
    collections.shareLinks(),
    collections.referralCodes(),
    collections.giftCodes(),
    collections.supportTickets(),
    collections.waitlist(),
    collections.magicLinkTokens(),
    collections.outbox(),
  ]);

  // gift codes the member OWNS (purchased) OR redeemed — both carry their PII.
  const [giftPurchased, giftRedeemed] = await Promise.all([
    giftCodes.deleteMany({ purchaserEmail: lowerEmail }),
    giftCodes.deleteMany({ redeemedBy: userId }),
  ]);

  const [
    usersDel,
    membershipsDel,
    ordersDel,
    readingsDel,
    wearablesDel,
    uploadsDel,
    sessionsDel,
    sharesDel,
    referralsDel,
    ticketsDel,
    waitlistDel,
    magicDel,
    outboxDel,
  ] = await Promise.all([
    users.deleteMany({ _id: userId }),
    memberships.deleteMany({ memberId: userId }),
    testOrders.deleteMany({ memberId: userId }),
    biomarkerReadings.deleteMany({ memberId: userId }),
    wearableSignals.deleteMany({ memberId: userId }),
    bloodworkUploads.deleteMany({ memberId: userId }),
    sessions.deleteMany({ userId }),
    shareLinks.deleteMany({ userId }),
    referralCodes.deleteMany({ userId }),
    supportTickets.deleteMany({ memberId: userId }),
    waitlist.deleteMany({ email: lowerEmail }),
    magicLinkTokens.deleteMany({ email: lowerEmail }),
    outbox.deleteMany({ to: lowerEmail }),
  ]);

  return {
    users: usersDel.deletedCount,
    memberships: membershipsDel.deletedCount,
    testOrders: ordersDel.deletedCount,
    biomarkerReadings: readingsDel.deletedCount,
    wearableSignals: wearablesDel.deletedCount,
    bloodworkUploads: uploadsDel.deletedCount,
    sessions: sessionsDel.deletedCount,
    shareLinks: sharesDel.deletedCount,
    referralCodes: referralsDel.deletedCount,
    giftCodes: giftPurchased.deletedCount + giftRedeemed.deletedCount,
    supportTickets: ticketsDel.deletedCount,
    waitlist: waitlistDel.deletedCount,
    magicLinkTokens: magicDel.deletedCount,
    outbox: outboxDel.deletedCount,
  };
}

export interface ErasureRun {
  executed: { job: ErasureJob; counts: ErasureCounts }[];
  /** Scheduled jobs found whose grace window has not yet elapsed. */
  pending: number;
}

/** Execute every due, scheduled erasure job; mark each "done". Idempotent. */
export async function runDueErasures(now: Date = new Date()): Promise<ErasureRun> {
  const jobsCol = await collections.erasureJobs();
  const usersCol = await collections.users();

  const scheduled = await jobsCol.find({ status: "scheduled" }).toArray();
  const due = scheduled.filter((j) => j.eraseAfter.getTime() <= now.getTime());
  const pending = scheduled.length - due.length;

  const executed: ErasureRun["executed"] = [];
  for (const job of due) {
    const counts = await eraseUserData(job.userId, job.email);
    // Retain the job as the erasure record; flag the user "closed" if the doc
    // somehow survives (it won't after the delete above, but stay defensive).
    await Promise.all([
      jobsCol.updateOne(
        { _id: job._id },
        { $set: { status: "done", completedAt: now } }
      ),
      usersCol.updateOne(
        { _id: job.userId },
        { $set: { status: "closed", processingSuspended: true } }
      ),
    ]);
    executed.push({ job, counts });
  }

  return { executed, pending };
}
