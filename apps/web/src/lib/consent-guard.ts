/**
 * GDPR Art. 9(2)(a) consent ENFORCEMENT (design_handoff_v2 §04).
 *
 * The consent screen is not decorative: no endpoint may read or write a
 * member's Art.9 health data without a *current, granted* health_processing
 * consent. `requireConsentedMember` composes the existing member auth
 * (auth.ts requireMember) with a live consent check, and returns the SAME
 * `{ member } | { denied }` shape so routes adopt it with a one-line change:
 *
 *   const auth = await requireConsentedMember(req);
 *   if (auth.denied) return auth.denied;
 *   auth.member // typed User, consent verified
 *
 * Withdrawal = immediate stop. When health_processing is withdrawn, the
 * member's sessions are revoked (so live cookies/bearers die at once) and the
 * user is flagged `processingSuspended` — this guard then refuses them even if
 * a stale session somehow survives, until they re-consent.
 */
import { requireMember } from "@/lib/auth";
import { consentState } from "@/lib/consents";
import { collections } from "@/lib/db";
import { revokeSessions } from "@/lib/member-auth";
import type { User } from "@/lib/models";

export type ConsentedResult =
  | { member: User; denied: null }
  | { member: null; denied: Response };

export interface ConsentGuardOptions {
  /** Also require a current, granted `clinician_review` consent (ordering a
   * test a clinician must sign off — design §04 "REQUIRED FOR TESTS"). */
  clinicianReview?: boolean;
}

function consentRequired(purpose: "health_processing" | "clinician_review"): Response {
  const message =
    purpose === "health_processing"
      ? "Consent to process your health data is required — and it has been withdrawn or never granted. Re-consent to continue."
      : "Clinician review consent is required for this action, and it isn't granted.";
  return Response.json(
    { error: "consent_required", message, needsConsent: true, purpose },
    { status: 403 }
  );
}

/**
 * Member auth PLUS a live Art.9 consent check. 401 when not signed in
 * (delegated to requireMember), 403 `consent_required` when consent is
 * absent, withdrawn, or the account is suspended/closing.
 */
export async function requireConsentedMember(
  req: Request,
  options: ConsentGuardOptions = {}
): Promise<ConsentedResult> {
  const auth = await requireMember(req);
  if (auth.denied) return auth; // not signed in → 401

  const member = auth.member;

  // Closure / suspension is a hard stop regardless of the consent trail —
  // processing has been ordered to cease.
  if (
    member.processingSuspended ||
    member.status === "closing" ||
    member.status === "closed"
  ) {
    return { member: null, denied: consentRequired("health_processing") };
  }

  const state = await consentState(member._id);
  if (state.needsConsent) {
    return { member: null, denied: consentRequired("health_processing") };
  }

  if (options.clinicianReview) {
    const cr = state.current.find((c) => c.purpose === "clinician_review");
    if (!cr?.granted) {
      return { member: null, denied: consentRequired("clinician_review") };
    }
  }

  return { member, denied: null };
}

/**
 * Consent withdrawal → immediate stop. Flags the user so the guard refuses
 * them, revokes every session so live cookies/bearers stop working at once,
 * AND revokes every public GP share link the member issued — otherwise the
 * public /s/[token] endpoint would keep serving their Art.9 lab values for up
 * to the link's 30-day TTL against withdrawn consent (security audit W-1).
 * Owned here (not auth.ts) — the withdrawal→revocation link is consent policy.
 *
 * Idempotent: safe to call again on an already-suspended member (re-flagging
 * and re-revoking already-revoked links are both no-ops).
 */
export async function suspendProcessingForWithdrawal(
  userId: string,
  now: Date = new Date()
): Promise<{ sessionsRevoked: number; shareLinksRevoked: number }> {
  const users = await collections.users();
  await users.updateOne(
    { _id: userId },
    {
      $set: {
        processingSuspended: true,
        status: "closing",
        closureRequestedAt: now,
      },
    }
  );
  const shareLinks = await collections.shareLinks();
  const shareResult = await shareLinks.updateMany(
    { userId, revoked: { $ne: true } },
    { $set: { revoked: true } }
  );
  const sessionsRevoked = await revokeSessions(userId);
  return {
    sessionsRevoked,
    shareLinksRevoked: shareResult.modifiedCount ?? 0,
  };
}
