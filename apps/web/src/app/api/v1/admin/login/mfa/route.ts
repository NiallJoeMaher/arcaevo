/**
 * POST /api/v1/admin/login/mfa — second factor of admin login (TOTP MFA).
 *
 * Step 2 of the two-step login: step 1 (POST /api/v1/admin/login) verified the
 * password and, when the admin has MFA on, set a short-lived signed
 * `mfa-pending` cookie (adminId + ≤5-min expiry — NOT an admin session). This
 * route reads that cookie, verifies a TOTP or single-use backup code against the
 * admin's sealed secret, and ONLY THEN issues the real admin session. The
 * pending token carries no role, so it can never stand in for a session.
 *
 * Rate-limited per IP (reuses the admin-login limiter). The submitted code is
 * never logged (the audit row records only success/failure + adminId/ip).
 */
import { cookies } from "next/headers";
import { setAdminSessionCookie } from "@/lib/auth";
import { findAdminById } from "@/lib/admin-auth";
import {
  MFA_PENDING_COOKIE_NAME,
  readMfaPendingToken,
  verifyAdminSecondFactor,
} from "@/lib/admin-mfa";
import { logAdminAccess } from "@/lib/admin-audit";
import { parseJsonBody } from "@/lib/api";
import { ADMIN_LOGIN_RATE_LIMIT, clientIp, limitByIp } from "@/lib/rate-limit";
import { AdminLoginMfaInput } from "@/lib/models";

function invalid(): Response {
  // Non-revealing: same message whether the pending token, the code, or the
  // account is at fault.
  return Response.json(
    { error: "invalid_mfa", message: "That code didn't work. Try again." },
    { status: 401 }
  );
}

export async function POST(req: Request) {
  const limited = await limitByIp(req, "admin-login-mfa", ADMIN_LOGIN_RATE_LIMIT);
  if (limited) return limited;

  const ip = clientIp(req);

  const parsed = await parseJsonBody(req, AdminLoginMfaInput);
  if (!parsed.ok) return parsed.response;

  const store = await cookies();
  const pending = readMfaPendingToken(store.get(MFA_PENDING_COOKIE_NAME)?.value);
  if (!pending) {
    logAdminAccess({ action: "login.mfa", outcome: "failure", email: null, ip });
    return invalid();
  }

  const admin = await findAdminById(pending.adminId);
  // The pending token must resolve to a real, enabled admin that still has MFA.
  if (!admin || admin.disabledAt || !admin.mfa) {
    logAdminAccess({
      action: "login.mfa",
      outcome: "failure",
      adminId: pending.adminId,
      ip,
    });
    return invalid();
  }

  const ok = await verifyAdminSecondFactor(admin, parsed.data.code);
  if (!ok) {
    logAdminAccess({
      action: "login.mfa",
      outcome: "failure",
      adminId: admin._id,
      role: admin.role,
      email: admin.email,
      ip,
    });
    return invalid();
  }

  // Second factor verified — issue the real session and clear the pending token.
  await setAdminSessionCookie({
    adminId: admin._id,
    role: admin.role,
    email: admin.email,
  });
  store.delete(MFA_PENDING_COOKIE_NAME);
  logAdminAccess({
    action: "login",
    outcome: "success",
    adminId: admin._id,
    role: admin.role,
    email: admin.email,
    ip,
  });
  return Response.json({ ok: true, role: admin.role });
}
