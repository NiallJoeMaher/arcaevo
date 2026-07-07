# Bloodwork OCR + shared AI-task framework — design

- **Date:** 2026-07-07
- **Status:** Approved design (pre-implementation)
- **Owner:** Niall
- **Scope decision:** Build a reusable in-repo AI-task convention and ship blood-scan OCR as its first consumer; lightly refactor AI narration onto the same shape.

---

## 1. Problem & reframe

Members should be able to **scan a blood-test printout (photo) or upload a PDF**, have the values extracted automatically, and **confirm every value before anything is saved**. Today this is manual and tedious.

Key finding from the codebase scout: **the scan→confirm flow already exists end-to-end — it is just wired to a mock.**

- iOS (`apps/ios/Arcaevo/Views/DataV3/`): `AddBloodworkV3View` already offers *Photograph a printout / Upload a PDF / Type by hand*; `ConfirmReadingV3View` already renders the "CHECK THE READING · N MARKERS FOUND" screen with the low-confidence *"was this 41 or 47?"* card.
- Web API: `POST /api/v1/uploads/bloodwork` → `pending_confirmation` → `POST /api/v1/uploads/bloodwork/confirm` → writes `BiomarkerReading` docs with `source: "self_reported"`. `BloodworkUpload.extracted[]` already carries `{ code, name, unit, value, confidence, alternatives }`.
- Only two things are fake: **no image/PDF bytes travel** (the API takes JSON), and `apps/web/src/lib/vendors/ai-extraction.mock.ts` fabricates values from a hash of the *filename*.

So the real work is small and well-bounded: **make real bytes flow, and replace the mock at its existing `extractBloodwork` seam with a real Claude Haiku vision call** — plus generalize the AI plumbing and lock down compliance.

The **confirm-before-save safety net is already the architecture**: nothing enters the timeline until the member resolves every flagged value. OCR only *pre-fills*.

## 2. Goals / non-goals

**Goals**
- Real Haiku-vision extraction for photo **and** PDF, behind the existing vendor seam.
- A shared, testable AI-task convention that narration and OCR both follow ("manage prompts safely at scale").
- No regression to the strong GDPR posture; a documented DPIA/Art.30 delta for the new data flow.
- Ships dark (credential-gated), no behaviour change until switched on.

**Non-goals**
- No Vercel AI SDK, no Vercel Eve (Eve is an autonomous multi-channel agent runtime — wrong shape; would route health-data images through Vercel infra, fighting our EU-only/never-log posture).
- No move off the vendor-seam architecture; no rewrite of working narration internals.
- No new member-facing web form (member entry lives in iOS).
- No autonomous agent, no diagnosis/interpretation — OCR transcribes numbers only.

## 3. Architecture decisions (settled)

1. **Framework = the existing vendor-seam + factory + guardrail + golden-test convention, generalized** — not a new runtime or external tool. Each AI feature is a *task*: `{ id, modelId, systemPrompt (scope-locked), buildInput (minimized), outputSchema (zod, catalog-validated), guardrail, transport }`.
2. **Targeted SDK un-ban:** add `@anthropic-ai/bedrock-sdk` (the already-sanctioned "Wanted dep") **for the OCR vision call only**. Narration/SES/Stripe keep the hand-rolled `fetch` + `node:crypto` SigV4 path (`src/lib/aws-sigv4.ts`) — they work and keep the bundle lean. This lifts the `docs/BUILD_STATE.md` line-22 `npm install` ban for exactly one package.
3. **PDF goes straight to the model** as a base64 PDF document block (Bedrock supports PDF input) — no pre-conversion to image.
4. **Region stays EU** (`eu-west-1`), same `ARCAEVO_AWS_*` credentials as narration; credential presence is the on/off switch.
5. **Evals are in-repo** (vitest golden fixtures), extending the narration test style — this is the "never stray" harness.

## 4. The shared AI layer

New home `apps/web/src/lib/ai/`; move the existing narration vendor files under it.

