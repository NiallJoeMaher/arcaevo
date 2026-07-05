/**
 * Authentication (see docs/MOCKED_APIS.md §3–4).
 *
 * Admin: self-hosted per-admin accounts (email + scrypt password + role) with
 * an HMAC-signed session cookie carrying the acting admin's identity
 * ({adminId, role, iat}). The single shared ADMIN_PASSWORD is retained ONLY as
 * a bootstrap OWNER credential (password-only login) for backward compat and
 * first-login. See src/lib/admin-auth.ts (accounts) + src/lib/admin-audit.ts
 * (access log). Managed-IdP migration stays open (ADMIN_AUTH_OPTIONS.md B).
 *
 * Member (iOS demo): a static bearer token that maps to the seeded demo
 * member. Productionise with Sign in with Apple + rotating JWTs.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { collections } from "@/lib/db";
// Fail-closed secret validation lives in env.ts: in production sessionSecret()
// throws rather than fall back to a committed literal (which would let anyone
// forge an admin cookie). demoTokenEnabled() gates the demo bearer token.
import { demoTokenEnabled, sessionSecret } from "@/lib/env";
import {
  memberFromSessionToken,
  sessionTokenFromCookies,
} from "@/lib/member-auth";
import type { AdminRole, User } from "@/lib/models";
import type { AdminIdentity } from "@/lib/admin-auth";

export const ADMIN_COOKIE_NAME = "arcaevo_admin_session";

const ADMIN_ROLES: readonly AdminRole[] = ["owner", "ops", "clinician"];

/** The decoded, signature-verified admin session payload. */
export interface AdminSession {
  adminId: string;
  role: AdminRole;
  /** ISO issue time (informational). */
  iat?: string;
}

/** MOCK: static demo bearer token for the iOS app / API exploration. */
export const DEMO_MEMBER_TOKEN = "demo-member-token";

function hmac(payload: string): string {
  return createHmac("sha256", sessionSecret()).update(payload).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

// ---------------------------------------------------------------------------
// Admin session
// ---------------------------------------------------------------------------

/**
 * Bootstrap password check — a timing-safe compare against the single shared
 * ADMIN_PASSWORD. This is NOT a per-admin account; a match issues an OWNER
 * session (see the login route). Retained for backward compat + first-login.
 */
export function verifyAdminPassword(password: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false; // no password configured ⇒ bootstrap disabled
  return safeEqual(password, expected);
}

/**
 * Serialised session value: base64url(JSON {adminId, role, iat}) + "." + HMAC.
 * Defaults to the bootstrap OWNER identity when called with no identity (keeps
 * the old zero-arg signature working for tests/first-login).
 */
export function createAdminSessionValue(
  identity: AdminIdentity = { adminId: "bootstrap-owner", role: "owner" },
  now: Date = new Date()
): string {
  const payload = Buffer.from(
    JSON.stringify({
      adminId: identity.adminId,
      role: identity.role,
      iat: now.toISOString(),
    })
  ).toString("base64url");
  return `${payload}.${hmac(payload)}`;
}

/**
 * Verify + decode a session cookie value. Returns the identity payload, or null
 * when the signature/shape is invalid. Backward compatible with legacy cookies
 * carrying `{role:"admin"}` (from before per-admin accounts) — those are
 * treated as an OWNER session so a fresh deploy doesn't sign everyone out.
 */
export function readAdminSession(value: string | undefined): AdminSession | null {
  if (!value) return null;
  const dot = value.lastIndexOf(".");
  if (dot <= 0) return null;
  const payload = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  if (!safeEqual(sig, hmac(payload))) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString());
    // Legacy: single-role "admin" cookie ⇒ owner.
    if (parsed?.role === "admin") {
      return {
        adminId: typeof parsed.adminId === "string" ? parsed.adminId : "legacy-owner",
        role: "owner",
        iat: parsed.iat,
      };
    }
    if (typeof parsed?.role === "string" && ADMIN_ROLES.includes(parsed.role)) {
      return {
        adminId: typeof parsed.adminId === "string" ? parsed.adminId : "unknown",
        role: parsed.role,
        iat: parsed.iat,
      };
    }
    return null;
  } catch {
    return null;
  }
}

