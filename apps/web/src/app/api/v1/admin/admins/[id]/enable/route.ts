/**
 * POST /api/v1/admin/admins/[id]/enable — owner-only. Clears `disabledAt`,
 * re-enabling a previously disabled admin (they can sign in again). No lockout
 * guard needed — enabling never removes an owner.
 */
import { currentAdmin, requireAdminRole } from "@/lib/auth";
import { logAdminAccess } from "@/lib/admin-audit";
import { clientIp } from "@/lib/rate-limit";
import { findAdminById, publicAdmin, setAdminDisabled } from "@/lib/admin-auth";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requireAdminRole("owner");
  if (denied) return denied;

  const { id } = await params;
  const target = await findAdminById(id);
  if (!target) {
    return Response.json(
      { error: "not_found", message: `No admin ${id}.` },
      { status: 404 }
    );
  }

  await setAdminDisabled(id, false);

  const admin = await currentAdmin();
  logAdminAccess({
    action: "admin.account.enable",
    adminId: admin?.adminId ?? null,
    role: admin?.role ?? null,
    ip: clientIp(req),
  });

  return Response.json({
    admin: publicAdmin({ ...target, disabledAt: null }),
  });
}
