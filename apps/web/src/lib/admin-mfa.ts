/**
 * Admin two-factor authentication — TOTP (RFC 6238) + encrypted-at-rest secret
 * + single-use backup codes + a short-lived "mfa-pending" step token.
 *
 * OPT-IN, per admin (docs/legal/ADMIN_AUTH_OPTIONS.md, docs/MOCKED_APIS.md §3):
 * an admin enrols their OWN MFA. Until they do, login is password-only exactly
 * as before — so the seeded admins, the bootstrap-owner path, and the e2e login
 * flow are all unchanged.
 *
 * DESIGN NOTES (security):
 *  - TOTP is HMAC-SHA1 over the 30s time-step counter, 6 digits, ±1 step
 *    tolerance (clock skew) — implemented with node:crypto only (no dep). The
 *    shared secret is 20 random bytes, exchanged as base32 (RFC 4648).
 *  - The secret is NEVER stored raw. It is sealed with AES-256-GCM under a key
 *    derived from a dedicated `MFA_ENC_KEY` env — so a DB dump alone yields no
 *    working TOTP secret. The key is FAIL-CLOSED in production (throws if MFA is
 *    used and MFA_ENC_KEY is unset); in dev it derives from SESSION_SECRET with
 *    the documented caveat that dev is not a security boundary.
 *  - Backup codes are shown ONCE at enrolment; only their SHA-256 hashes are
 *    stored, and verifying one CONSUMES it (single-use). Same unambiguous
 *    alphabet as the member magic-link codes.
 *  - Step-up login uses a signed, ≤5-minute "mfa-pending" token that carries
 *    ONLY {adminId, exp} (HMAC over SESSION_SECRET). It is NOT an admin session:
 *    it has no role, so readAdminSession() rejects it, and currentAdmin() never
 *    reads its cookie. It cannot grant admin access on its own.
 */
import {
  createHmac,
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { isProduction, sessionSecret } from "@/lib/env";
import { sha256Hex } from "@/lib/member-auth";
import { collections } from "@/lib/db";
import type { Admin } from "@/lib/models";

// ---------------------------------------------------------------------------
// Base32 (RFC 4648) — TOTP secret encoding. No dependency.
// ---------------------------------------------------------------------------

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/** Encode bytes as unpadded RFC-4648 base32 (uppercase). */
export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    out += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return out;
}

/**
 * Decode an RFC-4648 base32 string to bytes. Case-insensitive; ignores spaces,
 * dashes and `=` padding. Throws on any character outside the alphabet.
 */
export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/[\s=-]/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = BASE32_ALPHABET.indexOf(ch);
    if (idx === -1) throw new Error("invalid base32 character");
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

// ---------------------------------------------------------------------------
// TOTP (RFC 6238) — HMAC-SHA1, 6 digits, 30s step, ±1 window.
// ---------------------------------------------------------------------------

export const TOTP_DIGITS = 6;
export const TOTP_PERIOD_SECONDS = 30;
/** 20 random bytes = 160-bit secret (SHA-1 block-friendly, standard). */
const TOTP_SECRET_BYTES = 20;
export const TOTP_ISSUER = "Arcaevo Admin";

/** A fresh base32 TOTP secret (160-bit). */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(TOTP_SECRET_BYTES));
}

/** The 8-byte big-endian counter for a time step. */
function counterBuffer(step: number): Buffer {
  const buf = Buffer.alloc(8);
  // step fits comfortably in 48 bits for any realistic date; write as two
  // 32-bit halves to stay clear of JS 32-bit bitwise limits.
  buf.writeUInt32BE(Math.floor(step / 2 ** 32), 0);
  buf.writeUInt32BE(step >>> 0, 4);
  return buf;
}

/** HOTP value for a decoded key + counter (RFC 4226 dynamic truncation). */
function hotp(key: Buffer, step: number): string {
  const hmac = createHmac("sha1", key).update(counterBuffer(step)).digest();
  const offset = hmac[hmac.length - 1]! & 0x0f;
  const binary =
    ((hmac[offset]! & 0x7f) << 24) |
    ((hmac[offset + 1]! & 0xff) << 16) |
    ((hmac[offset + 2]! & 0xff) << 8) |
    (hmac[offset + 3]! & 0xff);
  return String(binary % 10 ** TOTP_DIGITS).padStart(TOTP_DIGITS, "0");
}

