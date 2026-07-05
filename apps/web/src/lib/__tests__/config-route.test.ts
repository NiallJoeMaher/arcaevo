/**
 * GET /api/v1/config — the PUBLIC runtime-config endpoint the iOS app reads to
 * learn whether the blood tiers are live (flip server-side, no rebuild).
 *
 * Contract this locks in for the iOS side:
 *   { "bloodTiersEnabled": boolean }
 * — exact shape, boolean type, no secrets, both flag states.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/v1/config/route";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("GET /api/v1/config", () => {
  it("returns { bloodTiersEnabled: true } when the flag is on", async () => {
    vi.stubEnv("BLOOD_TIERS_ENABLED", "true");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ bloodTiersEnabled: true });
    expect(typeof body.bloodTiersEnabled).toBe("boolean");
  });

  it("returns { bloodTiersEnabled: false } when the flag is unset (fail-safe)", async () => {
    vi.stubEnv("BLOOD_TIERS_ENABLED", "");
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ bloodTiersEnabled: false });
  });

  it("is public + cache-friendly (no auth, sets a Cache-Control header)", async () => {
    vi.stubEnv("BLOOD_TIERS_ENABLED", "true");
    const res = await GET();
    expect(res.headers.get("cache-control")).toContain("public");
  });

  it("leaks no secrets — the body has exactly the documented key", async () => {
    vi.stubEnv("BLOOD_TIERS_ENABLED", "true");
    const body = await (await GET()).json();
    expect(Object.keys(body)).toEqual(["bloodTiersEnabled"]);
  });
});
