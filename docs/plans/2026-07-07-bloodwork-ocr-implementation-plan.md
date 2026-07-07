# Bloodwork OCR + shared AI-task framework — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Use superpowers:test-driven-development for every task. When touching the Bedrock/Anthropic call, load the `claude-api` skill first (model ids, vision blocks, structured output). Before assuming Next.js conventions, check `node_modules/next/dist/docs/` and `apps/web/AGENTS.md` (this Next version has breaking changes).

**Goal:** Replace the mock bloodwork extraction with a real Claude Haiku vision call (photo **and** PDF) behind the existing `extractBloodwork` seam, on a shared, testable AI-task convention, with EU-only/never-log guardrails and an in-repo eval harness.

**Architecture:** Generalize the narration vendor pattern into a shared AI-task shape. Add `@anthropic-ai/bedrock-sdk` (targeted un-ban) used **only** for the OCR vision call; narration/SES/Stripe keep the hand-rolled SigV4 path. Real image/PDF bytes travel as base64 in the existing JSON body; nothing is persisted or logged. Ships dark (credential-gated).

**Tech Stack:** Next.js (App Router, breaking-changes version), TypeScript, zod, MongoDB, vitest, Playwright; `@anthropic-ai/bedrock-sdk` (AnthropicBedrockMantle) → Claude Haiku 4.5 on Bedrock EU; SwiftUI (iOS).

**Design reference:** `docs/plans/2026-07-07-bloodwork-ocr-ai-framework-design.md`. **Compliance gate:** do not enable in production until the DPIA/Art.30/privacy-notice are updated and AWS Bedrock no-retention terms confirmed (Task 9).

**Commands:** from `apps/web`: `npm test` (vitest), `npm run e2e` (Playwright build+seed+serve). Single test: `npx vitest run src/lib/__tests__/<file>.test.ts`.

---

## Task 0: Pre-flight — read the seams, don't assume

**Step 1: Read the exact interfaces you will conform to.** Do NOT write code yet.
- `apps/web/src/lib/vendors/ai-extraction.mock.ts` — capture the exact `extractBloodwork(...)` signature, its argument(s), and the shape of each returned extracted value (`code, name, unit, value, confidence, alternatives`). Your new vendor MUST match this signature so the call site is unchanged.
- `apps/web/src/app/api/v1/uploads/bloodwork/route.ts` — how `extractBloodwork` is called (currently `extractBloodwork(fileName!)`), how `mockExtractionEnabled()` gates it, and how the response payload is built.
- `apps/web/src/lib/models.ts` — `BloodworkUploadSchema` (extracted[] shape) and `BloodworkUploadInput` (the request body schema, ~lines 967-977).
- `apps/web/src/lib/biomarker-rules.ts` + `apps/web/src/app/api/v1/biomarker-rules/route.ts` — the marker catalog (codes, names, allowed units) you validate against.
- `apps/web/src/lib/vendors/ai-narration.ts`, `ai-narration.bedrock.ts`, `apps/web/src/lib/ai-narration.ts` — the vendor/factory/guardrail pattern to mirror.
- `apps/web/src/lib/__tests__/ai-narration.bedrock.test.ts` — the test style to mirror (fail-safe, request shape, output guard).

**Step 2: Record findings** as a short comment block in your working notes (exact signatures + catalog code list). Everywhere below that shows `ExtractedValue`, `extractBloodwork(...)`, catalog codes, etc. is **representative** — reconcile it against what you just read.

No commit (read-only).

---

## Task 1: Add the dependency (the targeted un-ban)

**Files:**
- Modify: `apps/web/package.json`
- Modify: `docs/BUILD_STATE.md` (move `@anthropic-ai/bedrock-sdk` from "Wanted deps" → installed; log the decision + date 2026-07-07)

**Step 1:** From `apps/web`, install the sanctioned client:
```bash
cd apps/web && npm install @anthropic-ai/bedrock-sdk
```
Expected: package added to `dependencies`, lockfile updated, no peer-dep errors.

**Step 2:** Verify it imports and the EU client constructs (no network):
```bash
node -e "const {AnthropicBedrockMantle}=require('@anthropic-ai/bedrock-sdk'); new AnthropicBedrockMantle({awsRegion:'eu-west-1'}); console.log('ok')"
```
Expected: prints `ok`.

