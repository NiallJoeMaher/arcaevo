import type { Metadata } from "next";
import { currentAdmin } from "@/lib/auth";
import {
  DbDownNotice,
  OwnerOnlyNotice,
  PanelBody,
  Topbar,
} from "../chrome";
import { loadAdmins } from "../data";
import AdminsManager from "./AdminsManager";

/**
 * /admin/admins — owner-only management of the self-hosted admin accounts
 * (docs/MOCKED_APIS.md §3). Lists every admin with role + status, creates new
 * admins, and enables/disables or re-roles them — no direct Mongo edits.
 *
 * The page is gated by the live DB role (currentAdmin); the mutating API routes
 * are independently owner-gated, so this render-time check is defence in depth,
 * not the only guard.
 */
export const metadata: Metadata = { title: "Admins" };
export const dynamic = "force-dynamic";

export default async function AdminAdminsPage() {
  const me = await currentAdmin();
  const isOwner = me?.role === "owner";
  const rows = isOwner ? await loadAdmins() : null;

  return (
    <>
      <Topbar kicker="ACCESS" title="Admin accounts" />
      <PanelBody>
        {!isOwner ? (
          <OwnerOnlyNotice />
        ) : rows === null ? (
          <DbDownNotice />
        ) : (
          <AdminsManager admins={rows} currentAdminId={me?.adminId ?? null} />
        )}
      </PanelBody>
    </>
  );
}
