/**
 * POST /api/v1/admin/mfa/enroll/complete — finish MANDATORY TOTP enrolment and
 * ONLY THEN promote the scoped enrol state into a real admin session.
 *
 * Authorised by the `mfa-enroll` cookie (NOT a session). Body: { secret (from
 * /enroll/setup), code (a current TOTP) }. We verify the code against the
 * pending secret, seal it, persist it with backup codes, THEN set the admin
 * session cookie and clear the enrol cookie. Until this succeeds the account has
 * no session and can reach no data route — so no admin can operate without MFA.
 *
 * Rate-limited per IP (reuses the admin-login limiter). The code is never logged.
 */
import { cookies } from "next/headers";
import { currentAdminEnrollment, setAdminSessionCookie } from "@/lib/auth";
import { findAdminById } from "@/lib/admin-auth";
import {
  buildMfaEnrollment,
  enableAdminMfa,
  MFA_ENROLL_COOKIE_NAME,
} from "@/lib/admin-mfa";
import { logAdminAccess } from "@/lib/admin-audit";
import { parseJsonBody } from "@/lib/api";
import { ADMIN_LOGIN_RATE_LIMIT, clientIp, limitByIp } from "@/lib/rate-limit";
import { AdminMfaEnableInput } from "@/lib/models";

function unauthorized(): Response {
  return Response.json(
    { error: "enroll_required", message: "Start again from the sign-in page." },
    { status: 401 }
  );
}

export async function POST(req: Request) {
  const limited = await limitByIp(req, "admin-login-mfa", ADMIN_LOGIN_RATE_LIMIT);
  if (limited) return limited;

  const ip = clientIp(req);

  const enrolling = await currentAdminEnrollment();
  if (!enrolling) return unauthorized();

  const record = await findAdminById(enrolling.adminId);
  if (!record || record.disabledAt) return unauthorized();

  const parsed = await parseJsonBody(req, AdminMfaEnableInput);
  if (!parsed.ok) return parsed.response;

  const built = buildMfaEnrollment(parsed.data.secret, parsed.data.code);
  if (!built.ok) {
    return Response.json(
      { error: built.error, message: built.message },
      { status: 400 }
    );
  }

  await enableAdminMfa(record._id, built.mfa);

  // Enrolment proven → promote to a real admin session and burn the enrol cookie.
  await setAdminSessionCookie({
    adminId: record._id,
    role: record.role,
    email: record.email,
  });
  const store = await cookies();
  store.delete(MFA_ENROLL_COOKIE_NAME);

  logAdminAccess({
    action: "admin.mfa.enroll_complete",
    outcome: "success",
    adminId: record._id,
    role: record.role,
    email: record.email,
    ip,
  });
  logAdminAccess({
    action: "login",
    outcome: "success",
    adminId: record._id,
    role: record.role,
    email: record.email,
    ip,
  });

  // Backup codes are returned exactly once — the client must show + save them.
  return Response.json({ ok: true, backupCodes: built.backupCodes });
}