**Step 3:** Update `docs/BUILD_STATE.md`: record the ban-lift for this one package, why (OCR vision + structured output on Art.9 data), and that SigV4 stays for narration/SES/Stripe.

**Step 4: Commit**
```bash
git add apps/web/package.json apps/web/package-lock.json docs/BUILD_STATE.md
git commit -m "build: add @anthropic-ai/bedrock-sdk for bloodwork OCR (targeted dep un-ban)"
```

---

## Task 2: OCR output schema + catalog validation (pure, TDD)

The testable core: given a raw model-shaped extraction, validate/normalize it against the catalog and flag low-confidence values. No network.

**Files:**
- Create: `apps/web/src/lib/ai/bloodwork-extraction-schema.ts`
- Test: `apps/web/src/lib/__tests__/bloodwork-extraction-schema.test.ts`

**Step 1: Write failing tests.** (Reconcile `ExtractedValue`/catalog codes with Task 0.)
```ts
import { describe, it, expect } from "vitest";
import { validateExtraction, CONFIDENCE_THRESHOLD } from "../ai/bloodwork-extraction-schema";

// Minimal catalog stub matching biomarker-rules.ts shape
const catalog = [
  { code: "ferritin", name: "Ferritin", units: ["µg/L", "ng/mL"] },
  { code: "hdl_c", name: "HDL cholesterol", units: ["mmol/L"] },
];

describe("validateExtraction", () => {
  it("keeps known markers with allowed units and normalizes shape", () => {
    const out = validateExtraction({ values: [{ code: "ferritin", value: 45, unit: "µg/L", confidence: 0.98 }] }, catalog);
    expect(out.extracted).toHaveLength(1);
    expect(out.extracted[0]).toMatchObject({ code: "ferritin", name: "Ferritin", value: 45, unit: "µg/L" });
    expect(out.extracted[0].flagged).toBe(false);
  });

  it("flags low-confidence values", () => {
    const out = validateExtraction({ values: [{ code: "ferritin", value: 45, unit: "µg/L", confidence: 0.6, alternatives: [41] }] }, catalog);
    expect(out.extracted[0].flagged).toBe(true);
    expect(out.extracted[0].alternatives).toContain(41);
  });

  it("drops unknown markers (never invents) and reports them as needs-manual", () => {
    const out = validateExtraction({ values: [{ code: "totally_made_up", value: 1, unit: "x", confidence: 0.99 }] }, catalog);
    expect(out.extracted).toHaveLength(0);
    expect(out.droppedUnknown).toContain("totally_made_up");
  });

  it("drops known marker with a disallowed unit", () => {
    const out = validateExtraction({ values: [{ code: "hdl_c", value: 1.4, unit: "bananas", confidence: 0.99 }] }, catalog);
    expect(out.extracted).toHaveLength(0);
  });

  it("returns empty on empty/garbage input, never throws", () => {
    expect(validateExtraction({ values: [] }, catalog).extracted).toEqual([]);
    expect(validateExtraction({} as any, catalog).extracted).toEqual([]);
  });
});
```

**Step 2: Run — verify fail.** `npx vitest run src/lib/__tests__/bloodwork-extraction-schema.test.ts` → FAIL (module not found).

**Step 3: Implement.**
```ts
import { z } from "zod";

export const CONFIDENCE_THRESHOLD = 0.9; // match ai-extraction.mock.ts

const RawValue = z.object({
  code: z.string(),
  value: z.number().finite(),
  unit: z.string(),
  confidence: z.number().min(0).max(1).default(1),
  alternatives: z.array(z.number()).optional(),
});
export const RawExtraction = z.object({ values: z.array(RawValue).default([]) });

type CatalogRule = { code: string; name: string; units: string[] };

export function validateExtraction(raw: unknown, catalog: CatalogRule[]) {
  const parsed = RawExtraction.safeParse(raw);
  if (!parsed.success) return { extracted: [], droppedUnknown: [] as string[] };
  const byCode = new Map(catalog.map((r) => [r.code, r]));
  const extracted: any[] = [];
  const droppedUnknown: string[] = [];
  for (const v of parsed.data.values) {
    const rule = byCode.get(v.code);
    if (!rule) { droppedUnknown.push(v.code); continue; }
    if (!rule.units.includes(v.unit)) continue; // disallowed unit → drop, force manual
    extracted.push({
      code: rule.code, name: rule.name, unit: v.unit, value: v.value,
      confidence: v.confidence, alternatives: v.alternatives ?? [],
      flagged: v.confidence < CONFIDENCE_THRESHOLD,
    });
  }
  return { extracted, droppedUnknown };
}
```

