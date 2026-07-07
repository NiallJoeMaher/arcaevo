# Bloodwork OCR — live smoke test & activation runbook

> The OCR feature ships **dark**: it activates only when `ARCAEVO_AWS_*` credentials are present. This runbook is the pre-activation verification. **Do not enable in production until both this smoke test passes AND the compliance gate at the top of `docs/legal/DPIA.md` is signed off.**

Related: design `docs/plans/2026-07-07-bloodwork-ocr-ai-framework-design.md`, implementation plan `docs/plans/2026-07-07-bloodwork-ocr-implementation-plan.md`, compliance `docs/legal/DPIA.md`.

## What already passed (no creds needed)
- Web unit suite: full vitest green (641+ tests), `tsc` clean, eslint clean.
- iOS: `ArcaevoKitTests` green, Debug + Release build succeeded.
- Holistic security review: safe-to-merge-dark; the raw image is never persisted/logged on any path (incl. errors), and no model free-text can reach a saved reading.
- Note: the Playwright e2e suite has pre-existing failures in **unrelated** areas (admin/waitlist, orders, careers, checkout, pricing) — zero overlap with any file this feature changed. Not caused by OCR.

## Prerequisites
- Temporary **STS** credentials scoped to Bedrock in an **EU/EEA** region (same path narration was live-verified 2026-07-06):
  - `ARCAEVO_AWS_ACCESS_KEY_ID`, `ARCAEVO_AWS_SECRET_ACCESS_KEY`, `ARCAEVO_AWS_SESSION_TOKEN`
  - `ARCAEVO_AWS_REGION=eu-west-1` (or another EU/EEA region — the allowlist fails closed on non-EU/EEA, incl. UK `eu-west-2` and CH `eu-central-2`)
  - Optional `BEDROCK_MODEL_ID` override (defaults to the EU Haiku profile `eu.anthropic.claude-haiku-4-5-20251001-v1:0`)
- A **de-identified / synthetic** blood-test printout: one JPEG/PNG **and** one PDF. Do not use a real member's report for the smoke test.

## Steps
1. **Bring up the app with creds** (local prod-ish or a preview deploy) with the env above set. Confirm `getExtractionVendor()` returns a real vendor (creds present + EU region).
2. **Photo path.** `POST /api/v1/uploads/bloodwork` with `{ kind: "photo", fileName, media: { mime: "image/jpeg", base64 } }` (base64 must decode to ≤ 3 MiB). Expect a `pending_confirmation` response with `extracted[]` values (code/name/unit/value), low-confidence ones flagged, and an additive `unreadableCount`.
3. **PDF path.** Same with `{ kind: "pdf", media: { mime: "application/pdf", base64 } }`. Expect the same shape.
4. **Confirm flow.** `POST /api/v1/uploads/bloodwork/confirm` resolving any flagged values + a `takenAt` (the iOS confirm screen now collects an editable draw-date). Expect `self_reported` readings written.
5. **Lock the remaining open decision** (flagged in code comments):
   - **Structured output:** confirm free-text JSON is reliably parsed. If adherence is poor on real reports, switch `runVisionExtraction` to `output_config.format` (structured outputs) — the vendor's zod validation is unchanged either way (`docs/plans/...-implementation-plan.md` Task 4 note).
   - *(Model-id resolution is no longer open: OCR now uses the classic `AnthropicBedrock` **InvokeModel** path with `eu.anthropic.claude-haiku-4-5-20251001-v1:0`, the exact id + path narration live-verified 2026-07-06.)*
6. **maxDuration:** confirm the deployed function's `maxDuration` comfortably exceeds the transport's 8s timeout + the DB writes (bump `maxDuration` in the route/segment config or upgrade the Vercel tier if on a 10s budget).
7. **Fail-closed checks:**
   - Set `ARCAEVO_AWS_REGION=us-east-1` → OCR must be **disabled** (member routed to manual entry); a server warning names only the region.
   - Send an oversize/malformed image → **manual-entry** 200 (not a 400/500); nothing persisted.
   - Grep logs during the run: **no** base64/image bytes and **no** member PII logged anywhere.

## Activation checklist (all must be true)
- [ ] This smoke test passes (photo + PDF extract; confirm writes readings).
- [ ] Structured-output mechanism chosen (free-text JSON vs. `output_config.format`). *(Model-id resolution already proven via the classic InvokeModel path narration uses.)*
- [ ] `maxDuration` covers the timeout.
- [ ] Fail-closed region + bad-media behaviours verified; no PII/bytes logged.
- [ ] Compliance gate signed off — `docs/legal/DPIA.md` top checklist: DPIA review, Art.30, **privacy-notice updated** (suggested sentence in the DPIA), AWS Bedrock DPA + SCCs + no-retention/no-training confirmed, `@anthropic-ai/bedrock-sdk` no-payload-logging confirmed.

Only after all boxes: set `ARCAEVO_AWS_*` in production and OCR goes live. To roll back, unset the creds — the feature returns to dark (manual entry) with no code change.
