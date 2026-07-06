/**
 * AI-narration unit tests (src/lib/ai-narration.ts + vendors/ai-narration.ts):
 *  - vendor selection factory is fail-safe OFF (flag must be exactly "true"
 *    AND ARCAEVO_AWS_* keys present) — env-stubbed like env.test.ts;
 *  - the guardrail filter: flagged/critical (watch) readings are NEVER
 *    narration-eligible ("flagged values go to a clinician, not a chatbot");
 *  - input normalisation + cache-key stability (key order / float noise /
 *    model id all behave);
 *  - the system prompt actually carries the wellness-not-diagnosis guardrails.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getNarrationVendor,
  isNarrationEligible,
  selectedNarrationVendorKind,
} from "@/lib/ai-narration";
import {
  DEFAULT_BEDROCK_MODEL_ID,
  NARRATION_SYSTEM_PROMPT,
  buildNarrationUserMessage,
  narrationCacheKey,
  narrationModelId,
  normalizeNarrationInput,
  resolveNarrationCredentials,
  type NarrationInput,
} from "@/lib/vendors/ai-narration";

afterEach(() => {
  vi.unstubAllEnvs();
});

function stubLiveEnv() {
  vi.stubEnv("ARCAEVO_AWS_ACCESS_KEY_ID", "AKIDEXAMPLE");
  vi.stubEnv("ARCAEVO_AWS_SECRET_ACCESS_KEY", "fake-secret");
}

const INPUT: NarrationInput = {
  code: "apob",
  name: "ApoB",
  unit: "g/L",
  direction: "lower_is_better",
  verdict: "improved",
  priorValue: 1.2,
  currentValue: 1.0,
  deltaPct: 17,
  templateText: "Your ApoB moved 17% in the right direction…",
};

describe("selectedNarrationVendorKind() — credentials-are-the-switch factory", () => {
  it("is OFF when no AWS creds are set (default: templates only)", () => {
    vi.stubEnv("ARCAEVO_AWS_ACCESS_KEY_ID", "");
    vi.stubEnv("ARCAEVO_AWS_SECRET_ACCESS_KEY", "");
    expect(selectedNarrationVendorKind()).toBe("off");
    expect(getNarrationVendor()).toBeNull();
  });

  it("is OFF when only one of the key pair is present", () => {
    vi.stubEnv("ARCAEVO_AWS_ACCESS_KEY_ID", "AKIDEXAMPLE");
    vi.stubEnv("ARCAEVO_AWS_SECRET_ACCESS_KEY", "");
    expect(selectedNarrationVendorKind()).toBe("off");
    vi.stubEnv("ARCAEVO_AWS_ACCESS_KEY_ID", "");
    vi.stubEnv("ARCAEVO_AWS_SECRET_ACCESS_KEY", "fake-secret");
    expect(selectedNarrationVendorKind()).toBe("off");
    expect(getNarrationVendor()).toBeNull();
  });

  it("selects bedrock (default-on) when both keys are present — no flag needed", () => {
    stubLiveEnv();
    expect(selectedNarrationVendorKind()).toBe("bedrock");
    expect(getNarrationVendor()).not.toBeNull();
  });

  it("region defaults to eu-west-1 (EU residency) and is overridable", () => {
    stubLiveEnv();
    expect(resolveNarrationCredentials()?.region).toBe("eu-west-1");
    vi.stubEnv("ARCAEVO_AWS_REGION", "eu-central-1");
    expect(resolveNarrationCredentials()?.region).toBe("eu-central-1");
  });

  it("model id defaults to the EU Haiku inference profile and is overridable", () => {
    expect(narrationModelId()).toBe(DEFAULT_BEDROCK_MODEL_ID);
    expect(DEFAULT_BEDROCK_MODEL_ID).toBe(
      "eu.anthropic.claude-haiku-4-5-20251001-v1:0"
    );
    vi.stubEnv("BEDROCK_MODEL_ID", "anthropic.claude-haiku-4-5-20251001-v1:0");
    expect(narrationModelId()).toBe("anthropic.claude-haiku-4-5-20251001-v1:0");
  });
});

describe("isNarrationEligible() — flagged values never reach the model", () => {
  const band = { low: 0.9, high: 1.1 };

  it("rejects a worsened verdict outright", () => {
    expect(
      isNarrationEligible(
        { value: 1.0, baselineBand: band, rcvVerdict: "worsened" },
        "lower_is_better"
      )
    ).toBe(false);
  });

  it("rejects a harmful out-of-band value even with a flat verdict", () => {
    // lower_is_better + above band = the clinician-watch side.
    expect(
      isNarrationEligible(
        { value: 1.2, baselineBand: band, rcvVerdict: "no_real_change" },
        "lower_is_better"
      )
    ).toBe(false);
    // higher_is_better + below band = also the watch side.
    expect(
      isNarrationEligible(
        { value: 0.8, baselineBand: band, rcvVerdict: "no_real_change" },
        "higher_is_better"
      )
    ).toBe(false);
  });

  it("rejects a reading with no verdict at all", () => {
    expect(
      isNarrationEligible(
        { value: 1.0, baselineBand: band, rcvVerdict: null },
        "lower_is_better"
      )
    ).toBe(false);
  });

  it("accepts an improved verdict and an in-band flat verdict", () => {
    expect(
      isNarrationEligible(
        { value: 0.95, baselineBand: band, rcvVerdict: "improved" },
        "lower_is_better"
      )
    ).toBe(true);
    expect(
      isNarrationEligible(
        { value: 1.0, baselineBand: band, rcvVerdict: "no_real_change" },
        "lower_is_better"
      )
    ).toBe(true);
  });

  it("accepts a beneficially out-of-band value (below band, lower_is_better)", () => {
    expect(
      isNarrationEligible(
        { value: 0.7, baselineBand: band, rcvVerdict: "no_real_change" },
        "lower_is_better"
      )
    ).toBe(true);
  });
});

describe("normalisation + cache-key stability", () => {
  it("is insensitive to object key order", () => {
    const reordered = {
      templateText: INPUT.templateText,
      deltaPct: INPUT.deltaPct,
      currentValue: INPUT.currentValue,
      priorValue: INPUT.priorValue,
      verdict: INPUT.verdict,
      direction: INPUT.direction,
      unit: INPUT.unit,
      name: INPUT.name,
      code: INPUT.code,
    } as NarrationInput;
    expect(narrationCacheKey(reordered, "m")).toBe(narrationCacheKey(INPUT, "m"));
  });

  it("rounds float noise so equivalent readings share a cache entry", () => {
    const noisy = { ...INPUT, currentValue: 1.00000001 };
    expect(narrationCacheKey(noisy, "m")).toBe(narrationCacheKey(INPUT, "m"));
  });

  it("treats absent wearableContext as an empty list", () => {
    expect(narrationCacheKey({ ...INPUT, wearableContext: [] }, "m")).toBe(
      narrationCacheKey(INPUT, "m")
    );
  });

  it("changes with the model id (a model swap never serves stale text)", () => {
    expect(narrationCacheKey(INPUT, "model-a")).not.toBe(
      narrationCacheKey(INPUT, "model-b")
    );
  });

  it("changes when a fact changes", () => {
    expect(narrationCacheKey({ ...INPUT, deltaPct: 18 }, "m")).not.toBe(
      narrationCacheKey(INPUT, "m")
    );
  });

  it("normalises code casing + trims strings", () => {
    const n = normalizeNarrationInput({ ...INPUT, code: " ApoB ", name: " ApoB " });
    expect(n.code).toBe("apob");
    expect(n.name).toBe("ApoB");
  });
});

describe("guardrail prompt + fact sheet (PII-free by construction)", () => {
  it("system prompt locks the verdict and forbids diagnosis language", () => {
    expect(NARRATION_SYSTEM_PROMPT).toMatch(/never change, soften, contradict/i);
    for (const word of [
      '"diagnosis"',
      '"disease"',
      '"prescribe"',
      '"medication"',
      '"treatment"',
    ]) {
      expect(NARRATION_SYSTEM_PROMPT).toContain(word);
    }
    expect(NARRATION_SYSTEM_PROMPT).toMatch(/wellness language only/i);
  });

  it("user message carries facts only — codes, values, units, verdict, delta", () => {
    const msg = buildNarrationUserMessage(INPUT);
    expect(msg).toContain("Marker: ApoB (apob)");
    expect(msg).toContain("Prior value: 1.2");
    expect(msg).toContain("Latest value: 1");
    expect(msg).toContain("Change: 17%");
    expect(msg).toContain("Deterministic verdict (final): improved");
    expect(msg).toContain(`Template to rewrite: ${INPUT.templateText}`);
    // The input shape has nowhere to put PII — assert the message has none of
    // the usual member markers regardless.
    expect(msg).not.toMatch(/mem_|@|email|eircode/i);
  });
});
