/**
 * Per-admin account store + verification (self-hosted admin auth, Option A in
 * docs/legal/ADMIN_AUTH_OPTIONS.md). Passwords reuse the member scrypt helpers
 * (member-auth.ts) — same params, same stored format — so there is exactly one
 * password-hashing implementation to trust.
 *
 * The single shared `ADMIN_PASSWORD` is retained ONLY as a BOOTSTRAP OWNER
 * credential (backward compat: the e2e/login flow submits a password with no
 * email). `verifyAdminPassword` (auth.ts) does that literal, timing-safe
 * compare; this module handles the real per-admin accounts.
 */
import { hashPassword, verifyPassword } from "@/lib/member-auth";
import { collections } from "@/lib/db";
import type { Admin, AdminRole } from "@/lib/models";

/** Identity carried in the signed admin session cookie + access log. */
export interface AdminIdentity {
  adminId: string;
  role: AdminRole;
  email?: string | null;
}

/** Default bootstrap-owner email (overridable via ADMIN_EMAIL). Lowercased. */
export function bootstrapOwnerEmail(): string {
  const raw = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  return raw && raw.length > 0 ? raw : "owner@arcaevo.local";
}

/**
 * A dummy scrypt hash used to equalise timing when no matching admin exists,
 * so a wrong email and a wrong password take the same work (no user
 * enumeration by timing). Value is irrelevant — only the compute cost matters.
 * Computed once, lazily.
 */
let dummyHashPromise: Promise<string> | null = null;
function dummyHash(): Promise<string> {
  if (!dummyHashPromise) {
    dummyHashPromise = hashPassword("timing-equaliser-not-a-real-password");
  }
  return dummyHashPromise;
}

export async function findAdminByEmail(email: string): Promise<Admin | null> {
  const admins = await collections.admins();
  return admins.findOne({ email: email.toLowerCase() });
}

/**
 * Verify an email+password admin login. Returns the identity on success, or
 * null when the account is missing, disabled, or the password is wrong. Runs
 * scrypt in every branch (dummy hash when the account is missing) so the
 * response time does not reveal whether the email exists.
 */
export async function verifyAdminCredentials(
  email: string,
  password: string
): Promise<AdminIdentity | null> {
  const admin = await findAdminByEmail(email);
  const hash = admin?.passwordHash ?? (await dummyHash());
  const passwordOk = await verifyPassword(password, hash);
  if (!admin || admin.disabledAt || !passwordOk) return null;
  return { adminId: admin._id, role: admin.role, email: admin.email };
}

/**
 * Resolve the identity a password-only (bootstrap) login should assume. If a
 * seeded/real owner account exists for the bootstrap email, tie the session to
 * that record (so the access log names a real admin); otherwise fall back to a
 * synthetic owner identity. Always OWNER role.
 */
export async function resolveBootstrapOwner(): Promise<AdminIdentity> {
  const email = bootstrapOwnerEmail();
  const admin = await findAdminByEmail(email);
  if (admin && !admin.disabledAt) {
    return { adminId: admin._id, role: "owner", email: admin.email };
  }
  return { adminId: "bootstrap-owner", role: "owner", email };
}

// ---------------------------------------------------------------------------
// Owner-only management helpers (list / lookup / role / disable). These are the
// only sanctioned readers/writers of the `admins` collection outside login, and
// each is deliberately tiny so the route handlers stay declarative + testable.
// ---------------------------------------------------------------------------

/**
 * The safe, secret-free projection of an admin for API responses + the
 * management UI. NEVER includes `passwordHash` (or any other field the schema
 * might grow) — the shape is built explicitly, so a new sensitive field can't
 * leak by accident.
 */
export interface PublicAdmin {
  id: string;
  email: string;
  role: AdminRole;
  name: string | null;
  createdAt: Date;
  disabledAt: Date | null;
}

export function publicAdmin(admin: Admin): PublicAdmin {
  return {
    id: admin._id,
    email: admin.email,
    role: admin.role,
    name: admin.name ?? null,
    createdAt: admin.createdAt,
    disabledAt: admin.disabledAt ?? null,
  };
}

/** All admins, oldest first (management table order). */
export async function listAdmins(): Promise<Admin[]> {
  const admins = await collections.admins();
  return admins.find().sort({ createdAt: 1 }).toArray();
}

export async function findAdminById(id: string): Promise<Admin | null> {
  const admins = await collections.admins();
  return admins.findOne({ _id: id });
}

/**
 * How many owner accounts are still enabled. Drives the last-owner guard: the
 * UI must never let the final owner disable/demote themselves into a lockout.
 */
export async function countEnabledOwners(): Promise<number> {
  const admins = await collections.admins();
  return admins.countDocuments({ role: "owner", disabledAt: null });
}

/** Set or clear `disabledAt` (disable = revoke the account's live session). */
export async function setAdminDisabled(
  id: string,
  disabled: boolean,
  now: Date = new Date()
): Promise<void> {
  const admins = await collections.admins();
  await admins.updateOne(
    { _id: id },
    { $set: { disabledAt: disabled ? now : null } }
  );
}

/** Change an admin's role (last-owner guard is enforced by the caller). */
export async function setAdminRole(id: string, role: AdminRole): Promise<void> {
  const admins = await collections.admins();
  await admins.updateOne({ _id: id }, { $set: { role } });
}

/** Create an admin account (used by seed + any future admin-management UI). */
export async function createAdmin(params: {
  _id?: string;
  email: string;
  password: string;
  role: AdminRole;
  name?: string;
  now?: Date;
}): Promise<Admin> {
  const admins = await collections.admins();
  const admin: Admin = {
    _id: params._id ?? `adm_${params.email.toLowerCase()}`,
    email: params.email.toLowerCase(),
    passwordHash: await hashPassword(params.password),
    role: params.role,
    name: params.name,
    createdAt: params.now ?? new Date(),
    disabledAt: null,
  };
  await admins.insertOne(admin);
  return admin;
}
