/**
 * GET/POST /api/v1/admin/admins — owner-only admin-account management
 * (self-hosted admin auth, docs/MOCKED_APIS.md §3). Lets an OWNER manage the
 * per-admin accounts (list / create) without editing Mongo by hand.
 *
 *   GET  → every admin (id, email, role, name, createdAt, disabledAt). The
 *          response is built via publicAdmin(), which NEVER emits passwordHash.
 *   POST → create an admin { email, role, name?, password }. Email is
 *          lowercased; a duplicate email is a 409; the password is scrypt-hashed
 *          by createAdmin (member-auth params) — the raw password is never
 *          stored, returned, or logged.
 *
 * Both are owner-gated (requireAdminRole("owner") → 403 for ops/clinician) and
 * every mutation writes an admin_access_log row (who/what/when/ip — no secrets).
 */
import { currentAdmin, requireAdminRole } from "@/lib/auth";
import { logAdminAccess } from "@/lib/admin-audit";
import { clientIp } from "@/lib/rate-limit";
import { parseJsonBody } from "@/lib/api";
import { AdminCreateInput } from "@/lib/models";
import {
  createAdmin,
  findAdminByEmail,
  listAdmins,
  publicAdmin,
} from "@/lib/admin-auth";

export async function GET() {
  const denied = await requireAdminRole("owner");
  if (denied) return denied;

  const admin = await currentAdmin();
  logAdminAccess({
    action: "admin.accounts.read",
    adminId: admin?.adminId ?? null,
    role: admin?.role ?? null,
  });

  const admins = await listAdmins();
  return Response.json({ admins: admins.map(publicAdmin) });
}

export async function POST(req: Request) {
  const denied = await requireAdminRole("owner");
  if (denied) return denied;

  const parsed = await parseJsonBody(req, AdminCreateInput);
  if (!parsed.ok) return parsed.response;

  const email = parsed.data.email.trim().toLowerCase();
  if (await findAdminByEmail(email)) {
    return Response.json(
      { error: "conflict", message: "An admin with that email already exists." },
      { status: 409 }
    );
  }

  const created = await createAdmin({
    email,
    password: parsed.data.password,
    role: parsed.data.role,
    name: parsed.data.name,
  });

  const admin = await currentAdmin();
  logAdminAccess({
    action: "admin.account.create",
    adminId: admin?.adminId ?? null,
    role: admin?.role ?? null,
    ip: clientIp(req),
  });

  // publicAdmin() strips passwordHash — the create response carries no secret.
  return Response.json({ admin: publicAdmin(created) }, { status: 201 });
}
