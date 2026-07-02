/**
 * Member authentication — v2 (design_handoff_v2 §03, README §3 "Auth").
 *
 * DESIGN CHOICE — opaque session tokens, not signed cookies:
 * a session is a random 256-bit token handed to the browser (httpOnly cookie)
 * or the iOS app (bearer). Only its SHA-256 hash is stored in the `sessions`
 * collection. Chosen over HMAC-signed stateless cookies because sessions must
 * be individually revocable ("password reset signs out all other sessions",
 * §17's session list) — a DB row per session makes revocation a delete.
 *
 * Passwords: node:crypto scrypt (N=16384, r=8, p=1), per-password 16-byte
 * salt, constant-time compare. Password is OPTIONAL — magic links cover
 * everyone.
 *
 * Magic links: 30-minute expiry, single-use, 60-second resend throttle per
 * email+purpose. Only the token hash is stored. MOCK: delivery is the Mongo
 * outbox (email.mock.ts) — the raw link is never logged anywhere else.
 *
 * Lockout: 5 failed password attempts → 15-minute cool-off. Responses never
 * reveal whether an email is registered (enforced in the routes; helpers here
 * are deliberately silent about existence).
 *
 * The old demo bearer token ("demo-member-token", used by the iOS app) keeps
 * working — see auth.ts memberFromRequest, which now falls back to these
 * session helpers for any other bearer value or the session cookie.
 */
import {
  createHash,
  randomBytes,
  scrypt as scryptCb,
  timingSafeEqual,
} from "node:crypto";
import { cookies } from "next/headers";
import { collections } from "@/lib/db";
import type { MagicLinkPurpose, Session, User } from "@/lib/models";

export const MEMBER_COOKIE_NAME = "arcaevo_member_session";

// --- tunables (README §3) ----------------------------------------------------

export const MAGIC_LINK_TTL_MS = 30 * 60 * 1000; // links live 30 minutes
export const RESEND_THROTTLE_MS = 60 * 1000; // resend once per 60s
export const MAX_FAILED_ATTEMPTS = 5; // 5 failures →
export const COOLOFF_MS = 15 * 60 * 1000; // …15-minute cool-off

// --- small crypto helpers ------------------------------------------------------

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function scrypt(password: string, salt: Buffer, keylen: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCb(password, salt, keylen, { N: 16384, r: 8, p: 1 }, (err, key) =>
      err ? reject(err) : resolve(key)
    );
  });
}

/** Serialised as "scrypt:16384:8:1:<salt b64url>:<key b64url>". */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, 64);
  return `scrypt:16384:8:1:${salt.toString("base64url")}:${key.toString("base64url")}`;
}

