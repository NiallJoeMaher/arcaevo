/**
 * AI-narration vendor interface + the pure building blocks every implementer
 * shares (guardrail system prompt, fact-sheet user message, input
 * normalisation, cache key). Mirrors the payments vendor pattern
 * (src/lib/vendors/types.ts + stripe.ts): routes import ONLY the selection
 * factory in src/lib/ai-narration.ts; this file is the dependency-free leaf.
 *
 * PRODUCT RULE (locked): "deterministic rules decide, AI narrates." The model
 * is only ever asked to REWRITE the template `text` of an insight whose
 * verdict was already decided by lib/rcv.ts — it never decides, changes or
 * softens a verdict, and flagged/watch values are filtered out BEFORE any
 * input object is even built (src/lib/ai-narration.ts `isNarrationEligible`).
 *
 * PRIVACY (non-negotiable): `NarrationInput` carries NO PII — no member ids,
 * names or emails. Every field is either shared rule metadata (marker
 * code/display name/unit/direction from the global biomarker_rules table) or
 * the numeric reading values/delta and the verdict word. Because the input is
 * member-free, the narration cache is content-addressed and safely shared
 * across members (same facts → same sentence).
 */
import { createHash } from "node:crypto";
import type { RcvVerdict, RuleDirection } from "@/lib/models";

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** The rule-generated facts of one insight — nothing member-identifying.
 *
 * NOTE: the PII-free-BY-TYPE guarantee holds only because the insights route
 * narrates clinicianReviewed readings exclusively, whose `code`/`unit`/`name`
 * come from the shared biomarker_rules table. Self-reported readings carry
 * unconstrained member-typed `code`/`unit` strings and must NEVER flow here. */
export interface NarrationInput {
  /** BiomarkerRule code, e.g. "apob". */
  code: string;
  /** Marker display name from the shared rules table, e.g. "ApoB". */
  name: string;
  unit: string;
  direction: RuleDirection;
  /** Deterministic verdict (lib/rcv.ts). NEVER "worsened" — those are
   * clinician territory and are filtered out before an input is built. */
  verdict: RcvVerdict;
  priorValue: number;
  currentValue: number;
  /** Absolute rounded percent change between the two readings. */
  deltaPct: number;
  /** The deterministic template sentence the model rewrites (facts-only). */
  templateText: string;
  /** Optional non-PII wearable context strings (e.g. fusion pairings). */
  wearableContext?: string[];
}

export interface NarrationVendor {
  /**
   * Rewrite the template in warmer, member-friendly language. Returns the
   * narration text, or null on ANY failure/guardrail rejection — callers
   * always have the deterministic template to fall back on. Must never throw.
   */
  narrate(input: NarrationInput): Promise<string | null>;
}

// ---------------------------------------------------------------------------
// Config (env) — model id + credentials
// ---------------------------------------------------------------------------

/**
 * Default Bedrock model id: the EU cross-region inference profile for Claude
 * Haiku 4.5 (EU data residency — GDPR; the LLM provider is listed as a
 * sub-processor on /legal/privacy). Some AWS accounts expose the bare
 * `anthropic.claude-haiku-4-5-20251001-v1:0` form instead, which is exactly
 * why the id is env-overridable via BEDROCK_MODEL_ID.
 */
export const DEFAULT_BEDROCK_MODEL_ID =
  "eu.anthropic.claude-haiku-4-5-20251001-v1:0";

export function narrationModelId(): string {
  const fromEnv = process.env.BEDROCK_MODEL_ID?.trim();
  return fromEnv && fromEnv.length > 0 ? fromEnv : DEFAULT_BEDROCK_MODEL_ID;
}

export interface NarrationCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
}

/**
 * Resolve the AWS creds for Bedrock from the env. Reuses the app-wide
 * ARCAEVO_AWS_* vars (bare AWS_* names are RESERVED on Vercel — see
 * email.ses.ts). Region defaults to eu-west-1 (EU residency). Returns null
 * when the key pair is incomplete — the factory then keeps narration OFF.
 */
