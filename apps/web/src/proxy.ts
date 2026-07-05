/**
 * Proxy (Next.js 16's renamed `middleware`; runs on the Node.js runtime).
 *
 * Sole job: OBSCURE the human admin dashboard so it does not sit at the
 * trivially-probed `/admin` (defense-in-depth on top of the auth guards — see
 * src/lib/admin-path.ts). When `ADMIN_PATH_SLUG` is a secret value it rewrites
 * `/{slug}/*` onto the canonical `/admin/*` App Router tree and returns a 404
 * for direct `/admin/*` requests in production, so scanners hitting `/admin`,
 * `/wp-admin`, … find nothing. With the default slug (`admin`, used by dev +
 * e2e) this is a pass-through no-op, so `/admin` keeps working with zero config.
 *
 * It NEVER touches `/api/*` (the admin API stays where it is, guarded by
 * requireAdmin/role — obscurity is for the pages only) — the matcher excludes
 * it. No secrets are logged.
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { adminPathSlug, decideAdminProxy } from "@/lib/admin-path";
import { isProduction } from "@/lib/env";

export const config = {
  // Run on page routes only; skip the API, Next internals and metadata files.
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};

export function proxy(req: NextRequest) {
  const decision = decideAdminProxy(
    req.nextUrl.pathname,
    adminPathSlug(),
    isProduction()
  );

  if (decision.action === "rewrite") {
    const url = req.nextUrl.clone();
    url.pathname = decision.pathname;
    return NextResponse.rewrite(url);
  }

  if (decision.action === "hide") {
    // Rewrite to a guaranteed-nonexistent path so Next serves its standard
    // 404 (status 404) — identical to any unknown URL, revealing nothing about
    // the admin surface.
    const url = req.nextUrl.clone();
    url.pathname = "/_arcaevo_not_found";
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}