/** Compute the current TOTP for a base32 secret (mainly for tests). */
export function totpNow(secret: string, now: Date = new Date()): string {
  const step = Math.floor(now.getTime() / 1000 / TOTP_PERIOD_SECONDS);
  return hotp(base32Decode(secret), step);
}

/** Strip a user-typed code to digits only (spaces/dashes tolerated). */
function normalizeTotp(code: string): string {
  return code.replace(/\D/g, "");
}

/** Constant-time equality of two equal-length ASCII digit strings. */
function timingSafeEqualStr(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/**
 * Verify a submitted TOTP against a base32 secret, allowing ±1 time step for
 * clock skew. Constant-time per-candidate compare. Returns false (never throws)
 * for a malformed code or bad secret.
 */
export function verifyTotp(
  secret: string,
  code: string,
  now: Date = new Date()
): boolean {
  const digits = normalizeTotp(code);
  if (digits.length !== TOTP_DIGITS) return false;
  let key: Buffer;
  try {
    key = base32Decode(secret);
  } catch {
    return false;
  }
  if (key.length === 0) return false;
  const step = Math.floor(now.getTime() / 1000 / TOTP_PERIOD_SECONDS);
  let ok = false;
  for (const s of [step - 1, step, step + 1]) {
    // OR-accumulate so we always check all three windows (no early-out timing).
    if (timingSafeEqualStr(hotp(key, s), digits)) ok = true;
  }
  return ok;
}

/**
 * The otpauth:// provisioning URI a user pastes into their authenticator app.
 * Label + issuer are URL-encoded; algorithm/digits/period are made explicit so
 * every app agrees with verifyTotp above.
 */
export function totpUri(params: {
  email: string;
  secret: string;
  issuer?: string;
}): string {
  const issuer = params.issuer ?? TOTP_ISSUER;
  const label = encodeURIComponent(`${issuer}:${params.email}`);
  const q = new URLSearchParams({
    secret: params.secret,
    issuer,
    algorithm: "SHA1",
    digits: String(TOTP_DIGITS),
    period: String(TOTP_PERIOD_SECONDS),
  });
  return `otpauth://totp/${label}?${q.toString()}`;
}

// ---------------------------------------------------------------------------
// Encrypt the TOTP secret at rest — AES-256-GCM under a dedicated key.
// ---------------------------------------------------------------------------

/** Sealed secret as persisted on the admin record (all fields base64). */
export interface SealedSecret {
  ciphertext: string;
  iv: string;
  tag: string;
}

/** KDF salt — namespaces the derived key so it can't collide with other uses
 * of the same env material. Not a secret; the entropy is in the env value. */
const MFA_KEY_SALT = "arcaevo-admin-mfa-enc-v1";

/**
 * The 32-byte AES key. FAIL-CLOSED in production: if `MFA_ENC_KEY` is unset we
 * throw rather than fall back — so a prod server that has MFA in use but no key
 * cannot silently seal secrets under a weak/derived key. In dev it derives from
 * SESSION_SECRET (dev is not a security boundary; documented in .env.example).
 *
 * scryptSync stretches the env value to a uniform 32 bytes; the env value must
 * already be high-entropy (a long random string).
 */
function mfaEncryptionKey(): Buffer {
  const explicit = process.env.MFA_ENC_KEY;
  if (explicit && explicit.length > 0) {
    return scryptSync(explicit, MFA_KEY_SALT, 32);
  }
  if (isProduction()) {
    throw new Error(
      "MFA_ENC_KEY is required in production when admin MFA is used — the TOTP " +
        "secret is sealed with it (AES-256-GCM). Set a long random value; " +
        "refusing to derive an at-rest key from a fallback in production."
    );
  }
  // Dev/e2e only: derive from SESSION_SECRET (which itself has a dev fallback).
  return scryptSync(sessionSecret(), MFA_KEY_SALT, 32);
}

/** Seal a plaintext TOTP secret (AES-256-GCM, random 96-bit IV). */
export function sealSecret(plaintext: string): SealedSecret {
  const key = mfaEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
  };
}