export async function verifyPassword(
  password: string,
  stored: string
): Promise<boolean> {
  const parts = stored.split(":");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const salt = Buffer.from(parts[4], "base64url");
  const expected = Buffer.from(parts[5], "base64url");
  const actual = await scrypt(password, salt, expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

// --- failed-attempt cool-off (pure) -------------------------------------------

export interface LockoutState {
  failedAttempts: number;
  cooloffUntil: Date | null;
}

/** Is password sign-in currently refused? */
export function isInCooloff(
  cooloffUntil: Date | null | undefined,
  now: Date = new Date()
): boolean {
  return cooloffUntil != null && cooloffUntil.getTime() > now.getTime();
}

/** State after one more wrong password. The 5th failure starts the cool-off;
 * the counter resets with it so the next window is a fresh five. */
export function applyFailedAttempt(
  state: LockoutState,
  now: Date = new Date()
): LockoutState {
  const failedAttempts = state.failedAttempts + 1;
  if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
    return {
      failedAttempts: 0,
      cooloffUntil: new Date(now.getTime() + COOLOFF_MS),
    };
  }
  return { failedAttempts, cooloffUntil: state.cooloffUntil };
}

/** State after a successful sign-in. */
export function clearFailedAttempts(): LockoutState {
  return { failedAttempts: 0, cooloffUntil: null };
}

// --- magic links (pure core + Mongo wrappers) ----------------------------------

export type MagicLinkState = "valid" | "expired" | "used" | "invalid";

/** Pure single-use/expiry evaluation of a stored token document. */
export function evaluateMagicLink(
  doc: { expiresAt: Date; usedAt: Date | null } | null,
  now: Date = new Date()
): MagicLinkState {
  if (!doc) return "invalid";
  if (doc.usedAt) return "used";
  if (doc.expiresAt.getTime() <= now.getTime()) return "expired";
  return "valid";
}

/** Pure resend-throttle check: allowed once per RESEND_THROTTLE_MS. */
export function canResend(
  lastIssuedAt: Date | null,
  now: Date = new Date()
): boolean {
  return (
    lastIssuedAt === null ||
    now.getTime() - lastIssuedAt.getTime() >= RESEND_THROTTLE_MS
  );
}

export type IssueMagicLinkResult =
  | { throttled: false; token: string; expiresAt: Date }
  | { throttled: true; retryInSeconds: number };

/**
 * Issue a single-use magic-link token for an email+purpose.
 * Enforces the 60s resend throttle; stores only the token's SHA-256 hash.
 */
export async function issueMagicLink(
  email: string,
  purpose: MagicLinkPurpose,
  now: Date = new Date()
): Promise<IssueMagicLinkResult> {
  const tokens = await collections.magicLinkTokens();
  const normalized = email.toLowerCase();

  const latest = await tokens
    .find({ email: normalized, purpose })
    .sort({ createdAt: -1 })
    .limit(1)
    .toArray();
  const lastIssuedAt = latest[0]?.createdAt ?? null;
  if (!canResend(lastIssuedAt, now)) {
    const retryInSeconds = Math.ceil(
      (RESEND_THROTTLE_MS - (now.getTime() - lastIssuedAt!.getTime())) / 1000
    );
    return { throttled: true, retryInSeconds };
  }

  const token = randomBytes(32).toString("base64url");
  const tokenHash = sha256Hex(token);
  const expiresAt = new Date(now.getTime() + MAGIC_LINK_TTL_MS);
  await tokens.insertOne({
    _id: `mlt_${tokenHash.slice(0, 16)}`,
    tokenHash,
    email: normalized,
    purpose,
    createdAt: now,
    expiresAt,
    usedAt: null,
  });
  return { throttled: false, token, expiresAt };
}

export type ConsumeMagicLinkResult =
  | { state: "valid"; email: string; purpose: MagicLinkPurpose }
  | { state: Exclude<MagicLinkState, "valid"> };

/** Verify + burn a magic-link token (single-use: marks usedAt atomically). */
export async function consumeMagicLink(
  rawToken: string,
  now: Date = new Date()
): Promise<ConsumeMagicLinkResult> {
  const tokens = await collections.magicLinkTokens();
  const doc = await tokens.findOne({ tokenHash: sha256Hex(rawToken) });
  const state = evaluateMagicLink(doc, now);
  if (state !== "valid" || !doc) return { state: state as Exclude<MagicLinkState, "valid"> };
  // Atomic burn: only succeeds if it is still unused (single-use guarantee).
  const burned = await tokens.findOneAndUpdate(
    { _id: doc._id, usedAt: null },
    { $set: { usedAt: now } }
  );
  if (!burned) return { state: "used" };
  return { state: "valid", email: doc.email, purpose: doc.purpose };
}

// --- sessions -------------------------------------------------------------------

/** Create a session; returns the RAW token (only its hash is stored). */
export async function createSession(
  userId: string,
  userAgent: string,
  now: Date = new Date()
): Promise<{ token: string; session: Session }> {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = sha256Hex(token);
  const session: Session = {
    _id: `sess_${tokenHash.slice(0, 16)}`,
    tokenHash,
    userId,
    createdAt: now,
    lastSeen: now,
    userAgent: userAgent.slice(0, 256),
  };
  await collections.sessions().then((c) => c.insertOne(session));
  return { token, session };
}

/** Resolve a member from a raw session token; touches lastSeen. */
export async function memberFromSessionToken(
  rawToken: string
): Promise<User | null> {
  if (!rawToken) return null;
  const sessions = await collections.sessions();
  const session = await sessions.findOne({ tokenHash: sha256Hex(rawToken) });
  if (!session) return null;
  await sessions.updateOne(
    { _id: session._id },
    { $set: { lastSeen: new Date() } }
  );
  return collections.users().then((c) => c.findOne({ _id: session.userId }));
}

export async function destroySessionByToken(rawToken: string): Promise<void> {
  await collections
    .sessions()
    .then((c) => c.deleteOne({ tokenHash: sha256Hex(rawToken) }));
}

/** Password reset: sign out everywhere else (optionally keep one session). */
export async function revokeSessions(
  userId: string,
  exceptTokenHash?: string
): Promise<number> {
  const sessions = await collections.sessions();
  const filter = exceptTokenHash
    ? { userId, tokenHash: { $ne: exceptTokenHash } }
    : { userId };
  const result = await sessions.deleteMany(filter);
  return result.deletedCount;
}

// --- cookie plumbing (Route Handlers only) ----------------------------------------

export async function setMemberSessionCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(MEMBER_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
}

export async function clearMemberSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(MEMBER_COOKIE_NAME);
}

/** Raw session token for the current request (cookie), if any. */
export async function sessionTokenFromCookies(): Promise<string | null> {
  const store = await cookies();
  return store.get(MEMBER_COOKIE_NAME)?.value ?? null;
}

// --- user helpers ---------------------------------------------------------------

export async function findUserByEmail(email: string): Promise<User | null> {
  return collections
    .users()
    .then((c) => c.findOne({ email: email.toLowerCase() }));
}

/** Create a member account (unverified until the E1/magic link is used). */
export async function createMemberUser(params: {
  email: string;
  name?: string;
  passwordHash?: string | null;
  now?: Date;
}): Promise<User> {
  const users = await collections.users();
  const count = await users.countDocuments();
  const user: User = {
    _id: `mem_${String(count + 1).padStart(4, "0")}`,
    // Name is collected later (checkout details / iOS about-you screen).
    name: params.name ?? params.email.split("@")[0],
    email: params.email.toLowerCase(),
    joinedAt: params.now ?? new Date(),
    isDemo: false,
    flag: "new",
    passwordHash: params.passwordHash ?? null,
    emailVerified: false,
    failedAttempts: 0,
    cooloffUntil: null,
  };
  await users.insertOne(user);
  return user;
}
