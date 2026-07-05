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
import {
  setAdminSessionCookie,
  verifyAdminPassword,
} from "@/lib/auth";
import {
  resolveBootstrapOwner,
  verifyAdminCredentials,
} from "@/lib/admin-auth";
import { logAdminAccess } from "@/lib/admin-audit";
import { ADMIN_LOGIN_RATE_LIMIT, clientIp, limitByIp } from "@/lib/rate-limit";
import { AdminLoginInput } from "@/lib/models";

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

  // --- bootstrap OWNER path (password only) ---------------------------------
  if (!verifyAdminPassword(password)) {
    logAdminAccess({ action: "login", outcome: "failure", email: null, ip });
    return Response.json(
      { error: "invalid_credentials", message: "Wrong password." },
      { status: 401 }
    );
  }
  const owner = await resolveBootstrapOwner();
  await setAdminSessionCookie(owner);
  logAdminAccess({
    action: "login",
    outcome: "success",
    adminId: owner.adminId,
    role: owner.role,
    email: owner.email ?? null,
    ip,
  });
  return Response.json({ ok: true, role: owner.role });
}