export function resolveNarrationCredentials(): NarrationCredentials | null {
  const accessKeyId = process.env.ARCAEVO_AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.ARCAEVO_AWS_SECRET_ACCESS_KEY;
  if (!accessKeyId || !secretAccessKey) return null;
  return {
    accessKeyId,
    secretAccessKey,
    region: process.env.ARCAEVO_AWS_REGION ?? "eu-west-1",
  };
}

// ---------------------------------------------------------------------------
// Guardrail prompt + fact sheet
// ---------------------------------------------------------------------------

/**
 * The guardrail system prompt. Enforces the two non-negotiables in-model:
 * the verdict is immutable, and the language stays wellness-not-diagnosis
 * (no disease names, no medical advice, no medication talk). The Bedrock
 * vendor ALSO rejects outputs that slip (see ai-narration.bedrock.ts) —
 * belt and braces; the template ships whenever either layer balks.
 */
export const NARRATION_SYSTEM_PROMPT = [
  "You rewrite one short wellness insight for a health-tracking member, in a warm, plain-English voice.",
  "The verdict was decided by deterministic rules and is FINAL: never change, soften, contradict or second-guess it, and never recompute the numbers.",
  "Wellness language only — this is not a medical product. You must NOT diagnose, name any disease or medical condition, give medical advice, or mention medication, prescriptions, dosages or treatment.",
  'Never use the words "diagnosis", "diagnose", "disease", "prescribe", "prescription", "medication" or "treatment".',
  "You are given only a biomarker's code, display name, unit, values and change — never invent personal details, causes, or health claims beyond the stated facts.",
  "At most you may suggest keeping an eye on the marker at the next test.",
  "Reply with the rewritten insight ONLY: one or two sentences, no preamble, no quotes, no markdown.",
].join("\n");

/** Render the facts as the user message — a plain, deterministic fact sheet. */
export function buildNarrationUserMessage(input: NarrationInput): string {
  const lines = [
    `Marker: ${input.name} (${input.code})`,
    `Unit: ${input.unit}`,
    `Better direction: ${input.direction === "lower_is_better" ? "lower" : "higher"}`,
    `Prior value: ${input.priorValue}`,
    `Latest value: ${input.currentValue}`,
    `Change: ${input.deltaPct}%`,
    `Deterministic verdict (final): ${input.verdict}`,
  ];
  if (input.wearableContext && input.wearableContext.length > 0) {
    lines.push(`Wearable context: ${input.wearableContext.join("; ")}`);
  }
  lines.push(`Template to rewrite: ${input.templateText}`);
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Normalisation + cache key
// ---------------------------------------------------------------------------

/**
 * Canonical form of an input for hashing: fixed field order, trimmed strings,
 * values rounded to 4dp (so float noise can't fragment the cache), absent
 * wearable context === empty list. Pure + deterministic — the hash-stability
 * unit tests depend on it.
 */
export function normalizeNarrationInput(
  input: NarrationInput
): Record<string, unknown> {
  const round = (n: number) => Math.round(n * 10_000) / 10_000;
  return {
    code: input.code.trim().toLowerCase(),
    name: input.name.trim(),
    unit: input.unit.trim(),
    direction: input.direction,
    verdict: input.verdict,
    priorValue: round(input.priorValue),
    currentValue: round(input.currentValue),
    deltaPct: round(input.deltaPct),
    templateText: input.templateText.trim(),
    wearableContext: (input.wearableContext ?? []).map((s) => s.trim()),
  };
}

/**
 * Cache `_id`: sha256 over the normalised input + the model id, so a model
 * swap (BEDROCK_MODEL_ID change) never serves stale narrations from the old
 * model. Field order is fixed by normalizeNarrationInput, so equal facts
 * always hash equal regardless of object key order at the call site.
 */
export function narrationCacheKey(
  input: NarrationInput,
  modelId: string
): string {
  const normalized = normalizeNarrationInput(input);
  return createHash("sha256")
    .update(JSON.stringify({ modelId, input: normalized }), "utf8")
    .digest("hex");
}
