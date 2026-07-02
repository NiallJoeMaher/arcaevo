/**
 * GDPR Art. 9(2)(a) consent bookkeeping (design_handoff_v2 §04).
 *
 * Consents are APPEND-ONLY: every grant/withdrawal is a new document with
 * timestamp, wording version and surface — the audit trail the DPC expects.
 * "Current" state = the latest document per purpose.
 *
 * Re-consent: if the latest health_processing grant predates CONSENT_VERSION,
 * the member is shown the consent screen again on next sign-in.
 */
import { collections } from "@/lib/db";
import {
  CONSENT_VERSION,
  ConsentPurpose,
  type Consent,
  type ConsentSurface,
} from "@/lib/models";

export interface ConsentState {
  /** Latest decision per purpose (missing = never asked/answered). */
  current: Consent[];
  /** No valid health_processing grant → the consent gate must be shown. */
  needsConsent: boolean;
  /** Granted on an older wording version → re-consent screen on sign-in. */
  needsReconsent: boolean;
}

/** Latest consent document per purpose for a user. */
export async function latestConsents(userId: string): Promise<Consent[]> {
  const all = await collections
    .consents()
    .then((c) => c.find({ userId }).sort({ timestamp: 1 }).toArray());
  const byPurpose = new Map<string, Consent>();
  for (const consent of all) byPurpose.set(consent.purpose, consent); // last wins
  return [...byPurpose.values()];
}

export async function consentState(userId: string): Promise<ConsentState> {
  const current = await latestConsents(userId);
  const health = current.find((c) => c.purpose === "health_processing");
  const needsConsent = !health?.granted;
  const needsReconsent =
    !!health?.granted && health.version !== CONSENT_VERSION;
  return { current, needsConsent, needsReconsent };
}

/** Record a batch of decisions (append-only; versioned with CONSENT_VERSION). */
export async function recordConsents(
  userId: string,
  grants: { purpose: ConsentPurpose; granted: boolean }[],
  surface: ConsentSurface,
  now: Date = new Date()
): Promise<Consent[]> {
  const consents = await collections.consents();
  const count = await consents.countDocuments();
  const docs: Consent[] = grants.map((grant, i) => ({
    _id: `consent_${String(count + i + 1).padStart(4, "0")}`,
    userId,
    purpose: grant.purpose,
    granted: grant.granted,
    version: CONSENT_VERSION,
    timestamp: now,
    surface,
  }));
  if (docs.length) await consents.insertMany(docs);
  return docs;
}
