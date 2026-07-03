/**
 * Unit tests for src/lib/consent-guard.ts — GDPR Art.9 consent ENFORCEMENT.
 *
 * The guard composes three collaborators (requireMember, consentState,
 * revokeSessions); each is mocked so we test only the guard's own decision
 * logic and its 403 envelope. Real end-to-end enforcement is covered by the
 * e2e spec (no-consent member → 403, then 200 after consenting).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Consent, User } from "@/lib/models";

const requireMember = vi.fn();
const consentState = vi.fn();
const revokeSessions = vi.fn();
const updateOne = vi.fn();

vi.mock("@/lib/auth", () => ({ requireMember: (req: Request) => requireMember(req) }));
vi.mock("@/lib/consents", () => ({ consentState: (id: string) => consentState(id) }));
vi.mock("@/lib/member-auth", () => ({
  revokeSessions: (id: string) => revokeSessions(id),
}));
vi.mock("@/lib/db", () => ({
  collections: { users: async () => ({ updateOne }) },
}));

import {
  requireConsentedMember,
  suspendProcessingForWithdrawal,
} from "@/lib/consent-guard";

const MEMBER = { _id: "mem_0001", email: "a@b.ie", name: "Aoife Byrne" } as User;

function grant(purpose: Consent["purpose"], granted: boolean): Consent {
  return {
    _id: `c_${purpose}`,
    userId: MEMBER._id,
    purpose,
    granted,
    version: "2026-07-01",
    timestamp: new Date(),
    surface: "web",
  };
}

const req = new Request("http://localhost/api/v1/results");

beforeEach(() => {
  vi.clearAllMocks();
  requireMember.mockResolvedValue({ member: MEMBER, denied: null });
  revokeSessions.mockResolvedValue(2);
  updateOne.mockResolvedValue({});
});

describe("requireConsentedMember", () => {
  it("passes through the 401 when the member isn't signed in", async () => {
    const denied = Response.json({ error: "unauthorized" }, { status: 401 });
    requireMember.mockResolvedValue({ member: null, denied });
    const auth = await requireConsentedMember(req);
    expect(auth.denied).toBe(denied);
    expect(consentState).not.toHaveBeenCalled();
  });

  it("returns the member (200-path) when health_processing is granted", async () => {
    consentState.mockResolvedValue({
      current: [grant("health_processing", true)],
      needsConsent: false,
      needsReconsent: false,
    });
    const auth = await requireConsentedMember(req);
    expect(auth.denied).toBeNull();
    expect(auth.member).toBe(MEMBER);
  });

  it("403 consent_required when consent was never granted / withdrawn", async () => {
    consentState.mockResolvedValue({
      current: [grant("health_processing", false)],
      needsConsent: true,
      needsReconsent: false,
    });
    const auth = await requireConsentedMember(req);
    expect(auth.member).toBeNull();
    expect(auth.denied!.status).toBe(403);
    const body = await auth.denied!.json();
    expect(body.error).toBe("consent_required");
    expect(body.needsConsent).toBe(true);
  });

  it("403 when the account is suspended, without even reading consents", async () => {
    requireMember.mockResolvedValue({
      member: { ...MEMBER, processingSuspended: true },
      denied: null,
    });
    const auth = await requireConsentedMember(req);
    expect(auth.denied!.status).toBe(403);
    expect(consentState).not.toHaveBeenCalled();
  });

  it("403 when the account is closing", async () => {
    requireMember.mockResolvedValue({
      member: { ...MEMBER, status: "closing" },
      denied: null,
    });
    const auth = await requireConsentedMember(req);
    expect(auth.denied!.status).toBe(403);
  });

  it("requires clinician_review when asked (granted → pass, missing → 403)", async () => {
    consentState.mockResolvedValue({
      current: [grant("health_processing", true), grant("clinician_review", true)],
      needsConsent: false,
      needsReconsent: false,
    });
    const ok = await requireConsentedMember(req, { clinicianReview: true });
    expect(ok.denied).toBeNull();

    consentState.mockResolvedValue({
      current: [grant("health_processing", true), grant("clinician_review", false)],
      needsConsent: false,
      needsReconsent: false,
    });
    const denied = await requireConsentedMember(req, { clinicianReview: true });
    expect(denied.denied!.status).toBe(403);
    expect((await denied.denied!.json()).purpose).toBe("clinician_review");
  });
});

describe("suspendProcessingForWithdrawal", () => {
  it("flags the user closing + suspended and revokes every session", async () => {
    const now = new Date("2026-07-03T00:00:00Z");
    const { sessionsRevoked } = await suspendProcessingForWithdrawal("mem_0001", now);
    expect(sessionsRevoked).toBe(2);
    expect(revokeSessions).toHaveBeenCalledWith("mem_0001");
    const [filter, update] = updateOne.mock.calls[0];
    expect(filter).toEqual({ _id: "mem_0001" });
    expect(update.$set).toMatchObject({
      processingSuspended: true,
      status: "closing",
      closureRequestedAt: now,
    });
  });
});