**Step 4: Run — verify pass.**

**Step 5: Commit**
```bash
git add apps/web/src/lib/ai/bloodwork-extraction-schema.ts apps/web/src/lib/__tests__/bloodwork-extraction-schema.test.ts
git commit -m "feat: catalog-bounded validation for bloodwork OCR output"
```

---

## Task 3: Scope-locked prompt + output guardrail (pure, TDD)

**Files:**
- Create: `apps/web/src/lib/ai/bloodwork-ocr-prompt.ts`
- Test: `apps/web/src/lib/__tests__/bloodwork-ocr-prompt.test.ts`

**Step 1: Write failing tests.**
```ts
import { describe, it, expect } from "vitest";
import { OCR_SYSTEM_PROMPT, containsClinicalLanguage } from "../ai/bloodwork-ocr-prompt";

describe("OCR guardrails", () => {
  it("system prompt forbids interpretation and locks to transcription", () => {
    const p = OCR_SYSTEM_PROMPT.toLowerCase();
    expect(p).toContain("transcribe");
    expect(p).toMatch(/do not (interpret|diagnos)/);
  });
  it("rejects clinical/diagnostic language in model output", () => {
    expect(containsClinicalLanguage("You may have anaemia, consult a doctor")).toBe(true);
    expect(containsClinicalLanguage("Consider medication to treat this")).toBe(true);
    expect(containsClinicalLanguage("ferritin 45 µg/L")).toBe(false);
  });
});
```

**Step 2: Run — verify fail.**

**Step 3: Implement** (mirror the narration guardrail regex in `ai-narration.bedrock.ts`).
```ts
export const OCR_SYSTEM_PROMPT = [
  "You transcribe blood-test result values from an image or PDF of a lab report.",
  "Return ONLY the marker code, numeric value, unit, a confidence 0-1, and up to two alternative readings when a digit is ambiguous.",
  "Do NOT interpret, diagnose, name diseases, or suggest medication or treatment.",
  "If a value is unreadable or the document is not a blood-test report, return no values rather than guessing.",
].join(" ");

const CLINICAL = /\b(diagnos|disease|anaemia|anemia|deficien|medication|treat(?:ment)?|prescrib|consult a doctor|you (?:may|might) have)\b/i;
export function containsClinicalLanguage(text: string): boolean {
  return CLINICAL.test(text);
}
```

**Step 4: Run — verify pass.**

**Step 5: Commit**
```bash
git add apps/web/src/lib/ai/bloodwork-ocr-prompt.ts apps/web/src/lib/__tests__/bloodwork-ocr-prompt.test.ts
git commit -m "feat: scope-locked OCR prompt + clinical-language output guard"
```

---

## Task 4: Bedrock SDK transport (vision, DI-mockable, TDD)

Thin wrapper over `AnthropicBedrockMantle`. Accepts an **injected client** so tests never hit the network. Builds an image OR pdf content block + structured-output request; returns raw JSON text or `null` on any failure. Load the `claude-api` skill for the exact vision/PDF block + structured-output syntax.

**Files:**
- Create: `apps/web/src/lib/ai/transports/bedrock-vision.ts`
- Test: `apps/web/src/lib/__tests__/bedrock-vision.test.ts`

