/**
 * /api/v1/consents (member auth — bearer or session cookie)
 *
 *  GET  — current grants per purpose + whether the consent gate / re-consent
 *         screen must be shown (design §04).
 *  POST — record decisions (grant AND withdraw are both POSTs of granted:
 *         true/false — the trail is append-only, versioned, with surface).
 *         Withdrawing health_processing starts account closure (flagged in
 *         the response; the closure flow itself is §10, Phase 11 UI).
 */
import { requireMember } from "@/lib/auth";
import { AnalyticsEvent, capture } from "@/lib/analytics";
import { parseJsonBody } from "@/lib/api";
import { suspendProcessingForWithdrawal } from "@/lib/consent-guard";
import { consentState, recordConsents } from "@/lib/consents";
import { CONSENT_VERSION, ConsentGrantInput } from "@/lib/models";

export async function GET(req: Request) {
  const auth = await requireMember(req);
  if (auth.denied) return auth.denied;

  const state = await consentState(auth.member._id);
  return Response.json({
    version: CONSENT_VERSION,
    consents: state.current.map((c) => ({
      purpose: c.purpose,
      granted: c.granted,
      version: c.version,
      timestamp: c.timestamp,
      surface: c.surface,
    })),
    needsConsent: state.needsConsent,
    needsReconsent: state.needsReconsent,
  });
}

export async function POST(req: Request) {
  const auth = await requireMember(req);
  if (auth.denied) return auth.denied;

  const parsed = await parseJsonBody(req, ConsentGrantInput);
  if (!parsed.ok) return parsed.response;
  const { grants, surface } = parsed.data;

  await recordConsents(auth.member._id, grants, surface);

  // Funnel: consent gate cleared (the required health_processing grant). Enum
  // surface + count only — never the grant contents.
  if (grants.some((g) => g.purpose === "health_processing" && g.granted)) {
    capture(
      AnalyticsEvent.ConsentGranted,
      { surface, version: CONSENT_VERSION, grants: grants.length },
      auth.member._id
    );
  }

  // Withdrawing the required purpose = immediate stop: flag the account and
  // revoke every session so live cookies/bearers die at once (design §04/§10).
  // The full deletion (erasure job + confirmation email) is POST
  // /api/v1/account/delete; this path is the safety net for a bare withdrawal.
  const withdrewRequired = grants.some(
    (g) => g.purpose === "health_processing" && !g.granted
  );
  if (withdrewRequired) {
    await suspendProcessingForWithdrawal(auth.member._id);
  }

  const state = await consentState(auth.member._id);

  return Response.json({
    ok: true,
    version: CONSENT_VERSION,
    consents: state.current.map((c) => ({
      purpose: c.purpose,
      granted: c.granted,
      version: c.version,
      timestamp: c.timestamp,
      surface: c.surface,
    })),
    needsConsent: state.needsConsent,
    closureRequired: withdrewRequired,
  });
}
