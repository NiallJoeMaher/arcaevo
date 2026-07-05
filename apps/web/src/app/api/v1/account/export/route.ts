/**
 * GET /api/v1/account/export — the REAL GDPR Article 20 data-portability export
 * (GAP_REVIEW_2 #8). Replaces the old no-op "Export my data" promise.
 *
 * Member-auth ONLY (same posture as /account/delete and /account/portal — the
 * signed-in member's own session/bearer). It resolves the authed member's OWN
 * userId and NEVER accepts a `userId` param: a member exports only their own
 * data, so there is no IDOR surface.
 *
 * It gathers every collection that holds this member's personal / health data
 * (users profile, memberships, test orders, biomarker readings, wearable
 * signals, consents, bloodwork uploads, support tickets, GP share links,
 * referral code + attributed referrals in both directions, gift codes, waitlist
 * entries) and returns them as ONE machine-readable JSON download:
 *   Content-Type: application/json
 *   Content-Disposition: attachment; filename="arcaevo-my-data-<date>.json"
 *
 * NON-NEGOTIABLE: this is an authenticated in-app download only — health data /
 * results are NEVER emailed (project rule). No email is sent from here.
 *
 * REDACTION: internal-only secrets that are NOT the member's personal data are
 * omitted — the scrypt password hash, session tokens, magic-link token/code
 * hashes, and the raw GP-share capability tokens (a live bearer that grants
 * access to health data). Referral records are trimmed to the counts-only GDPR
 * posture: the OTHER party's userId is never disclosed, so a referrer can't
 * learn who they referred (and vice-versa). Everything that IS the member's own
 * PII + health data is included — that is the point of portability.
 *
 * Reads use the default (URI) read preference — a bulk export tolerates a few
 * seconds of replica lag, so we deliberately do NOT pin PRIMARY_READ here (see
 * db.ts). The subject profile comes straight from the auth-resolved user doc.
 */
import { requireMember } from "@/lib/auth";
import { collections } from "@/lib/db";
import type { User } from "@/lib/models";

/** Bumped when the export shape changes, so a consumer can branch on it. */
const EXPORT_SCHEMA_VERSION = 1;

/**
 * Strip the internal-only secret fields off the user profile. Everything else
 * (name, email, join date, lifecycle flags, Stripe customer id, referral
 * attribution) IS the member's own data and is portable.
 */
function sanitizeProfile(user: User): Omit<User, "passwordHash"> {
  // Destructure the secret out; keep the rest verbatim.
  const { passwordHash: _passwordHash, ...profile } = user;
  return profile;
}

function dateStamp(now: Date): string {
  // YYYY-MM-DD in Europe/Dublin (the member's jurisdiction).
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Europe/Dublin",
  }).format(now);
}

export async function GET(req: Request) {
  const auth = await requireMember(req);
  if (auth.denied) return auth.denied;
  const member = auth.member;

  const userId = member._id; // OWN id only — never read from the request.
  const email = member.email.toLowerCase();

  const [
    memberships,
    testOrders,
    biomarkerReadings,
    wearableSignals,
    consents,
    bloodworkUploads,
    supportTickets,
    shareLinks,
    referralCodes,
    referrals,
    giftCodes,
    waitlist,
  ] = await Promise.all([
    collections.memberships(),
    collections.testOrders(),
    collections.biomarkerReadings(),
    collections.wearableSignals(),
    collections.consents(),
    collections.bloodworkUploads(),
    collections.supportTickets(),
    collections.shareLinks(),
    collections.referralCodes(),
    collections.referrals(),
    collections.giftCodes(),
    collections.waitlist(),
  ]);

  const [
    membershipDocs,
    orderDocs,
    readingDocs,
    wearableDocs,
    consentDocs,
    uploadDocs,
    ticketDocs,
    shareDocs,
    referralCodeDoc,
    referralsAsReferrer,
    referralsAsReferred,
    giftsPurchased,
    giftsRedeemed,
    waitlistDocs,
  ] = await Promise.all([
    memberships.find({ memberId: userId }).toArray(),
    testOrders.find({ memberId: userId }).toArray(),
    biomarkerReadings.find({ memberId: userId }).toArray(),
    wearableSignals.find({ memberId: userId }).toArray(),
    consents.find({ userId }).toArray(),
    bloodworkUploads.find({ memberId: userId }).toArray(),
    supportTickets.find({ memberId: userId }).toArray(),
    shareLinks.find({ userId }).toArray(),
    referralCodes.findOne({ userId }),
    referrals.find({ referrerUserId: userId }).toArray(),
    referrals.find({ referredUserId: userId }).toArray(),
    giftCodes.find({ purchaserEmail: email }).toArray(),
    giftCodes.find({ redeemedBy: userId }).toArray(),
    waitlist.find({ email }).toArray(),
  ]);

  // GP-share links: keep the member's own link metadata + access log, but
  // redact the raw capability token (a live bearer to Art.9 data).
  const shareLinksExport = shareDocs.map(({ token: _token, ...rest }) => ({
    ...rest,
    token: "[redacted — live GP-share capability token]",
  }));

  // Referrals, counts-only posture: never disclose the OTHER member's userId.
  // NB a referral's `_id` IS the referred member's userId (see models.ts), so
  // for the "as referrer" direction we drop BOTH `_id` and `referredUserId`
  // — otherwise the referee's id would leak back to the referrer via `_id`.
  const referralsReferrerExport = referralsAsReferrer.map(
    ({ _id: _dropId, referredUserId: _referredUserId, ...rest }) => rest
  );
  // As the referred party, `_id` == this member's own id (fine to keep); only
  // the referrer's id identifies someone else, so drop that.
  const referralsReferredExport = referralsAsReferred.map(
    ({ referrerUserId: _referrerUserId, ...rest }) => rest
  );

  const payload = {
    meta: {
      exportedAt: new Date().toISOString(),
      subjectUserId: userId,
      subjectEmail: member.email,
      schemaVersion: EXPORT_SCHEMA_VERSION,
      basis:
        "GDPR Article 20 (right to data portability). This file contains the " +
        "personal data Arcaevo holds about you — the requesting member — " +
        "exported in a structured, machine-readable format for your own use. " +
        "Internal security secrets (password hash, session and magic-link " +
        "tokens, GP-share capability tokens) are omitted, and other members' " +
        "identities in your referral history are not disclosed.",
    },
    profile: sanitizeProfile(member),
    memberships: membershipDocs,
    testOrders: orderDocs,
    biomarkerReadings: readingDocs,
    wearableSignals: wearableDocs,
    consents: consentDocs,
    bloodworkUploads: uploadDocs,
    supportTickets: ticketDocs,
    shareLinks: shareLinksExport,
    referralCode: referralCodeDoc,
    referrals: {
      asReferrer: referralsReferrerExport,
      asReferred: referralsReferredExport,
    },
    giftCodes: {
      purchased: giftsPurchased,
      redeemed: giftsRedeemed,
    },
    waitlist: waitlistDocs,
  };

  const filename = `arcaevo-my-data-${dateStamp(new Date())}.json`;

  return new Response(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      // A member's own health data — never let a shared cache retain it.
      "Cache-Control": "no-store",
    },
  });
}
