/**
 * POST /api/v1/admin/admins/[id]/disable — owner-only. Sets `disabledAt`, which
 * revokes the account's live session immediately (currentAdmin rejects a
 * disabled record) — the offboarding / compromise-containment path.
 *
 * Two lockout guards, enforced server-side (the UI mirrors them as disabled
 * buttons, but the server is authoritative):
 *   - an owner cannot disable THEIR OWN account (avoid self-lockout);
 *   - the LAST enabled owner cannot be disabled (never leave zero owners).
 */
import { currentAdmin, requireAdminRole } from "@/lib/auth";
import { logAdminAccess } from "@/lib/admin-audit";
import { clientIp } from "@/lib/rate-limit";
import {
  countEnabledOwners,
  findAdminById,
  publicAdmin,
  setAdminDisabled,
} from "@/lib/admin-auth";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requireAdminRole("owner");
  if (denied) return denied;

  const { id } = await params;
  const admin = await currentAdmin();

  const target = await findAdminById(id);
  if (!target) {
    return Response.json(
      { error: "not_found", message: `No admin ${id}.` },
      { status: 404 }
    );
  }

  if (admin && target._id === admin.adminId) {
    return Response.json(
      {
        error: "self_disable",
        message: "You can't disable your own account.",
      },
      { status: 400 }
    );
  }

  if (target.role === "owner" && !target.disabledAt) {
    const owners = await countEnabledOwners();
    if (owners <= 1) {
      return Response.json(
        {
          error: "last_owner",
          message: "Can't disable the last enabled owner.",
        },
        { status: 400 }
      );
    }
  }

  const now = new Date();
  await setAdminDisabled(id, true, now);

  logAdminAccess({
    action: "admin.account.disable",
    adminId: admin?.adminId ?? null,
    role: admin?.role ?? null,
    ip: clientIp(req),
  });

  return Response.json({
    admin: publicAdmin({ ...target, disabledAt: now }),
  });
}