/** Open a sealed TOTP secret. Throws if the key is wrong or the tag fails. */
export function openSecret(sealed: SealedSecret): string {
  const key = mfaEncryptionKey();
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(sealed.iv, "base64")
  );
  decipher.setAuthTag(Buffer.from(sealed.tag, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(sealed.ciphertext, "base64")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}

// ---------------------------------------------------------------------------
// Backup codes — single-use, shown once, only hashes stored.
// ---------------------------------------------------------------------------

/** Unambiguous alphabet (no 0/O/1/I/L) — matches the member magic-link codes. */
const BACKUP_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 32 chars, bias-free
export const BACKUP_CODE_COUNT = 8;
const BACKUP_CODE_LEN = 10; // 32^10 ≈ 1.1e15 per code

/** One raw backup code, e.g. "K4F2A-9QXBR" (grouped 5-5 for legibility). */
function generateBackupCode(): string {
  const bytes = randomBytes(BACKUP_CODE_LEN);
  let raw = "";
  for (let i = 0; i < BACKUP_CODE_LEN; i++) {
    raw += BACKUP_ALPHABET[bytes[i]! % BACKUP_ALPHABET.length];
  }
  return `${raw.slice(0, 5)}-${raw.slice(5)}`;
}

/** Strip a user-typed backup code to alphabet chars, uppercased. */
export function normalizeBackupCode(code: string): string {
  const upper = code.toUpperCase();
  let out = "";
  for (const ch of upper) if (BACKUP_ALPHABET.includes(ch)) out += ch;
  return out;
}

/** Hash a (normalised) backup code for storage/compare. */
function backupCodeHash(code: string): string {
  return sha256Hex(normalizeBackupCode(code));
}

/**
 * Generate a fresh set of backup codes. Returns the RAW codes (to show ONCE)
 * and their SHA-256 hashes (to persist). The raw codes are never stored.
 */
export function generateBackupCodes(count: number = BACKUP_CODE_COUNT): {
  codes: string[];
  hashes: string[];
} {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) codes.push(generateBackupCode());
  return { codes, hashes: codes.map(backupCodeHash) };
}

/**
 * Pure check: does `code` match one of `hashes`? Returns the surviving hashes
 * with the matched one REMOVED (single-use consumption), or null on no match.
 * Constant-time-ish: every stored hash is compared before deciding.
 */
export function consumeBackupCode(
  code: string,
  hashes: string[]
): { remaining: string[] } | null {
  const candidate = backupCodeHash(code);
  if (candidate.length !== 64) return null; // sha256 hex is always 64
  let matchIndex = -1;
  for (let i = 0; i < hashes.length; i++) {
    const h = hashes[i]!;
    if (h.length === candidate.length && timingSafeEqualStr(h, candidate)) {
      matchIndex = i;
    }
  }
  if (matchIndex === -1) return null;
  return { remaining: hashes.filter((_, i) => i !== matchIndex) };
}

// ---------------------------------------------------------------------------
// mfa-pending step token (NOT an admin session).
// ---------------------------------------------------------------------------

export const MFA_PENDING_COOKIE_NAME = "arcaevo_admin_mfa_pending";
/** The step token lives at most 5 minutes — just long enough to type a code. */
export const MFA_PENDING_TTL_MS = 5 * 60 * 1000;

interface MfaPendingPayload {
  adminId: string;
  /** Epoch ms expiry. */
  exp: number;
  /** Marks the token's purpose so it can never be mistaken for a session. */
  purpose: "mfa_pending";
}

function pendingHmac(payload: string): string {
  return createHmac("sha256", sessionSecret()).update(payload).digest("hex");
}

/**
 * Mint a signed mfa-pending token for an admin id. Carries NO role — so even if
 * it were placed in the admin session cookie, readAdminSession() would reject
 * it. Expires in MFA_PENDING_TTL_MS.
 */
