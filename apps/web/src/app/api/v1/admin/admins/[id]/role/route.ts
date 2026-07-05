/**
 * POST /api/v1/admin/admins/[id]/role — owner-only. Changes an admin's role.
 * The new role takes effect on the target's next request (currentAdmin reads
 * the live DB role, so a downgrade applies at once).
 *
 * Last-owner guard: demoting the FINAL enabled owner out of "owner" is refused,
 * so the system can never end up with zero owners.
 */
import { currentAdmin, requireAdminRole } from "@/lib/auth";
import { logAdminAccess } from "@/lib/admin-audit";
import { clientIp } from "@/lib/rate-limit";
import { parseJsonBody } from "@/lib/api";
import { AdminRoleChangeInput } from "@/lib/models";
import {
  countEnabledOwners,
  findAdminById,
  publicAdmin,
  setAdminRole,
} from "@/lib/admin-auth";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requireAdminRole("owner");
  if (denied) return denied;

  const { id } = await params;
  const parsed = await parseJsonBody(req, AdminRoleChangeInput);
  if (!parsed.ok) return parsed.response;
  const { role } = parsed.data;

  const target = await findAdminById(id);
  if (!target) {
    return Response.json(
      { error: "not_found", message: `No admin ${id}.` },
      { status: 404 }
    );
  }

  // Demoting the last enabled owner would leave nobody able to manage admins.
  if (target.role === "owner" && role !== "owner" && !target.disabledAt) {
    const owners = await countEnabledOwners();
    if (owners <= 1) {
      return Response.json(
        {
          error: "last_owner",
          message: "Can't change the role of the last enabled owner.",
        },
        { status: 400 }
      );
    }
  }

  await setAdminRole(id, role);

  const admin = await currentAdmin();
  logAdminAccess({
    action: "admin.account.role",
    adminId: admin?.adminId ?? null,
    role: admin?.role ?? null,
    ip: clientIp(req),
  });

  return Response.json({ admin: publicAdmin({ ...target, role }) });
}
