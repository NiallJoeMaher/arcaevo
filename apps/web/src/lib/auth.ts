/**
 * Authentication — PLACEHOLDER (see docs/MOCKED_APIS.md §3–4).
 *
 * Admin: single shared password (ADMIN_PASSWORD env) → HMAC-signed session
 * cookie. No user accounts, no roles, no rate limiting. Productionise with a
 * real IdP (WorkOS/Auth0/Cognito), per-user accounts + roles, audit log.
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
import type { User } from "@/lib/models";

export const ADMIN_COOKIE_NAME = "arcaevo_admin_session";

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

export function verifyAdminPassword(password: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false; // no password configured ⇒ admin login disabled
  return safeEqual(password, expected);
}

/** Serialised session value: base64url(JSON payload) + "." + HMAC. */
export function createAdminSessionValue(now: Date = new Date()): string {
  const payload = Buffer.from(
    JSON.stringify({ role: "admin", iat: now.toISOString() })
  ).toString("base64url");
  return `${payload}.${hmac(payload)}`;
}

export function verifyAdminSessionValue(value: string | undefined): boolean {
  if (!value) return false;
  const dot = value.lastIndexOf(".");
  if (dot <= 0) return false;
  const payload = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  if (!safeEqual(sig, hmac(payload))) return false;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString());
    return parsed?.role === "admin";
  } catch {
    return false;
  }
}

/** Set the signed admin cookie (call from a Route Handler / Server Action). */
export async function setAdminSessionCookie(): Promise<void> {
  const store = await cookies();
  store.set(ADMIN_COOKIE_NAME, createAdminSessionValue(), {
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

/** Is the current request an authenticated admin? (route handlers + pages) */
export async function isAdmin(): Promise<boolean> {
  const store = await cookies();
  return verifyAdminSessionValue(store.get(ADMIN_COOKIE_NAME)?.value);
}

/**
 * Guard for admin route handlers:
 *   const denied = await requireAdmin();
 *   if (denied) return denied;
 */
export async function requireAdmin(): Promise<Response | null> {
  if (await isAdmin()) return null;
  return Response.json(
    { error: "unauthorized", message: "Admin session required." },
    { status: 401 }
  );
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
