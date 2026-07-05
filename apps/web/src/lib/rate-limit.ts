/**
 * Dependency-free IP rate-limiting for the auth endpoints (audit must-fix #3).
 *
 * WHY Mongo, not memory: Vercel Functions are stateless and horizontally
 * scaled, so an in-process counter would reset on every cold start and never
 * see sibling invocations. A tiny fixed-window counter in Mongo (`rate_limits`,
 * TTL-swept) holds the limit across all invocations.
 *
 * This is the IP layer that sits ON TOP OF the existing per-token defences
 * (magic-link 5-attempt code ceiling + per-email resend/cool-off in
 * member-auth.ts) — it is deliberately additive and does not replace them.
 *
 * Fixed-window semantics: each (scope, identifier) gets one counter per
 * `windowMs` bucket; the Nth+1 hit inside a bucket is refused until the bucket
 * rolls over. Simple, cheap, and good enough for abuse throttling (a burst
 * straddling a boundary can briefly allow up to ~2× limit — acceptable here).
 */
import { collections, type RateLimitRecord } from "@/lib/db";
import { rateLimitingEnabled } from "@/lib/env";

export interface RateLimitConfig {
  /** Max allowed hits per window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
}

/** ~10 verify attempts / 5 min / IP — the only way in is magic-link verify. */
export const VERIFY_RATE_LIMIT: RateLimitConfig = {
  limit: 10,
  windowMs: 5 * 60 * 1000,
};

/** Requesting a fresh link is cheaper to abuse (email spam) — a bit looser. */
export const REQUEST_RATE_LIMIT: RateLimitConfig = {
  limit: 15,
  windowMs: 5 * 60 * 1000,
};

/** Password sign-in — same ceiling as verify. */
export const SIGNIN_RATE_LIMIT: RateLimitConfig = {
  limit: 10,
  windowMs: 5 * 60 * 1000,
};

/** Admin login — ~10 attempts / 5 min / IP (Art.32 brute-force defence). */
export const ADMIN_LOGIN_RATE_LIMIT: RateLimitConfig = {
  limit: 10,
  windowMs: 5 * 60 * 1000,
};

/**
 * Gift-code redemption — ~10 attempts / 5 min / IP (security audit W-3). Stops
 * an authenticated attacker grinding the (now ≥80-bit) code space for an
 * unredeemed year to activate onto their own account.
 */
export const GIFT_REDEEM_RATE_LIMIT: RateLimitConfig = {
  limit: 10,
  windowMs: 5 * 60 * 1000,
};

export interface RateLimitResult {
  allowed: boolean;
  /** Remaining hits in the current window (0 once refused). */
  remaining: number;
  /** Seconds until the window rolls over (0 when allowed). */
  retryAfterSeconds: number;
}

/**
 * First-hop client IP from the standard proxy headers. Vercel/most proxies set
 * `x-forwarded-for: <client>, <proxy>, …`; we take the first entry. Falls back
 * to `x-real-ip`, then a shared "unknown" bucket (better to throttle unknowns
 * together than to skip limiting entirely).
 */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = req.headers.get("x-real-ip");
  if (real && real.trim()) return real.trim();
  return "unknown";
}

let ttlIndexReady = false;

/** Create the TTL index once per process (idempotent; best-effort). */
async function ensureTtlIndex(
  col: Awaited<ReturnType<typeof collections.rateLimits>>
): Promise<void> {
  if (ttlIndexReady) return;
  try {
    await col.createIndex(
      { expiresAt: 1 },
      { expireAfterSeconds: 0, name: "rate_limits_ttl" }
    );
  } catch {
    // Index may already exist, or the collection is an in-memory test fake
    // without createIndex — neither is fatal.
  }
  ttlIndexReady = true;
}

/**
 * Atomically count one hit for (scope, identifier) in the current window and
 * decide whether it is allowed. Pure of any env gate — callers decide whether
 * to enforce (see `limitByIp`).
 */
export async function enforceRateLimit(
  scope: string,
  identifier: string,
  config: RateLimitConfig,
  now: Date = new Date()
): Promise<RateLimitResult> {
  const col = await collections.rateLimits();
  await ensureTtlIndex(col);

  const windowStartMs =
    Math.floor(now.getTime() / config.windowMs) * config.windowMs;
  const windowEndMs = windowStartMs + config.windowMs;
  const _id = `${scope}:${identifier}:${windowStartMs}`;

  const updated = await col.findOneAndUpdate(
    { _id },
    {
      $inc: { count: 1 },
      $setOnInsert: {
        scope,
        identifier,
        windowStart: new Date(windowStartMs),
        // Keep the row a full extra window past expiry so the TTL sweep never
        // races an in-flight window boundary.
        expiresAt: new Date(windowEndMs + config.windowMs),
      },
    },
    { upsert: true, returnDocument: "after" }
  );

  const count = (updated as RateLimitRecord | null)?.count ?? 1;
  const allowed = count <= config.limit;
  return {
    allowed,
    remaining: Math.max(0, config.limit - count),
    retryAfterSeconds: allowed
      ? 0
      : Math.max(1, Math.ceil((windowEndMs - now.getTime()) / 1000)),
  };
}

/**
 * Route helper: enforce an IP rate-limit and, if exceeded, return a ready
 * 429 Response with a NON-REVEALING message + `Retry-After`. Returns null when
 * the request is under the limit (or limiting is disabled) — the caller
 * proceeds. Keeps the auth routes terse.
 */
export async function limitByIp(
  req: Request,
  scope: string,
  config: RateLimitConfig
): Promise<Response | null> {
  if (!rateLimitingEnabled()) return null;
  const result = await enforceRateLimit(scope, clientIp(req), config);
  if (result.allowed) return null;
  return Response.json(
    {
      error: "rate_limited",
      message:
        "Too many attempts. Please wait a few minutes and try again.",
    },
    {
      status: 429,
      headers: { "Retry-After": String(result.retryAfterSeconds) },
    }
  );
}
