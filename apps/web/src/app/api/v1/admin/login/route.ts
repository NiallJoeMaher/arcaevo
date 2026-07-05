/**
 * POST /api/v1/admin/login — self-hosted admin auth (docs/MOCKED_APIS.md §3).
 *
 * Accepts EITHER:
 *  - {email, password} → look up the per-admin account, verify scrypt, check
 *    not disabled, issue a session carrying that admin's identity + role; OR
 *  - {password} (no email) → bootstrap OWNER login: timing-safe compare against
 *    the shared ADMIN_PASSWORD, issue an OWNER session. This keeps the legacy
 *    password-only path (and the e2e login flow) working unchanged.
 *
 * Rate-limited per IP (429). Every attempt — success and failure — is written
 * to the admin access log (email + ip; NEVER the password). No credentials are
 * ever logged to the console.
 */
import { cookies } from "next/headers";
import {
  setAdminSessionCookie,
  verifyAdminPassword,
} from "@/lib/auth";
import {
  resolveBootstrapOwner,
  verifyAdminCredentials,
} from "@/lib/admin-auth";
import {
  adminHasMfa,
  createMfaEnrollToken,
  createMfaPendingToken,
  MFA_ENROLL_COOKIE_NAME,
  MFA_ENROLL_TTL_MS,
  MFA_PENDING_COOKIE_NAME,
  MFA_PENDING_TTL_MS,
} from "@/lib/admin-mfa";
import { adminBootstrapDisabled } from "@/lib/env";
import { logAdminAccess } from "@/lib/admin-audit";
import { ADMIN_LOGIN_RATE_LIMIT, clientIp, limitByIp } from "@/lib/rate-limit";
import { AdminLoginInput, type AdminRole } from "@/lib/models";

/**
 * Password step succeeded. Three outcomes, none of which is "full session with
 * no second factor" for a real account:
 *
 *  1. MFA enabled → set a short-lived signed mfa-pending cookie (adminId +
 *     ≤5-min expiry, NOT a session) and return `{ mfaRequired: true }`; the
 *     caller must POST /api/v1/admin/login/mfa with a valid second factor.
 *  2. No MFA + `enrollIfNoMfa` (a REAL per-admin account) → MANDATORY enrolment:
 *     set a scoped mfa-enroll cookie (also NOT a session) and return
 *     `{ enrollMfaRequired: true }`. No admin can operate without MFA — the
 *     enroll cookie only reaches the enrolment flow, never any data route.
 *  3. No MFA + NOT `enrollIfNoMfa` (the env break-glass bootstrap owner, which
 *     has no DB record and is MFA-exempt by design) → issue the session. This
 *     path is instead gated by ADMIN_BOOTSTRAP_DISABLED (see POST below), and is
 *     what keeps dev / first-login / the e2e password flow working.
 */
async function issueSessionOrChallenge(
  identity: { adminId: string; role: AdminRole; email?: string | null },
  ip: string,
  email: string | null,
  opts: { enrollIfNoMfa: boolean }
): Promise<Response> {
  const store = await cookies();

  if (await adminHasMfa(identity.adminId)) {
    store.set(MFA_PENDING_COOKIE_NAME, createMfaPendingToken(identity.adminId), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: Math.floor(MFA_PENDING_TTL_MS / 1000),
    });
    logAdminAccess({
      action: "login.mfa_challenge",
      outcome: "success",
      adminId: identity.adminId,
      role: identity.role,
      email: identity.email ?? email,
      ip,
    });
    // Non-revealing: the client only learns a second factor is required.
    return Response.json({ mfaRequired: true });
  }

  if (opts.enrollIfNoMfa) {
    // Real account without MFA → force enrolment before any session is issued.
    store.set(MFA_ENROLL_COOKIE_NAME, createMfaEnrollToken(identity.adminId), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: Math.floor(MFA_ENROLL_TTL_MS / 1000),
    });
    logAdminAccess({
      action: "login.mfa_enroll_required",
      outcome: "success",
      adminId: identity.adminId,
      role: identity.role,
      email: identity.email ?? email,
      ip,
    });
    return Response.json({ enrollMfaRequired: true });
  }

  await setAdminSessionCookie(identity);
  logAdminAccess({
    action: "login",
    outcome: "success",
    adminId: identity.adminId,
    role: identity.role,
    email: identity.email ?? email,
    ip,
  });
  return Response.json({ ok: true, role: identity.role });
}

export async function POST(req: Request) {
  const limited = await limitByIp(req, "admin-login", ADMIN_LOGIN_RATE_LIMIT);
  if (limited) return limited;

  const ip = clientIp(req);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { error: "bad_request", message: "Expected JSON body." },
      { status: 400 }
    );
  }
  const parsed = AdminLoginInput.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "validation", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const email = parsed.data.email?.trim().toLowerCase();
  const { password } = parsed.data;

  // --- per-admin account path (email supplied) ------------------------------
  if (email) {
    const identity = await verifyAdminCredentials(email, password);
    if (!identity) {
      logAdminAccess({ action: "login", outcome: "failure", email, ip });
      return Response.json(
        { error: "invalid_credentials", message: "Wrong email or password." },
        { status: 401 }
      );
    }
    // Password OK for a REAL per-admin account. Challenge MFA if enabled, else
    // force mandatory enrolment — never a full session without a second factor.
    return issueSessionOrChallenge(identity, ip, email, { enrollIfNoMfa: true });
  }

  // --- bootstrap OWNER path (password only) ---------------------------------
  // Break-glass, gated by ADMIN_BOOTSTRAP_DISABLED (security audit A-1). When
  // disabled we reject it entirely — same non-revealing 401 as a wrong password,
  // so a scanner can't tell the bootstrap path is off vs. the password wrong.
  if (adminBootstrapDisabled()) {
    logAdminAccess({
      action: "login.bootstrap_disabled",
      outcome: "failure",
      email: null,
      ip,
    });
    return Response.json(
      { error: "invalid_credentials", message: "Wrong password." },
      { status: 401 }
    );
  }
  if (!verifyAdminPassword(password)) {
    logAdminAccess({ action: "login", outcome: "failure", email: null, ip });
    return Response.json(
      { error: "invalid_credentials", message: "Wrong password." },
      { status: 401 }
    );
  }
  // If the bootstrap password binds to a REAL owner account that has MFA on, the
  // second factor is still required (adminHasMfa is false for the synthetic
  // "bootstrap-owner" id, so the no-account break-glass path is unaffected).
  // `enrollIfNoMfa: false` — the break-glass path is MFA-exempt by design (it is
  // instead disabled wholesale via the flag above), which keeps dev / first
  // login / the e2e password flow working with no MFA and no enrolment.
  const owner = await resolveBootstrapOwner();
  return issueSessionOrChallenge(owner, ip, owner.email ?? null, {
    enrollIfNoMfa: false,
  });
}