- `ai/task.ts` — the task shape + a `runAiTask` helper wrapping: build minimized input → call transport → validate output vs schema → run guardrail → fail-safe to `null`.
- `ai/transports/bedrock-sigv4.ts` — the existing hand-rolled path (narration).
- `ai/transports/bedrock-sdk.ts` — thin wrapper over `AnthropicBedrockMantle` (OCR).
- `ai/tasks/narration.ts` — narration refactored to the task shape; **internals unchanged** (still SigV4).
- `ai/tasks/bloodwork-ocr.ts` — new.

Selection mirrors `getNarrationVendor()`: factory returns the live task when creds present, otherwise the safe fallback.

## 5. OCR extraction task

`apps/web/src/lib/vendors/ai-extraction.bedrock.ts` (or `ai/tasks/bloodwork-ocr.ts`) implements the existing `extractBloodwork` interface so `POST /api/v1/uploads/bloodwork` swaps vendor with **no call-site change**.

- **Model:** Claude Haiku 4.5, EU inference profile (`eu.anthropic.claude-haiku-4-5-20251001-v1:0` family). *Implementation note: confirm the exact model-id string the Mantle/Messages endpoint expects vs. the InvokeModel profile id narration uses.*
- **Input:** base64 image (`image/jpeg|png`) or `application/pdf` document block + a scope-locked instruction.
- **Output:** structured output (tool-use or `output_config.format`) forcing `extracted[]` with per-value `confidence` and `alternatives`; parsed and validated with **zod against the `BiomarkerRule` catalog** (`biomarker-rules.ts`). Unknown markers/units → dropped and surfaced as needs-manual, never written (the confirm route already rejects unknown codes).
- **Confidence → flag:** low-confidence values are flagged so the existing confirm screen forces resolution; the confirm route already enforces that every flagged value is resolved.
- **Fail-safe:** single attempt + short timeout, returns empty extraction on any failure → member falls back to the honest manual path. Never throws into the request.

## 6. Byte transport (photo + PDF)

- **Web:** `BloodworkUploadInput` gains an optional base64 payload + declared mime; **size cap and mime allowlist** enforced server-side. JSON body (no multipart parser, no new dep) — matches the Bedrock content-block shape.
- **iOS:** `AddBloodworkV3View` / `APIClient.uploadBloodwork` actually send the captured photo / picked PDF bytes (base64) instead of just a filename. Confirm flow unchanged.
- **Gate:** `mockExtractionEnabled()` unchanged; real vendor activates on creds, else `{ manualEntryRequired: true }`.

## 7. Data-model touchpoints

No schema changes required — `BloodworkUploadSchema.extracted[]` already has `{ code, name, unit, value, confidence, alternatives }`, and `BiomarkerReadingSchema` already carries `source: "self_reported"` and `clinicianReviewed: false`. RCV/baseline math (`rcv.ts`) and the confirm route are untouched.

## 8. Safety guardrails (non-negotiable)

