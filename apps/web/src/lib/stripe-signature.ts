/**
 * Stripe webhook signature verification — the REAL replacement for the interim
 * shared-secret gate (docs/MOCKED_APIS.md §2). No SDK: we reimplement Stripe's
 * scheme with `node:crypto` exactly as documented.
 *
 *   Stripe-Signature: t=<unix>,v1=<hex>,v1=<hex>,...
 *   signed_payload   = `${t}.${rawBody}`
 *   expected         = HMAC-SHA256(signed_payload, signing_secret)  (hex)
 *
 * A request is authentic iff (a) the timestamp is within the tolerance window
 * (default 5 min, blocks replays) AND (b) some `v1` scheme signature equals the
 * expected HMAC under a constant-time compare. Stripe may send several `v1`
 * values during a secret roll — any match passes.
 *
 * IMPORTANT: verify against the RAW request body bytes, never a re-serialised
 * JSON object (key ordering/whitespace would change the HMAC).
 */
import { createHmac, timingSafeEqual } from "node:crypto";

/** Default replay-tolerance window, in seconds (Stripe's own default). */
export const DEFAULT_TOLERANCE_SECONDS = 300;

interface ParsedSignatureHeader {
  timestamp: number | null;
  /** All `v1` scheme signatures present (supports secret rotation). */
  v1: string[];
}

/** Parse a `Stripe-Signature` header into its `t` and `v1` parts. */
export function parseSignatureHeader(header: string): ParsedSignatureHeader {
  const out: ParsedSignatureHeader = { timestamp: null, v1: [] };
  for (const part of header.split(",")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (key === "t") {
      const n = Number(value);
      out.timestamp = Number.isFinite(n) ? n : null;
    } else if (key === "v1") {
      out.v1.push(value);
    }
  }
  return out;
}

/** Constant-time hex-string compare (length-safe, no early return on mismatch). */
function secureCompareHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let ab: Buffer;
  let bb: Buffer;
  try {
    ab = Buffer.from(a, "hex");
    bb = Buffer.from(b, "hex");
  } catch {
    return false;
  }
  if (ab.length !== bb.length || ab.length === 0) return false;
  return timingSafeEqual(ab, bb);
}

export interface VerifyOptions {
  /** Replay window in seconds (default 300). */
  toleranceSeconds?: number;
  /** Override "now" (seconds) — for deterministic tests. */
  nowSeconds?: number;
}

/**
 * Verify a raw webhook body against a `Stripe-Signature` header + signing
 * secret. Returns true only when the timestamp is fresh AND a v1 signature
 * matches. Never throws.
 */
export function verifyStripeSignature(
  rawBody: string,
  signatureHeader: string | null | undefined,
  signingSecret: string | undefined,
  options: VerifyOptions = {}
): boolean {
  if (!signatureHeader || !signingSecret) return false;
  const { timestamp, v1 } = parseSignatureHeader(signatureHeader);
  if (timestamp === null || v1.length === 0) return false;

  const tolerance = options.toleranceSeconds ?? DEFAULT_TOLERANCE_SECONDS;
  const now = options.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > tolerance) return false; // stale / replay

  const expected = createHmac("sha256", signingSecret)
    .update(`${timestamp}.${rawBody}`, "utf8")
    .digest("hex");

  return v1.some((candidate) => secureCompareHex(candidate, expected));
}

/**
 * Verify + JSON-parse in one step. Returns the decoded event on success, or
 * null when the signature/timestamp fails or the body isn't valid JSON. The
 * caller then dispatches on `event.type`.
 */
export function constructWebhookEvent(
  rawBody: string,
  signatureHeader: string | null | undefined,
  signingSecret: string | undefined,
  options: VerifyOptions = {}
): StripeEvent | null {
  if (!verifyStripeSignature(rawBody, signatureHeader, signingSecret, options)) {
    return null;
  }
  try {
    return JSON.parse(rawBody) as StripeEvent;
  } catch {
    return null;
  }
}

/** Minimal Stripe event envelope shape we depend on. */
export interface StripeEvent {
  id?: string;
  type: string;
  data: { object: Record<string, unknown> };
}

/**
 * Compute a valid `Stripe-Signature` header for a payload — used by tests and
 * (optionally) local tooling to synthesise signed webhooks. NOT used in the
 * request path.
 */
export function signPayloadForTest(
  rawBody: string,
  signingSecret: string,
  timestamp: number
): string {
  const sig = createHmac("sha256", signingSecret)
    .update(`${timestamp}.${rawBody}`, "utf8")
    .digest("hex");
  return `t=${timestamp},v1=${sig}`;
}
