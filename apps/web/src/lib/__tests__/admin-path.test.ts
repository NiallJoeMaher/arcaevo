/**
 * Admin URL-obscurity helpers: the configured slug, the base-path/link builders,
 * and the pure proxy routing decision (rewrite `/{slug}/*` → `/admin/*`, hide
 * direct `/admin/*` in prod, pass everything else). Pure — no NextRequest.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  adminBasePath,
  adminPath,
  adminPathSlug,
  decideAdminProxy,
  DEFAULT_ADMIN_SLUG,
} from "@/lib/admin-path";

afterEach(() => vi.unstubAllEnvs());

describe("adminPathSlug / adminBasePath / adminPath", () => {
  it("defaults to 'admin' when unset (dev/e2e reach /admin with zero config)", () => {
    expect(adminPathSlug()).toBe("admin");
    expect(adminBasePath()).toBe("/admin");
    expect(adminPath("members")).toBe("/admin/members");
    expect(adminPath()).toBe("/admin");
  });

  it("uses a configured secret slug and strips slashes/whitespace", () => {
    vi.stubEnv("ADMIN_PATH_SLUG", " /x7f3-secret/ ");
    expect(adminPathSlug()).toBe("x7f3-secret");
    expect(adminBasePath()).toBe("/x7f3-secret");
    expect(adminPath("login")).toBe("/x7f3-secret/login");
    expect(adminPath("/consent")).toBe("/x7f3-secret/consent");
  });

  it("falls back to the default for a blank value", () => {
    vi.stubEnv("ADMIN_PATH_SLUG", "   ");
    expect(adminPathSlug()).toBe(DEFAULT_ADMIN_SLUG);
  });
});

describe("decideAdminProxy", () => {
  it("default slug: everything passes through (no obscuring in dev/e2e)", () => {
    expect(decideAdminProxy("/admin", "admin", true)).toEqual({ action: "pass" });
    expect(decideAdminProxy("/admin/members", "admin", true)).toEqual({
      action: "pass",
    });
    expect(decideAdminProxy("/pricing", "admin", true)).toEqual({
      action: "pass",
    });
  });

  it("secret slug: rewrites /{slug} and /{slug}/* onto /admin(/*)", () => {
    expect(decideAdminProxy("/s3cr3t", "s3cr3t", true)).toEqual({
      action: "rewrite",
      pathname: "/admin",
    });
    expect(decideAdminProxy("/s3cr3t/members", "s3cr3t", true)).toEqual({
      action: "rewrite",
      pathname: "/admin/members",
    });
    expect(decideAdminProxy("/s3cr3t/login", "s3cr3t", false)).toEqual({
      action: "rewrite",
      pathname: "/admin/login",
    });
  });

  it("secret slug: hides direct /admin and /admin/* in production (404)", () => {
    expect(decideAdminProxy("/admin", "s3cr3t", true)).toEqual({
      action: "hide",
    });
    expect(decideAdminProxy("/admin/results", "s3cr3t", true)).toEqual({
      action: "hide",
    });
  });

  it("secret slug: /admin still works in DEV (not hidden) so devs aren't locked out", () => {
    expect(decideAdminProxy("/admin", "s3cr3t", false)).toEqual({
      action: "pass",
    });
    expect(decideAdminProxy("/admin/members", "s3cr3t", false)).toEqual({
      action: "pass",
    });
  });

  it("secret slug: unrelated paths + lookalikes are untouched", () => {
    expect(decideAdminProxy("/pricing", "s3cr3t", true)).toEqual({
      action: "pass",
    });
    // A path that merely starts with the slug string but isn't a segment boundary.
    expect(decideAdminProxy("/s3cr3taddon", "s3cr3t", true)).toEqual({
      action: "pass",
    });
  });
});
