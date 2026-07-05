/**
 * POST /api/v1/admin/mfa/enroll/setup — begin MANDATORY TOTP enrolment.
 *
 * Authorised by the scoped `mfa-enroll` cookie (set by the login route when a
 * real admin passed the password step but has no MFA), NOT by a full admin
 * session — the enrolling admin has no session yet and can reach nothing else.
 * Returns a fresh base32 secret + otpauth:// URI. Nothing is persisted here; the
 * admin proves the authenticator via POST /api/v1/admin/mfa/enroll/complete,
 * which seals the secret and only THEN issues the real admin session.
 */
import { currentAdminEnrollment } from "@/lib/auth";
import { findAdminById } from "@/lib/admin-auth";
import { generateTotpSecret, totpUri } from "@/lib/admin-mfa";
import { logAdminAccess } from "@/lib/admin-audit";
import { clientIp } from "@/lib/rate-limit";

function unauthorized(): Response {
  return Response.json(
    { error: "enroll_required", message: "Start again from the sign-in page." },
    { status: 401 }
  );
}

export async function POST(req: Request) {
  const enrolling = await currentAdminEnrollment();
  if (!enrolling) return unauthorized();

  const record = await findAdminById(enrolling.adminId);
  if (!record || record.disabledAt) return unauthorized();

  const secret = generateTotpSecret();
  logAdminAccess({
    action: "admin.mfa.enroll_setup",
    adminId: record._id,
    role: record.role,
    ip: clientIp(req),
  });

  return Response.json({
    secret,
    otpauthUri: totpUri({ email: record.email, secret }),
  });
}
