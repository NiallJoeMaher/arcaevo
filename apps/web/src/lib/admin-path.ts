/**
 * Admin dashboard URL obscurity (defense-in-depth, NOT a substitute for the
 * auth guards). The human admin surface must not sit at the trivially-probed
 * `/admin`. Instead it is served under a configurable secret path segment
 * (`ADMIN_PATH_SLUG`); `src/proxy.ts` rewrites `/{slug}/*` → the canonical
 * `/admin/*` App Router tree and returns a 404 for direct `/admin/*` hits in
 * production, so scanners probing `/admin`, `/wp-admin`, etc. find nothing.
 *
 * IMPORTANT: this is obscurity layered ON TOP of `requireAdmin`/role checks and
 * the API guards — never instead of them. The API routes under
 * `/api/v1/admin/*` are NOT obscured (they are guarded by the session checks).
 *
 * The slug is intentionally NEVER shipped to the client bundle (no
 * `NEXT_PUBLIC_` mirror) — that would leak it to every visitor of the public
 * site. Server components/routes read it here and pass the resolved base path
 * down to client components as a prop (only ever rendered under the admin tree).
 */

/**
 * Default slug. Kept as `admin` so dev + e2e reach the dashboard at `/admin`
 * with zero config (the proxy is a no-op when the slug is the default).
 * PRODUCTION MUST set `ADMIN_PATH_SLUG` to a long, random, non-guessable value.
 */
export const DEFAULT_ADMIN_SLUG = "admin";

/**
 * Resolve the configured admin path slug (no leading/trailing slashes). Falls
 * back to the default when unset/blank. Only the first path segment is used.
 */
export function adminPathSlug(): string {
  const raw = process.env.ADMIN_PATH_SLUG?.trim().replace(/^\/+|\/+$/g, "");
  if (!raw) return DEFAULT_ADMIN_SLUG;
  // Guard against a multi-segment or whitespace-y value — take the first segment.
  const first = raw.split("/")[0]!.trim();
  return first.length > 0 ? first : DEFAULT_ADMIN_SLUG;
}

/** The admin base path, e.g. `/admin` or `/x7f3…`. Leading slash, no trailing. */
export function adminBasePath(): string {
  return `/${adminPathSlug()}`;
}

/**
 * Build a browser-facing admin URL under the configured slug, e.g.
 * `adminPath("members")` → `/{slug}/members`, `adminPath()` → `/{slug}`.
 * Use this for every redirect target, `<Link>`/`<a>` href, and `router.push`
 * so the address bar (and thus the proxy) always uses the secret slug.
 */
export function adminPath(subpath = ""): string {
  const clean = subpath.replace(/^\/+/, "");
  const base = adminBasePath();
  return clean ? `${base}/${clean}` : base;
}

/** The canonical (un-obscured) App Router base — always `/admin`. */
export const CANONICAL_ADMIN_BASE = "/admin";

export type AdminProxyDecision =
  | { action: "pass" }
  | { action: "rewrite"; pathname: string }
  | { action: "hide" };

/**
 * Pure routing decision for the proxy (unit-testable without NextRequest):
 *  - default slug ⇒ `/admin` is the real, un-obscured path ⇒ pass through;
 *  - secret slug + a `/{slug}` or `/{slug}/*` request ⇒ rewrite to `/admin(/*)`;
 *  - secret slug + a direct `/admin` or `/admin/*` request in production ⇒ hide
 *    (serve a 404 so the admin surface is invisible to scanners);
 *  - everything else ⇒ pass through untouched.
 *
 * `/admin` is deliberately still reachable in DEV even with a custom slug, so a
 * developer isn't locked out; only production hides the canonical path.
 */
export function decideAdminProxy(
  pathname: string,
  slug: string,
  isProd: boolean
): AdminProxyDecision {
  if (slug === DEFAULT_ADMIN_SLUG) return { action: "pass" };

  const slugBase = `/${slug}`;
  if (pathname === slugBase || pathname.startsWith(`${slugBase}/`)) {
    const rest = pathname.slice(slugBase.length); // "" | "/..."
    return { action: "rewrite", pathname: `${CANONICAL_ADMIN_BASE}${rest}` };
  }

  if (
    isProd &&
    (pathname === CANONICAL_ADMIN_BASE ||
      pathname.startsWith(`${CANONICAL_ADMIN_BASE}/`))
  ) {
    return { action: "hide" };
  }

  return { action: "pass" };
}
