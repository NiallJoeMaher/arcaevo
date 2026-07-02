/**
 * Server-component session helper for the product web app pages.
 * Reads the `arcaevo_member_session` cookie set by the auth route handlers
 * (src/lib/member-auth.ts) and resolves the member. Read-only — cookie
 * writes only ever happen in route handlers.
 */
import {
  memberFromSessionToken,
  sessionTokenFromCookies,
} from "@/lib/member-auth";
import type { User } from "@/lib/models";

export async function currentMember(): Promise<User | null> {
  const token = await sessionTokenFromCookies();
  if (!token) return null;
  return memberFromSessionToken(token);
}

/** Raw session token (needed to mark "this device" in the sessions list). */
export { sessionTokenFromCookies };
