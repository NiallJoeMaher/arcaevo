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
  createMfaPendingToken,
  MFA_PENDING_COOKIE_NAME,
  MFA_PENDING_TTL_MS,
} from "@/lib/admin-mfa";
import { logAdminAccess } from "@/lib/admin-audit";
import { ADMIN_LOGIN_RATE_LIMIT, clientIp, limitByIp } from "@/lib/rate-limit";
import { AdminLoginInput, type AdminRole } from "@/lib/models";

/**
 * Password step succeeded. If the resolved admin has MFA enabled we DO NOT issue
 * a session — instead we set a short-lived, signed mfa-pending cookie (adminId +
 * 5-min expiry, NOT an admin session) and return `{ mfaRequired: true }`. The
 * caller must then POST /api/v1/admin/login/mfa with a valid second factor.
 * Returns true when it handled the MFA branch (the caller should return `res`).
 */
async function issueSessionOrChallenge(
  identity: { adminId: string; role: AdminRole; email?: string | null },
  ip: string,
  email: string | null
): Promise<Response> {
  if (await adminHasMfa(identity.adminId)) {
    const store = await cookies();
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
    // Password OK — issue a session, or challenge for MFA if enabled.
    return issueSessionOrChallenge(identity, ip, email);
  }

  // --- bootstrap OWNER path (password only) ---------------------------------
  if (!verifyAdminPassword(password)) {
    logAdminAccess({ action: "login", outcome: "failure", email: null, ip });
    return Response.json(
      { error: "invalid_credentials", message: "Wrong password." },
      { status: 401 }
    );
  }
  // If the bootstrap password binds to a REAL owner account that has MFA on,
  // the second factor is still required (adminHasMfa is false for the synthetic
  // "bootstrap-owner" id, so the no-account break-glass path is unaffected).
  const owner = await resolveBootstrapOwner();
  return issueSessionOrChallenge(owner, ip, owner.email ?? null);
}