**Step 1: Write failing tests** (fake client asserting request shape; every failure → null).
```ts
import { describe, it, expect, vi } from "vitest";
import { runVisionExtraction } from "../ai/transports/bedrock-vision";

const img = { mime: "image/jpeg", base64: "AAAA" };

function fakeClient(reply: any) {
  return { messages: { create: vi.fn().mockResolvedValue(reply) } } as any;
}

describe("runVisionExtraction", () => {
  it("sends an image block + system prompt and returns parsed JSON text", async () => {
    const client = fakeClient({ content: [{ type: "text", text: '{"values":[{"code":"ferritin","value":45,"unit":"µg/L","confidence":0.98}]}' }] });
    const out = await runVisionExtraction({ client, modelId: "m", system: "S", media: img });
    const call = client.messages.create.mock.calls[0][0];
    expect(call.model).toBe("m");
    expect(call.system).toBe("S");
    expect(JSON.stringify(call.messages)).toContain("base64");
    expect(out).toContain("ferritin");
  });
  it("supports a PDF document block", async () => {
    const client = fakeClient({ content: [{ type: "text", text: "{}" }] });
    await runVisionExtraction({ client, modelId: "m", system: "S", media: { mime: "application/pdf", base64: "JVBER" } });
    expect(JSON.stringify(client.messages.create.mock.calls[0][0].messages)).toContain("application/pdf");
  });
  it("returns null on client error", async () => {
    const client = { messages: { create: vi.fn().mockRejectedValue(new Error("boom")) } } as any;
    expect(await runVisionExtraction({ client, modelId: "m", system: "S", media: img })).toBeNull();
  });
});
```

**Step 2: Run — verify fail.**

**Step 3: Implement.** (Reconcile the content-block + structured-output shape with the `claude-api` skill; image → `image` block, pdf → `document` block. Keep a hard timeout.)
```ts
type Media = { mime: string; base64: string };
type Args = { client: any; modelId: string; system: string; media: Media; timeoutMs?: number };

function contentBlock(media: Media) {
  if (media.mime === "application/pdf") {
    return { type: "document", source: { type: "base64", media_type: "application/pdf", data: media.base64 } };
  }
  return { type: "image", source: { type: "base64", media_type: media.mime, data: media.base64 } };
}

export async function runVisionExtraction({ client, modelId, system, media, timeoutMs = 8000 }: Args): Promise<string | null> {
  try {
    const req = client.messages.create(
      {
        model: modelId,
        max_tokens: 1024,
        system,
        messages: [{ role: "user", content: [contentBlock(media), { type: "text", text: "Extract the blood-test values as JSON: { values: [{ code, value, unit, confidence, alternatives? }] }." }] }],
      },
      { timeout: timeoutMs },
    );
    const resp = await req;
    const text = resp?.content?.find((b: any) => b.type === "text")?.text;
    return typeof text === "string" ? text : null;
  } catch {
    return null; // never throw into the request path; caller falls back to manual
  }
}
```
> Note: if `output_config.format` (structured outputs) proves more reliable than free-text JSON on Haiku, switch to it here — the parsing in Task 5 stays the same (still zod-validated). This is a design open item; decide by smoke test in Task 10.

**Step 4: Run — verify pass.**

**Step 5: Commit**
```bash
git add apps/web/src/lib/ai/transports/bedrock-vision.ts apps/web/src/lib/__tests__/bedrock-vision.test.ts
git commit -m "feat: Bedrock vision transport for bloodwork OCR (image + pdf, DI-mockable)"
```

---

## Task 5: OCR vendor behind `extractBloodwork` (golden + adversarial, TDD)

Compose Task 2–4 into a vendor matching the existing `extractBloodwork` interface. Client + catalog injected for tests. Applies the clinical-language guard, discards media, never logs.

**Files:**
- Create: `apps/web/src/lib/vendors/ai-extraction.bedrock.ts`
- Test: `apps/web/src/lib/__tests__/ai-extraction.bedrock.test.ts`

