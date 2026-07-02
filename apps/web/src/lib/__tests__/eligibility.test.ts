/**
 * Unit tests for src/lib/eligibility.ts — routing-key extraction/validation
 * and allowlist evaluation (pure functions; the Mongo-backed checkEligibility
 * wrapper is exercised in e2e).
 */
import { describe, expect, it } from "vitest";
import {
  LAUNCH_ALLOWLIST,
  countyForRoutingKey,
  evaluateRoutingKey,
  extractRoutingKey,
} from "@/lib/eligibility";

describe("extractRoutingKey — case/space tolerant, first 3 chars only", () => {
  it("takes the routing key from a full Eircode", () => {
    expect(extractRoutingKey("D08 XY24")).toBe("D08");
    expect(extractRoutingKey("T12AB90")).toBe("T12");
  });

  it("is case and whitespace tolerant", () => {
    expect(extractRoutingKey("d08 xy24")).toBe("D08");
    expect(extractRoutingKey("  d08\txy24 ")).toBe("D08");
    expect(extractRoutingKey("a94")).toBe("A94");
  });

  it("accepts a bare routing key", () => {
    expect(extractRoutingKey("K67")).toBe("K67");
  });

  it("handles the one non-numeric Dublin key, D6W", () => {
    expect(extractRoutingKey("D6W")).toBe("D6W");
    expect(extractRoutingKey("d6w v024")).toBe("D6W");
  });

  it("rejects malformed input", () => {
    expect(extractRoutingKey("")).toBeNull();
    expect(extractRoutingKey("DUBLIN")).toBeNull(); // letters where digits go
    expect(extractRoutingKey("8D0")).toBeNull(); // digit first
    expect(extractRoutingKey("D0")).toBeNull(); // too short
    expect(extractRoutingKey("D08 XY24 EXTRA")).toBeNull(); // too long
  });
});

describe("LAUNCH_ALLOWLIST — verbatim from the handoff", () => {
  it("contains exactly the 31 launch routing keys", () => {
    // D01–D18 (18) + D20/D22/D24/D6W (4) + A94/A96 (2) + K32…K78 (7) = 31
    expect(LAUNCH_ALLOWLIST).toHaveLength(31);
    // D01–D18 + D20/D22/D24/D6W (22 Dublin) + A94/A96 + K32/K34/K36/K45/K56/K67/K78
    for (let i = 1; i <= 18; i++) {
      expect(LAUNCH_ALLOWLIST).toContain(`D${String(i).padStart(2, "0")}`);
    }
    for (const key of ["D20", "D22", "D24", "D6W", "A94", "A96", "K32", "K34", "K36", "K45", "K56", "K67", "K78"]) {
      expect(LAUNCH_ALLOWLIST).toContain(key);
    }
    // Famous non-members: D19/D21/D23 don't exist as Dublin districts.
    expect(LAUNCH_ALLOWLIST).not.toContain("D19");
    expect(LAUNCH_ALLOWLIST).not.toContain("D21");
  });
});

describe("evaluateRoutingKey against the launch allowlist", () => {
  it("passes the designed pass case: D08 XY24", () => {
    expect(evaluateRoutingKey("D08 XY24", LAUNCH_ALLOWLIST)).toEqual({
      status: "eligible",
      routingKey: "D08",
      county: "Dublin",
    });
  });

  it("fails the designed fail case: T12 AB90 (Cork) → waitlist", () => {
    expect(evaluateRoutingKey("T12 AB90", LAUNCH_ALLOWLIST)).toEqual({
      status: "ineligible",
      routingKey: "T12",
      county: "Cork",
    });
  });

  it("every allowlisted key evaluates eligible", () => {
    for (const key of LAUNCH_ALLOWLIST) {
      expect(evaluateRoutingKey(key, LAUNCH_ALLOWLIST).status).toBe("eligible");
    }
  });

  it("invalid input reports invalid, not ineligible", () => {
    expect(evaluateRoutingKey("not an eircode", LAUNCH_ALLOWLIST)).toEqual({
      status: "invalid",
      routingKey: null,
      county: null,
    });
  });

  it("the allowlist is config: an expanded list flips T12 to eligible", () => {
    const corkOpen = [...LAUNCH_ALLOWLIST, "T12"];
    expect(evaluateRoutingKey("T12 AB90", corkOpen).status).toBe("eligible");
  });
});

describe("countyForRoutingKey", () => {
  it("maps Dublin keys (D…, A94/A96, K north county) to Dublin", () => {
    expect(countyForRoutingKey("D08")).toBe("Dublin");
    expect(countyForRoutingKey("D6W")).toBe("Dublin");
    expect(countyForRoutingKey("A94")).toBe("Dublin");
    expect(countyForRoutingKey("K78")).toBe("Dublin");
  });

  it("maps known regional keys and falls back to Ireland", () => {
    expect(countyForRoutingKey("T12")).toBe("Cork");
    expect(countyForRoutingKey("H91")).toBe("Galway");
    expect(countyForRoutingKey("V94")).toBe("Limerick");
    expect(countyForRoutingKey("Z99")).toBe("Ireland");
  });
});