export function createMfaPendingToken(
  adminId: string,
  now: Date = new Date()
): string {
  const body: MfaPendingPayload = {
    adminId,
    exp: now.getTime() + MFA_PENDING_TTL_MS,
    purpose: "mfa_pending",
  };
  const payload = Buffer.from(JSON.stringify(body)).toString("base64url");
  return `${payload}.${pendingHmac(payload)}`;
}

/**
 * Verify + decode an mfa-pending token. Returns the adminId, or null when the
 * signature is bad, the shape is wrong, the purpose is not mfa_pending, or it
 * has expired.
 */
export function readMfaPendingToken(
  value: string | undefined,
  now: Date = new Date()
): { adminId: string } | null {
  if (!value) return null;
  const dot = value.lastIndexOf(".");
  if (dot <= 0) return null;
  const payload = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  const expected = pendingHmac(payload);
  const sb = Buffer.from(sig);
  const eb = Buffer.from(expected);
  if (sb.length !== eb.length || !timingSafeEqual(sb, eb)) return null;
  try {
    const parsed = JSON.parse(
      Buffer.from(payload, "base64url").toString()
    ) as Partial<MfaPendingPayload>;
    if (parsed.purpose !== "mfa_pending") return null;
    if (typeof parsed.adminId !== "string" || !parsed.adminId) return null;
    if (typeof parsed.exp !== "number" || parsed.exp <= now.getTime()) return null;
    return { adminId: parsed.adminId };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// mfa-ENROLL step token (mandatory enrolment — NOT an admin session).
//
// Issued after a REAL admin passes the password step but has NO MFA yet: it is
// a scoped "must enrol MFA" state that lets them reach ONLY the enrolment flow
// (setup + complete), never any data route. Like the pending token it carries
// only {adminId, exp, purpose} and no role, so readAdminSession() rejects it and
// it can never stand in for a session. Slightly longer TTL than the login-time
// pending token — long enough to install an authenticator app and enrol.
// ---------------------------------------------------------------------------

export const MFA_ENROLL_COOKIE_NAME = "arcaevo_admin_mfa_enroll";
/** Enrolment window: 15 minutes (install an app, scan, confirm a code). */
export const MFA_ENROLL_TTL_MS = 15 * 60 * 1000;

interface MfaEnrollPayload {
  adminId: string;
  exp: number;
  purpose: "mfa_enroll";
}

/**
 * Mint a signed mfa-enroll token. Carries NO role — it authorises the enrolment
 * flow only and can never be mistaken for an admin session.
 */
export function createMfaEnrollToken(
  adminId: string,
  now: Date = new Date()
): string {
  const body: MfaEnrollPayload = {
    adminId,
    exp: now.getTime() + MFA_ENROLL_TTL_MS,
    purpose: "mfa_enroll",
  };
  const payload = Buffer.from(JSON.stringify(body)).toString("base64url");
  return `${payload}.${pendingHmac(payload)}`;
}

/**
 * Verify + decode an mfa-enroll token. Returns the adminId, or null when the
 * signature is bad, the shape is wrong, the purpose is not mfa_enroll, or it
 * has expired.
 */
export function readMfaEnrollToken(
  value: string | undefined,
  now: Date = new Date()
): { adminId: string } | null {
  if (!value) return null;
  const dot = value.lastIndexOf(".");
  if (dot <= 0) return null;
  const payload = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  const expected = pendingHmac(payload);
  const sb = Buffer.from(sig);
  const eb = Buffer.from(expected);
  if (sb.length !== eb.length || !timingSafeEqual(sb, eb)) return null;
  try {
    const parsed = JSON.parse(
      Buffer.from(payload, "base64url").toString()
    ) as Partial<MfaEnrollPayload>;
    if (parsed.purpose !== "mfa_enroll") return null;
    if (typeof parsed.adminId !== "string" || !parsed.adminId) return null;
    if (typeof parsed.exp !== "number" || parsed.exp <= now.getTime()) return null;
    return { adminId: parsed.adminId };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Build a fresh MFA config from a candidate secret + a proving code. PURE: it
// validates the base32 secret, verifies the TOTP, then seals the secret and
// mints backup codes — but does NOT touch the DB. Shared by /mfa/enable
// (self-service) and /mfa/enroll/complete (mandatory enrolment) so the enrol
// logic lives in exactly one place.
// ---------------------------------------------------------------------------

export type BuildMfaResult =
  | {
      ok: true;
      backupCodes: string[];
      mfa: NonNullable<Admin["mfa"]>;
    }
  | { ok: false; error: "bad_secret" | "bad_code"; message: string };

export function buildMfaEnrollment(
  secret: string,
  code: string,
  now: Date = new Date()
): BuildMfaResult {
  let secretBytes: Buffer;
  try {
    secretBytes = base32Decode(secret);
  } catch {
    return { ok: false, error: "bad_secret", message: "Invalid secret." };
  }
  if (secretBytes.length < 16) {
    return { ok: false, error: "bad_secret", message: "Secret is too short." };
  }
  if (!verifyTotp(secret, code, now)) {
    return {
      ok: false,
      error: "bad_code",
      message: "That code didn't match — check your authenticator and retry.",
    };
  }
  const { codes, hashes } = generateBackupCodes();
  // sealSecret() throws in production if MFA_ENC_KEY is unset (fail-closed) — the
  // caller surfaces that as a 500 rather than storing an unsealed secret.
  const secretEnc = sealSecret(secret);
  return {
    ok: true,
    backupCodes: codes,
    mfa: { enabledAt: now, secretEnc, backupCodeHashes: hashes },
  };
}

// ---------------------------------------------------------------------------
// Persistence helpers (the only writers of admin.mfa).
// ---------------------------------------------------------------------------

/** Is MFA enabled on this admin record? (secret-free boolean). */
export function isMfaEnabled(admin: Pick<Admin, "mfa"> | null): boolean {
  return Boolean(admin?.mfa);
}

/**
 * Whether the admin behind an identity has MFA enabled. Synthetic identities
 * (the env break-glass bootstrap owner, legacy cookies) have no DB row and thus
 * no MFA. Reads only the boolean — never decrypts anything.
 */
export async function adminHasMfa(adminId: string): Promise<boolean> {
  if (adminId === "bootstrap-owner" || adminId === "legacy-owner") return false;
  const admins = await collections.admins();
  const record = await admins.findOne({ _id: adminId });
  return isMfaEnabled(record);
}

/** Persist a freshly enrolled MFA config onto an admin. */
export async function enableAdminMfa(
  adminId: string,
  mfa: NonNullable<Admin["mfa"]>
): Promise<void> {
  const admins = await collections.admins();
  await admins.updateOne({ _id: adminId }, { $set: { mfa } });
}

/** Remove MFA from an admin (disable). */
export async function disableAdminMfa(adminId: string): Promise<void> {
  const admins = await collections.admins();
  await admins.updateOne({ _id: adminId }, { $unset: { mfa: "" } });
}

/**
 * Verify a second factor (TOTP or backup code) for an admin at login/step-up.
 * On a matching backup code the used hash is CONSUMED (removed) atomically.
 * TOTP verification decrypts the sealed secret; if that throws (e.g. a missing
 * MFA_ENC_KEY after a key loss) TOTP simply fails and backup codes still work.
 * Returns true only on a valid, unused factor.
 */
export async function verifyAdminSecondFactor(
  admin: Admin,
  code: string,
  now: Date = new Date()
): Promise<boolean> {
  if (!admin.mfa) return false;

  // 1) TOTP — decrypt the sealed secret and check ±1 window.
  try {
    const secret = openSecret(admin.mfa.secretEnc);
    if (verifyTotp(secret, code, now)) return true;
  } catch {
    // Decryption failed (bad/absent key) — fall through to backup codes.
  }

  // 2) Backup code — single-use; consume on match.
  const consumed = consumeBackupCode(code, admin.mfa.backupCodeHashes);
  if (consumed) {
    const admins = await collections.admins();
    await admins.updateOne(
      { _id: admin._id },
      { $set: { "mfa.backupCodeHashes": consumed.remaining } }
    );
    return true;
  }
  return false;
}