- **Never persist the raw image/PDF; never log it or the payload.** Extract → discard bytes. Only the minimized numbers land in `BloodworkUpload`. (Mirrors narration's never-log rule.)
- **EU region only.**
- **Scope-locked system prompt:** transcribe values only — no interpretation, diagnosis, disease, medication, or treatment language. Output guardrail (regex) rejects anything that slips → empty extraction, member routed to manual.
- **No fabrication:** a non-blood-test / unreadable image returns *empty + flagged*, never invented numbers.
- **Catalog-bounded:** only known markers/units are written; everything else is flagged for manual.
- **Human gate:** nothing enters the timeline without the member resolving every flagged value.

## 9. GDPR / DPIA delta (compliance — must land before ship)

The framework itself is our own code and introduces **no** new data flow. The **OCR feature does** introduce a new processing activity, and this section records it.

- **New data category to an existing processor.** Narration sends PII-free numbers by design. OCR sends a **raw photo/PDF of a lab printout**, which routinely bears the member's **name, DOB, address, and lab reference**. This is special-category (Art. 9) health data **plus direct identifiers** transiting to **AWS Bedrock (EU)**. AWS is already an onboarded processor (narration, SES); the **data category is new**.
- **Minimization limitation (documented decision):** identifiers printed on the sheet cannot be reliably stripped *before* OCR, so the full image transits for the seconds of inference. Mitigation: never persisted by us, never logged, EU-only, discarded immediately after extraction.
- **AWS Bedrock terms — to confirm and cite in the DPIA:** Bedrock runs the model in-region; per its DPA, inputs/outputs are **not retained** and **not used for training**, and the model provider (Anthropic) **does not receive** the data on Bedrock. Verify against our executed AWS DPA and cite it (this is a genuinely strong posture, but must be sourced, not assumed).
- **Records to update before enabling the feature in production:**
  - DPIA — add the OCR image-processing flow.
  - Art. 30 record of processing — new activity + data category.
  - Privacy notice — a line that a photo/PDF of results is processed by an AI OCR to extract values.
- **Supply-chain check on the new dep:** confirm `@anthropic-ai/bedrock-sdk` does not log request bodies by default and has no payload telemetry; pin the version; keep it region-locked. It calls the same Bedrock EU endpoint — no new processor or data path.

## 10. Evals — the "never stray" harness

In-repo vitest, extending `ai-narration*.test.ts` style:

- **Golden set:** de-identified/synthetic printout fixtures (image + PDF) with expected extractions → assert accuracy on clean inputs.
- **Confidence:** low-confidence values are flagged, not silently accepted.
- **Catalog-only:** output never contains markers/units outside the catalog.
- **Adversarial:** a non-blood image → empty/flagged, never fabricated numbers.
- **Guardrail:** never emits prose/diagnosis.
- **Plumbing:** request-shape test; every failure path → empty/`null`; mirrors `ai-narration.bedrock.test.ts`.

These run in CI and are what let prompts multiply safely.

## 11. Rollout & verification

- **Ships dark:** OCR vendor activates only when `ARCAEVO_AWS_*` creds are present; otherwise the honest manual path. iOS decoders ignore unknown keys, so nothing breaks mid-migration.
- **Verification:** vitest unit + guardrail suite; Playwright e2e for the upload→confirm flow (keep the mock path for e2e determinism); one **live smoke test** via temporary STS creds (as narration was live-verified 2026-07-06) before enabling.
- **Compliance gate:** do **not** enable in production until §9 records are updated and AWS terms confirmed.

## 12. File-touch list (design-level)

- `apps/web/package.json` — add `@anthropic-ai/bedrock-sdk` (record the ban-lift in `docs/BUILD_STATE.md`).
- `apps/web/src/lib/ai/` — new task convention + transports + tasks (narration moved/ conformed, OCR new).
- `apps/web/src/lib/vendors/ai-extraction.bedrock.ts` — real OCR vendor behind `extractBloodwork`.
- `apps/web/src/app/api/v1/uploads/bloodwork/route.ts` — accept base64 bytes; select real vs mock vendor.
- `apps/web/src/lib/models.ts` — extend `BloodworkUploadInput` with optional base64 payload + mime (size/mime validation).
- `apps/ios/Arcaevo/Views/DataV3/AddBloodworkV3View.swift` + `apps/ios/ArcaevoKit/APIClient.swift` — send real bytes.
- `apps/web/src/lib/__tests__/` — OCR golden + guardrail tests.
- `docs/MOCKED_APIS.md` §11 — mark OCR productionised; `docs/BUILD_STATE.md` — dep + decision log; DPIA/Art.30/privacy-notice updates (§9).

## 13. Open items to confirm during build

- Exact Bedrock model-id string for the Mantle/Messages endpoint (vs. the InvokeModel profile id).
- Structured-output mechanism on Bedrock Haiku (tool-use vs `output_config.format`) — pick the one with the most reliable schema adherence.
- Max upload size + accepted mime types.
- Whether narration migrates to the shared shape now or in a follow-up (leaning: now, light-touch, SigV4 internals unchanged).