**Step 1: Write failing tests** (reconcile the exported vendor/interface name with Task 0).
```ts
import { describe, it, expect, vi } from "vitest";
import { createBedrockExtractionVendor } from "../vendors/ai-extraction.bedrock";

const catalog = [{ code: "ferritin", name: "Ferritin", units: ["µg/L"] }];
const media = { mime: "image/jpeg", base64: "AAAA" };
const vendor = (raw: any) => createBedrockExtractionVendor({
  client: { messages: { create: vi.fn().mockResolvedValue({ content: [{ type: "text", text: JSON.stringify(raw) }] }) } } as any,
  modelId: "m", catalog,
});

describe("bedrock extraction vendor", () => {
  it("extracts catalog-bounded values from a clean image", async () => {
    const out = await vendor({ values: [{ code: "ferritin", value: 45, unit: "µg/L", confidence: 0.98 }] }).extract(media);
    expect(out.extracted[0]).toMatchObject({ code: "ferritin", value: 45 });
  });
  it("returns empty for a non-blood image (model returns nothing) — never fabricates", async () => {
    const out = await vendor({ values: [] }).extract(media);
    expect(out.extracted).toEqual([]);
  });
  it("suppresses output that contains clinical language", async () => {
    // model leaks a diagnosis in a text field → whole extraction rejected → empty
    const v = createBedrockExtractionVendor({
      client: { messages: { create: vi.fn().mockResolvedValue({ content: [{ type: "text", text: "You may have anaemia. {\"values\":[]}" }] }) } } as any,
      modelId: "m", catalog,
    });
    expect((await v.extract(media)).extracted).toEqual([]);
  });
  it("returns empty when the transport fails", async () => {
    const v = createBedrockExtractionVendor({ client: { messages: { create: vi.fn().mockRejectedValue(new Error("x")) } } as any, modelId: "m", catalog });
    expect((await v.extract(media)).extracted).toEqual([]);
  });
});
```

**Step 2: Run — verify fail.**

**Step 3: Implement** (compose; guard; parse; validate).
```ts
import { runVisionExtraction } from "../ai/transports/bedrock-vision";
import { OCR_SYSTEM_PROMPT, containsClinicalLanguage } from "../ai/bloodwork-ocr-prompt";
import { validateExtraction } from "../ai/bloodwork-extraction-schema";

export function createBedrockExtractionVendor(deps: { client: any; modelId: string; catalog: any[] }) {
  return {
    async extract(media: { mime: string; base64: string }) {
      const text = await runVisionExtraction({ client: deps.client, modelId: deps.modelId, system: OCR_SYSTEM_PROMPT, media });
      if (!text || containsClinicalLanguage(text)) return { extracted: [], droppedUnknown: [] };
      let raw: unknown = null;
      try { raw = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)); } catch { return { extracted: [], droppedUnknown: [] }; }
      // media is intentionally never persisted or logged here
      return validateExtraction(raw, deps.catalog);
    },
  };
}
```
> Adapt the return shape to the existing `extractBloodwork` contract from Task 0 (it may return the extracted array directly rather than `{ extracted }`).

**Step 4: Run — verify pass.**

**Step 5: Commit**
```bash
git add apps/web/src/lib/vendors/ai-extraction.bedrock.ts apps/web/src/lib/__tests__/ai-extraction.bedrock.test.ts
git commit -m "feat: real Bedrock bloodwork OCR vendor (golden + adversarial tests)"
```

---

## Task 6: Factory + wire into the upload route; real bytes in

Select the real vendor when `ARCAEVO_AWS_*` creds are present (mirror `getNarrationVendor()`), else keep the mock/manual path. Accept base64 media in the request body with size + mime limits.

**Files:**
- Create: `apps/web/src/lib/ai-extraction.ts` (factory, mirrors `ai-narration.ts`)
- Modify: `apps/web/src/app/api/v1/uploads/bloodwork/route.ts`
- Modify: `apps/web/src/lib/models.ts` (`BloodworkUploadInput`: optional `media?: { mime, base64 }`, mime allowlist `image/jpeg|image/png|application/pdf`, base64 size cap e.g. ≤ ~8 MB decoded)
- Test: `apps/web/src/lib/__tests__/ai-extraction-factory.test.ts` + extend the route test if one exists

**Step 1: Write failing factory tests** — creds absent → returns mock/null (manual path); creds present → returns the Bedrock vendor. Reuse the narration credential-resolution helper. Also a schema test: oversized/`disallowed-mime` media is rejected by `BloodworkUploadInput`.

**Step 2–4:** Implement factory + extend `BloodworkUploadInput` + wire the route: when `kind` is `photo`/`pdf` and creds present and `media` supplied, call the real vendor with the bytes; on empty result, return the existing honest `{ manualEntryRequired: true }` payload. Keep `mockExtractionEnabled()` semantics for non-prod. Run tests green.

