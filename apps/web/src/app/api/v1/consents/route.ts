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
import { parseJsonBody } from "@/lib/api";
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
  const state = await consentState(auth.member._id);

  // Withdrawing the required purpose triggers the account-closure flow
  // (with a full export offered first — design §04/§10).
  const withdrewRequired = grants.some(
    (g) => g.purpose === "health_processing" && !g.granted
  );

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