/** Boolean convenience wrapper over readAdminSession (signature valid + role ok). */
export function verifyAdminSessionValue(value: string | undefined): boolean {
  return readAdminSession(value) !== null;
}

/** Set the signed admin cookie (call from a Route Handler / Server Action). */
export async function setAdminSessionCookie(identity: AdminIdentity): Promise<void> {
  const store = await cookies();
  store.set(ADMIN_COOKIE_NAME, createAdminSessionValue(identity), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12, // 12h ops shift
  });
}

export async function clearAdminSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(ADMIN_COOKIE_NAME);
}

/** The current request's admin identity, or null when not signed in. */
export async function currentAdmin(): Promise<AdminSession | null> {
  const store = await cookies();
  return readAdminSession(store.get(ADMIN_COOKIE_NAME)?.value);
}

/** Is the current request an authenticated admin? (route handlers + pages) */
export async function isAdmin(): Promise<boolean> {
  return (await currentAdmin()) !== null;
}

function unauthorized(): Response {
  return Response.json(
    { error: "unauthorized", message: "Admin session required." },
    { status: 401 }
  );
}

/**
 * Guard for admin route handlers (any role):
 *   const denied = await requireAdmin();
 *   if (denied) return denied;
 */
export async function requireAdmin(): Promise<Response | null> {
  if (await isAdmin()) return null;
  return unauthorized();
}

/**
 * Role-gated guard: 401 when not signed in, 403 when the session's role is not
 * one of `roles`. Used for clinician sign-off (clinician|owner only).
 */
export async function requireAdminRole(
  ...roles: AdminRole[]
): Promise<Response | null> {
  const admin = await currentAdmin();
  if (!admin) return unauthorized();
  if (!roles.includes(admin.role)) {
    return Response.json(
      { error: "forbidden", message: "Your admin role cannot perform this action." },
      { status: 403 }
    );
  }
  return null;
}

// ---------------------------------------------------------------------------
// Member (demo bearer token OR v2 session — see member-auth.ts)
// ---------------------------------------------------------------------------

/**
 * Resolve the member for a request. Three ways in, checked in order:
 *  1. `Bearer demo-member-token` — the seeded demo user (iOS app; MOCK).
 *  2. `Bearer <session token>` — a v2 session token (iOS after real sign-in).
 *  3. The `arcaevo_member_session` cookie — v2 web session (member-auth.ts).
 */
export async function memberFromRequest(req: Request): Promise<User | null> {
  const header = req.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (match) {
    const bearer = match[1].trim();
    // Demo token is a hardcoded bypass to a real seeded member's Art.9 health
    // data — only honour it in dev/e2e (or with ALLOW_DEMO_TOKEN=true). In
    // production without the flag it falls through and is rejected like any
    // other invalid token.
    if (demoTokenEnabled() && safeEqual(bearer, DEMO_MEMBER_TOKEN)) {
      const users = await collections.users();
      return users.findOne({ isDemo: true });
    }
    // v2: any other bearer value is treated as a session token.
    return memberFromSessionToken(bearer);
  }
  // v2: fall back to the member session cookie.
  const token = await sessionTokenFromCookies();
  return token ? memberFromSessionToken(token) : null;
}

/**
 * Guard for member route handlers:
 *   const auth = await requireMember(req);
 *   if (auth.denied) return auth.denied;
 *   auth.member // typed User
 */
export async function requireMember(
  req: Request
): Promise<{ member: User; denied: null } | { member: null; denied: Response }> {
  const member = await memberFromRequest(req);
  if (member) return { member, denied: null };
  return {
    member: null,
    denied: Response.json(
      {
        error: "unauthorized",
        message:
          "Sign in required — bearer token (POST /api/v1/auth/demo for the demo token) or member session cookie (POST /api/v1/auth/signin).",
      },
      { status: 401 }
    ),
  };
}