**Step 5: Commit**
```bash
git add apps/web/src/lib/ai-extraction.ts apps/web/src/app/api/v1/uploads/bloodwork/route.ts apps/web/src/lib/models.ts apps/web/src/lib/__tests__/ai-extraction-factory.test.ts
git commit -m "feat: select real OCR vendor on creds; accept base64 media with size/mime limits"
```

---

## Task 7: iOS — send real bytes (photo + PDF)

**Files:**
- Modify: `apps/ios/Arcaevo/Views/DataV3/AddBloodworkV3View.swift` (attach captured image / picked PDF)
- Modify: `apps/ios/ArcaevoKit/APIClient.swift` (`uploadBloodwork` sends base64 `media` + mime alongside `kind`/`fileName`)

**Steps:** Encode the selected asset to base64 with its mime; include it in the `uploads/bloodwork` body. Keep the confirm flow untouched (it already renders `extracted`/flagged). Regenerate + build:
```bash
cd apps/ios && xcodegen generate   # then build in Xcode (Debug + Release)
```
Expected: BUILD SUCCEEDED; manual smoke against a local stack shows extracted values landing on the confirm screen.

**Commit**
```bash
git add apps/ios/Arcaevo/Views/DataV3/AddBloodworkV3View.swift apps/ios/ArcaevoKit/APIClient.swift
git commit -m "feat(ios): send real photo/PDF bytes for bloodwork OCR"
```

---

## Task 8: Narration light-refactor onto the shared shape (optional-now)

Conform `narration` to the shared task convention (`ai/task.ts` if you introduce it) **without changing its SigV4 internals or behaviour**. All existing narration tests must stay green unchanged. If this risks churn, defer to a follow-up PR — it is not on the OCR critical path.

**Commit** (if done): `refactor: conform narration to shared AI-task shape (no behaviour change)`

---

## Task 9: Compliance + docs (REQUIRED before production enablement)

**Files:**
- Modify: `docs/MOCKED_APIS.md` §11 — mark OCR productionised (real EU vision vendor; never-persist/never-log; catalog-bounded; confirm-gated).
- Modify: DPIA document — add the OCR image-processing flow (new Art.9 data category to AWS Bedrock EU).
- Modify: Art.30 record of processing — new activity + data category.
- Modify: privacy notice — a line that a photo/PDF of results is processed by an AI OCR to extract values.
- Confirm + cite: AWS Bedrock DPA no-retention / no-training / provider-does-not-receive-data terms.
- Supply-chain note: confirm `@anthropic-ai/bedrock-sdk` doesn't log request bodies / no payload telemetry; version pinned; region-locked.

**Commit:** `docs: OCR productionisation + GDPR/DPIA/Art.30 delta`

> This task is a hard gate. The feature stays dark (no `ARCAEVO_AWS_*` in prod, or creds withheld) until legal/compliance sign-off.

---

## Task 10: Live smoke test + full verification (gated)

Use `superpowers:verification-before-completion`.

**Step 1:** Full suites green: `cd apps/web && npm test` and `npm run e2e` (e2e keeps the deterministic mock path — assert it still works and low-confidence "41 or 47?" still fires).
**Step 2:** One **live** smoke test via temporary STS creds (as narration was live-verified 2026-07-06): a real de-identified printout image and a real PDF → confirm extracted values + confidence flags come back through the real vendor + confirm screen. Lock the exact `modelId` string and the structured-output mechanism (free-text JSON vs `output_config.format`) here.
**Step 3:** Confirm no image bytes are persisted or logged anywhere (grep the vendor + route; check no `console.log`/DB write of `media`).
**Step 4:** Report results with evidence (test counts, smoke-test output). Do not claim done until all pass.

---

## Skills to use during execution
- `superpowers:test-driven-development` — every task.
- `claude-api` — before/while writing the Bedrock call (Task 4): model ids, vision/PDF blocks, structured output, Bedrock Mantle client.
- `superpowers:systematic-debugging` — if the live call misbehaves (model id, region, structured-output adherence).
- `superpowers:verification-before-completion` — Task 10.
- `superpowers:requesting-code-review` — before merging to `main`.
