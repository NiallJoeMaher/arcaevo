/**
 * RCV parity guard (web side).
 *
 * These tests fail if the canonical biomarker RCV thresholds change silently or
 * if the seed / the public endpoint stop agreeing with the canonical module.
 * The literal table below is intentional: any change to a threshold is a
 * deliberate clinical decision and must be made here AND in the iOS parity test
 * (`ArcaevoKitTests/RCVParityTests.swift`) in the same change. See
 * docs/RCV_THRESHOLDS.md — WEB IS THE SINGLE SOURCE OF TRUTH.
 */
import { describe, expect, it } from "vitest";
import {
  CANONICAL_BIOMARKER_RULES,
  canonicalRcvMap,
  publicBiomarkerRules,
} from "@/lib/biomarker-rules";
import { GET } from "@/app/api/v1/biomarker-rules/route";

/**
 * The canonical RCV % as literals. WEB IS CANONICAL. Changing a number here is
 * a deliberate clinical decision — update docs/RCV_THRESHOLDS.md and the iOS
 * parity test too.
 */
const CANONICAL_RCV: Record<string, number> = {
  apob: 10,
  ldl_c: 17,
  hdl_c: 12,
  triglycerides: 40,
  hba1c: 6,
  fasting_glucose: 11,
  hs_crp: 85,
  ferritin: 30,
  vitamin_d: 25,
  tsh: 20,
  alt: 25,
  creatinine: 9,
  testosterone: 20,
  cortisol: 45,
  omega3_index: 15,
};

/** The 5 markers iOS also hardcodes — the ones that had drifted. */
const IOS_SHARED = ["apob", "hba1c", "hs_crp", "vitamin_d", "ferritin"] as const;

describe("canonical biomarker RCV table", () => {
  it("matches the documented canonical literals exactly (deliberate-change guard)", () => {
    expect(canonicalRcvMap()).toEqual(CANONICAL_RCV);
  });

  it("has a unique code for every rule and none are missing from the literal table", () => {
    const codes = CANONICAL_BIOMARKER_RULES.map((r) => r.code);
    expect(new Set(codes).size).toBe(codes.length);
    expect(new Set(codes)).toEqual(new Set(Object.keys(CANONICAL_RCV)));
  });

  it("every rcvPercent is a positive finite number", () => {
    for (const r of CANONICAL_BIOMARKER_RULES) {
      expect(Number.isFinite(r.rcvPercent)).toBe(true);
      expect(r.rcvPercent).toBeGreaterThan(0);
    }
  });

  it("pins the 5 iOS-shared markers so a web edit can't silently re-open the drift", () => {
    const map = canonicalRcvMap();
    expect(IOS_SHARED.map((c) => map[c])).toEqual([10, 6, 85, 25, 30]);
  });
});

describe("GET /api/v1/biomarker-rules", () => {
  it("serves exactly the canonical map (endpoint ↔ module parity)", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      rules: { code: string; rcvPercent: number; unit: string; direction: string }[];
    };
    const fromEndpoint = Object.fromEntries(body.rules.map((r) => [r.code, r.rcvPercent]));
    expect(fromEndpoint).toEqual(CANONICAL_RCV);
  });

  it("exposes the documented public shape (code, rcvPercent, unit, direction — no secrets)", async () => {
    const body = (await (await GET()).json()) as {
      rules: Record<string, unknown>[];
    };
    for (const rule of body.rules) {
      expect(Object.keys(rule).sort()).toEqual(
        ["code", "direction", "rcvPercent", "unit"].sort()
      );
    }
  });

  it("is public + cache-friendly", async () => {
    const res = await GET();
    expect(res.headers.get("cache-control")).toContain("public");
  });

  it("the endpoint projection equals publicBiomarkerRules()", async () => {
    const body = (await (await GET()).json()) as { rules: unknown[] };
    expect(body.rules).toEqual(publicBiomarkerRules());
  });
});
