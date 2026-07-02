/**
 * Unit tests for src/lib/dunning.ts — the 0/3/10/14-day dunning ladder
 * (design_handoff_v2 §14 X2). Pure functions only.
 */
import { describe, expect, it } from "vitest";
import {
  DUNNING_SCHEDULE_DAYS,
  dunningStageAt,
  dunningStageForElapsedDays,
  isDunningActive,
  isReadOnly,
  nextDunningStage,
  pauseDate,
  resolveDunning,
} from "@/lib/dunning";

describe("nextDunningStage — one step per failed charge, forward-only", () => {
  it("walks none → day0 → day3 → day10 → paused", () => {
    expect(nextDunningStage("none")).toBe("day0");
    expect(nextDunningStage("day0")).toBe("day3");
    expect(nextDunningStage("day3")).toBe("day10");
    expect(nextDunningStage("day10")).toBe("paused");
  });

  it("clamps at paused — pause is not punishment escalation", () => {
    expect(nextDunningStage("paused")).toBe("paused");
  });
});

describe("dunningStageForElapsedDays — the designed timeline", () => {
  it("matches the 0/3/10/14 schedule", () => {
    expect(DUNNING_SCHEDULE_DAYS).toEqual({ day0: 0, day3: 3, day10: 10, paused: 14 });
    expect(dunningStageForElapsedDays(0)).toBe("day0");
    expect(dunningStageForElapsedDays(1)).toBe("day0");
    expect(dunningStageForElapsedDays(2)).toBe("day0");
    expect(dunningStageForElapsedDays(3)).toBe("day3");
    expect(dunningStageForElapsedDays(9)).toBe("day3");
    expect(dunningStageForElapsedDays(10)).toBe("day10");
    expect(dunningStageForElapsedDays(13)).toBe("day10");
    expect(dunningStageForElapsedDays(14)).toBe("paused");
    expect(dunningStageForElapsedDays(400)).toBe("paused"); // nothing deleted, ever
  });

  it("negative elapsed time (clock skew) means no dunning", () => {
    expect(dunningStageForElapsedDays(-1)).toBe("none");
  });

  it("dunningStageAt works over real Dates", () => {
    const failed = new Date("2026-07-02T09:00:00Z");
    expect(dunningStageAt(failed, new Date("2026-07-02T10:00:00Z"))).toBe("day0");
    expect(dunningStageAt(failed, new Date("2026-07-05T09:00:00Z"))).toBe("day3");
    expect(dunningStageAt(failed, new Date("2026-07-16T09:00:00Z"))).toBe("paused");
  });
});

describe("read-only pause semantics", () => {
  it("only the paused stage is read-only — full access until day 14", () => {
    expect(isReadOnly("none")).toBe(false);
    expect(isReadOnly("day0")).toBe(false);
    expect(isReadOnly("day3")).toBe(false);
    expect(isReadOnly("day10")).toBe(false);
    expect(isReadOnly("paused")).toBe(true);
  });

  it("the quiet banner shows for every active stage", () => {
    expect(isDunningActive("none")).toBe(false);
    expect(isDunningActive("day0")).toBe(true);
    expect(isDunningActive("paused")).toBe(true);
  });
});

describe("resolution — update card → instant resume", () => {
  it("resolves to a clean slate from any stage", () => {
    expect(resolveDunning()).toEqual({ dunningStage: "none", dunningStartedAt: null });
  });

  it("pauseDate is exactly 14 days after the first failure (E9 footer)", () => {
    const failed = new Date("2026-07-02T09:00:00Z");
    expect(pauseDate(failed).toISOString()).toBe("2026-07-16T09:00:00.000Z");
  });
});
