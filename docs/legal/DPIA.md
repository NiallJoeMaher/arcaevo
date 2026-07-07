# Data Protection Impact Assessment (Article 35) — DRAFT

> **DRAFT — prepared for review by a Data Protection Officer / solicitor before reliance. Not legal advice.**
>
> A DPIA is effectively **mandatory** here: Arcaevo processes special-category health data (Art. 9), performs systematic profiling / health scoring, and does so at consumer scale — the Irish DPC's list of processing requiring a DPIA covers all three. This is a first draft grounded in the current codebase (with file citations) to accelerate a real DPO/solicitor review. It is **not** a completed, signed-off DPIA: the sign-off, consultation and residual-risk acceptance are for the appointed DPO/controller.
>
> **Controller (interim):** **Codú Limited** (the founder's existing registered Irish company) is the data controller for the early closed trial. A dedicated entity will be formed if the product monetises, at which point the controller migrates and this DPIA is re-reviewed. See `RECORDS_OF_PROCESSING.md` for the controller register.

---

## ⚠️ Before enabling AI-OCR of blood-test reports in production — the human gate

The new **AI-OCR** feature (transcribing an uploaded blood-report image/PDF to biomarker values — see §1.6 and risk **R10**) **ships dark**: it activates only when `ARCAEVO_AWS_*` credentials are present in the environment, and otherwise routes members to safe **manual entry**. That is the deliberate compliance gate. **Do NOT set those credentials in production until every item below is complete and signed off:**

1. ☐ **This DPIA reviewed and signed** by the DPO/solicitor, including the OCR flow (§1.6, R10).
2. ☐ **Art. 30 record updated** — the OCR processing activity + the AWS Bedrock recipient are registered (`RECORDS_OF_PROCESSING.md` A4 + [S]).
3. ☐ **Member-facing privacy notice updated** to disclose that a photo/PDF of results is read by an AI OCR (EU region, not retained). The public copy (`apps/web/src/content/legal.ts`) is verbatim/contractual → this needs **sign-off, not a silent edit**; suggested exact wording is in §6 "Open items". **Flagged, NOT yet applied.**
4. ☐ **AWS Bedrock DPA + SCCs executed**, and the **no-retention / no-training / model-provider-(Anthropic)-does-not-receive-the-data-on-Bedrock** terms **confirmed against the executed DPA** (not assumed) — `SUBPROCESSORS.md` AWS row.
5. ☐ **`@anthropic-ai/bedrock-sdk` supply chain confirmed** — version pinned, region-locked, and verified **not** to log request bodies or emit payload telemetry.

Until all five are ☑, the compliant production state is **credentials unset → manual entry only**.

---

## 1. Description of the processing (Art. 35(7)(a))

### 1.1 What Arcaevo is
A health-membership product for Ireland that fuses **Apple Watch / Apple Health data** with **finger-prick / uploaded blood-panel data** into **baseline-relative wellness insights** — explicitly wellness, never diagnosis (`CLAUDE.md`, `docs/STRATEGY.md`). Positioning is locked as "wellness, not a medical device"; every disclaimer is preserved.

### 1.2 Nature of the processing
| Stage | What happens | Code |
|---|---|---|
| Account & consent | Magic-link/password sign-in; explicit Art. 9 consent captured (3 purposes, versioned, append-only) | `member-auth.ts`, `consents.ts`, `models.ts` `ConsentPurpose` |
| Wearable ingestion | iOS reads a broad HealthKit set on-device; **only 4 daily aggregates** (HRV, resting HR, sleep hours, VO₂max) sync to the backend | `apps/ios/Arcaevo/Health/HealthKitProvider.swift`, `ArcaevoKit/Models.swift` (`backendSynced`), `SyncWearablesInput` |
| Blood-panel capture | User uploads/types bloodwork now (self-reported); lab kits [PLANNED]. Values become `BiomarkerReading`s with baseline bands + RCV "real change" verdicts | `BiomarkerReadingSchema`, `BloodworkUploadSchema`, `apps/web/src/lib/rcv.ts` |
| **Blood-report OCR (Fusion upload — NEW)** | When a member **photographs or uploads** a lab printout, the **image/PDF (base64)** transits to **AWS Bedrock (EU, eu-west-1) → Claude Haiku 4.5 vision** to transcribe biomarker values. The member then **confirms every value before anything is saved**. The image is **never persisted, never logged, EU-region only, and discarded immediately after extraction** (in-flight only); only the validated numeric readings persist as `self_reported` (same as manual entry). **Scope-locked** (prompt + output guard = wellness transcription only, no diagnosis). **Ships dark** — credentials are the switch (§1.6) | `apps/web/src/lib/vendors/ai-extraction.bedrock.ts`, `apps/web/src/lib/ai-extraction.ts`, `apps/web/src/app/api/v1/uploads/bloodwork/route.ts`, `apps/web/src/lib/ai/bloodwork-ocr-prompt.ts` |
| Fusion + scoring | Deterministic engines compute a readiness score, energy curve, vitality-age index; blood modulates the score via **bounded, deterministic, decaying** penalties (floor ≈ 55) | Phase 22 `ReadinessEngine`, `BiomarkerPenalty`, ALGORITHM.md §1.3 |
| Cycle-aware baselines | Opt-in menstrual-cycle data adjusts baseline bands per phase | `CycleBaselines.swift`, ALGORITHM.md §3.1/§5/§7 |
| Clinician review | Human clinician note per reviewed panel; critical values routed to a clinician-first phone flow | `composeClinicianNote` (`models.ts`) [real clinician PLANNED] |
| GP-share | Member-initiated, revocable, expiring share links with a coarse access log | `ShareLinkSchema`, `/api/v1/share` |
| Erasure | Withdrawal stops processing instantly; deletion queues a real +30-day hard-erasure across all collections | `consent-guard.ts`, `erasure.ts`, `/api/v1/account/delete`, `/api/v1/cron/run-erasure` |

### 1.3 Data categories
- **Special-category (Art. 9) health data:** wearable physiological signals (HRV, RHR, sleep, VO₂max synced; more on-device), biomarker/blood results, derived readiness/energy/vitality scores, clinician notes, and — **opt-in only** — menstrual/cycle data.
- **NEW — raw blood-report image/PDF (OCR input):** the uploaded photo/PDF is **special-category (Art. 9) health data** AND typically bears **direct identifiers printed on the report** (name, DOB, address, lab reference). It is **not stored** by us — it transits to AWS Bedrock EU for the seconds of inference and is then discarded. **Minimisation limitation (documented decision):** the identifiers printed on the sheet **cannot be reliably stripped before OCR**, so the full image transits; the mitigation is that we never persist it, never log it, keep it EU-region-only, and discard it immediately after extraction (see §1.6, R10).
- **Ordinary personal data:** name, email, DOB, delivery address, Eircode routing key (first 3 chars only), membership/billing metadata, Stripe customer id, session/device metadata, IP (rate-limiting), coarse share-access location.

### 1.4 Data subjects
Adult members (18+; `legal.ts` "Children" — not knowingly processing under-18s), prospective members (sign-ups, waitlist), gift purchasers/recipients, and recipient GPs (via share links).

### 1.5 Scope, context, purposes
- **Purposes:** deliver personalised wellness insight; fulfil membership + testing; keep the service secure; (optional) product analytics; (optional) research consent, **off by default**.
- **Scale:** consumer product, Dublin-first, preparing for a closed beta. Even a small beta of Art. 9 data is DPIA-triggering under DPC guidance.
- **Recipients / processors:** see `SUBPROCESSORS.md`.

### 1.6 New processing activity — AI-OCR of blood-test reports (Fusion upload)

**What it is.** A new, automated processing activity: **optical transcription of an uploaded blood-report image/PDF to extract biomarker values**. When a member photographs a printout or uploads a PDF, the **image/PDF (base64)** is sent to **AWS Bedrock (EU, eu-west-1)** where **Claude Haiku 4.5 (vision)** transcribes the printed biomarker values. It is **wellness, never diagnosis** — the model is given a **scope-locked prompt** (transcription only) and its output passes a **clinical-language guard** before any value is surfaced; the member then **confirms every value before anything is saved**.

**Same processor family as narration.** AI narration (§A6, `SUBPROCESSORS.md`) already calls Claude Haiku on **AWS Bedrock (EU)**; this OCR activity **reuses the same Bedrock EU sub-processor** and the same `ARCAEVO_AWS_*` credentials — the sub-processor register **extends** the existing AWS Bedrock entry with the new OCR image data category rather than adding a duplicate. AWS is US-parented → **AWS DPA + SCCs required**.

**New data category, minimisation limitation (documented decision).** Unlike narration (whose input is PII-free by type), the OCR input is the **whole report image**: special-category health data that **also carries the direct identifiers printed on the sheet** (name, DOB, address, lab reference). Those identifiers **cannot be reliably stripped before OCR**, so the full image transits. Mitigations coded in: the image is **never persisted** (there is **no raw-image field** on the `BloodworkUpload` doc — `route.ts`), **never logged** (no payload logging anywhere on this path — `ai-extraction.bedrock.ts`, `ai-extraction.ts`, `route.ts` all carry explicit "never logged/persisted" invariants), **EU-region only**, and **discarded immediately after extraction** (in-flight only). Only the **validated numeric readings** persist, as `self_reported`.

**AWS Bedrock posture — to confirm and cite (not assume).** Bedrock runs the model **in-region**; per the AWS Bedrock DPA, **inputs/outputs are not retained by Bedrock and not used to train the underlying models**, and **the model provider (Anthropic) does not receive the data on Bedrock**. This is a strong posture, but it must be **sourced from the executed AWS DPA, not assumed** — recorded as an action in §5/§6 and the OCR checklist.

**Retention.** The **raw image has zero retention** (never stored); the derived numeric readings follow the **existing biomarker-reading retention** (`DATA_RETENTION.md` row 6). 

**Supply chain.** A new dependency, **`@anthropic-ai/bedrock-sdk`** (the sanctioned Bedrock client), was added **for the OCR call only** — version pinned, region-locked; narration/SES/Stripe keep the hand-rolled `node:crypto` SigV4 path. **Confirm it does not log request bodies / has no payload telemetry** (OCR checklist item 5).

**Ships dark (compliance gate).** OCR is selected **only when `ARCAEVO_AWS_*` credentials are present** (`ai-extraction.ts` — credentials are the switch); otherwise, and on any failure, the member is routed to **manual entry** and nothing is fabricated. **Do NOT enable in production until the OCR checklist at the top of this DPIA is complete.**

**Automated-processing consideration.** At scale, **large-scale automated processing of special-category data** may be a factor for DPIA necessity / DPO reconsideration — flagged as a factor to revisit in `DPO_NOT_REQUIRED_MEMO.md` (§7 review triggers); not overstated at trial scale.

---

## 2. Necessity & proportionality (Art. 35(7)(b))

| Test | Assessment |
|---|---|
| Is each purpose necessary? | Health insight requires the health inputs; billing requires identity + payment; security requires session/IP data. Analytics and research are **separable and optional** (off by default) — good proportionality |
| Data minimisation | Strong and coded-in: **only 4 wearable metrics sync** (daily aggregates, not raw streams); **cycle data never leaves the device unless enabled**; **no health values in email/push**; **Eircode reduced to a 3-char routing key**; health values excluded from iOS `UserDefaults` (Keychain holds only the token). `AppModel.swift`, `AppState.swift`, `CycleBaselines.swift`, `models.ts` |
| Purpose limitation | Consent is per-purpose and un-bundled (`ConsentGrantInput`); research is a distinct, default-off purpose; analytics carries **no health data** |
| Lawful basis | See §3 |
| Accuracy | Self-reported bloods are permanently marked `self_reported` (never presented as clinician-reviewed); RCV verdicts guard against over-reading noise; **mock extraction is OFF in production** so real users never confirm fabricated numbers (`env.ts` `ALLOW_MOCK_EXTRACTION`) |
| Storage limitation | Active-account retention + a real +30-day erasure (`erasure.ts`); see `DATA_RETENTION.md` |
| Transparency | Layered privacy/consent copy exists (`legal.ts`); named controller reconciled to the interim controller **Codú Limited**, and the data-protection contact set to the durable role-based address **`privacy@arcaevo.com`** across the public copy, `/consent`, `/account/privacy` and every legal doc (receiving-mailbox setup in [`../EMAIL_ADDRESSES.md`](../EMAIL_ADDRESSES.md)). No DPO is named — see [`DPO_NOT_REQUIRED_MEMO.md`](./DPO_NOT_REQUIRED_MEMO.md). **OPEN: solicitor review of the wording.** |
| Data-subject rights | Access/export/erase/withdraw are self-service in the app + a one-month email fallback (`legal.ts`); withdrawal is genuinely as easy as granting |

**Conclusion:** the processing is necessary and — for the core wellness purpose — proportionate, with unusually strong minimisation for this stage. Proportionality gaps are operational/legal (DPAs, DPIA sign-off, admin access), not architectural.

---

## 3. Lawful basis (Art. 6) + special-category condition (Art. 9)

- **Art. 9(2)(a) — explicit consent** is the condition for all health/wearable/blood/cycle processing. Enforced server-side: `requireConsentedMember` blocks every Art. 9 endpoint without a current `health_processing` grant (403 `consent_required`); ordering a test also requires `clinician_review` (`consent-guard.ts`). Consent is **versioned** (`CONSENT_VERSION`), **append-only** with surface + timestamp (`consents.ts`), and **revocable** (withdrawal → immediate session revocation + suspension).
- **Art. 6(1)(b) contract** — account, membership, testing fulfilment.
- **Art. 6(1)(c) legal obligation** — tax/VAT billing records; demonstrating GDPR compliance (retained consent trail).
- **Art. 6(1)(f) legitimate interests** — service security, abuse rate-limiting.
- **Consent (ePrivacy)** — analytics cookies, off until accepted.

**Caveat for the DPO:** explicit consent is fragile as a *sole* Art. 9 basis — it is withdrawable at any moment and withdrawal of `health_processing` triggers **account closure**, not merely a pause. The privacy/consent copy must make that consequence unmistakable. Consider whether any processing better sits on another Art. 9 condition (it likely does not for a consumer wellness product — consent is the correct choice).

---

## 4. Risk assessment (Art. 35(7)(c))

Scoring: Likelihood × Severity, each Low/Med/High, after existing mitigations (residual risk).

### R1 — Re-identification / linkage of health data
- **Risk:** biomarker + wearable + cycle data is highly identifying and sensitive; a linkage or leak is high-severity.
- **Mitigations in place:** EU-only storage; minimised sync; no health values in email/push; opaque hashed sessions; security headers; health values off `UserDefaults`.
- **Residual:** **Medium** — the single-shared-password admin (R4) and unsigned DPAs keep this above Low.

### R2 — Sensitive-data exposure via notifications / share / logs
- **Risk:** leaking result values through email, push, logs, or share links.
- **Mitigations:** results **never** in email/push (`account/delete/route.ts`, invariant); critical values → clinician-first phone flow, never a red number; share links revocable + 30-day expiry + access-logged; SMTP credentials never logged; cron response carries no health values.
- **Residual:** **Low** — this is a genuine design strength.

### R3 — Profiling / automated-decision concerns (the readiness score)
- **Assessment:** the readiness/energy/vitality scoring **is profiling** (Art. 4(4)) but is **NOT** a decision producing legal or similarly significant effects (Art. 22). It is a wellness score with a **suggestive** training ceiling ("Go easy / Train as planned"), never prescriptive dosing, never a diagnosis.
- **Guardrails coded in:** blood only shifts the score's baseline/band via **bounded, deterministic, decaying** penalties with a floor (~55, never alarmist); **flagged/critical values never enter the engine** — they route to the human clinician-first flow; **amber at worst, no red numbers**; deterministic rules decide, AI only narrates (ALGORITHM.md §1.3/§5). A **blood-layer ON/OFF toggle** is both a user feature and the documented MDR fallback flag.
- **Human-in-the-loop:** a registered clinician reviews panels and phones before any alarming value surfaces (PLANNED real clinician).
- **Residual:** **Low–Medium** — low as an Art. 22 concern; the residual is the MDR *intended-purpose* line (keep the ceiling suggestive, never prescriptive; review generated narration copy before it ships — `LAUNCH_READINESS.md` §2).

### R4 — Broad internal access (admin) to Art. 9 data
- **Risk:** admin is a **single shared password** unlocking **every** member's Art. 9 data, with no per-user accounts, roles, or audit log (`MOCKED_APIS.md` §3, `apps/web/src/lib/auth.ts`).
- **Mitigations:** admin cookie is fail-closed HMAC (won't boot without `SESSION_SECRET`/`ADMIN_PASSWORD`); `/admin` disallowed in robots.
- **Residual:** **High** — this is the single largest data-protection gap. See `ADMIN_AUTH_OPTIONS.md`. **Must be addressed before strangers' data exists.**

### R5 — Erasure / retention failure
- **Risk:** the "erased within 30 days" promise fails silently.
- **Mitigations:** real erasure queue + runner across all collections (retaining only the consent audit trail per DPC guidance); **Vercel Cron wired** (`vercel.json` `0 3 * * *`, `CRON_SECRET` fail-closed).
- **Residual:** **Low–Medium** — low once `CRON_SECRET` is set and the cron is monitored; **the runner does not yet reach lab-partner copies or stored original upload files** (`MOCKED_APIS.md` §17) — a real residual for the paid tiers.

### R6 — Account-takeover (magic link is the only way in)
- **Mitigations:** single-use 30-min links, hash-only storage, prefetch-safe code fallback with a 5-attempt burn, resend throttle, 5-fail cool-off, **IP rate-limiting** (`rate-limit.ts`), non-revealing responses.
- **Residual:** **Low–Medium** — dev-grade fixed-window limiter; no passkeys/2FA yet; real EU ESP still to be wired.

### R7 — International transfer / processor egress
- **Mitigations:** EU-only hosting design (Atlas eu-west-1, Vercel dub1/fra1, PostHog EU).
- **Residual:** **Medium** until region pinning is verified and SCCs are in signed DPAs (US-parented processors). See `SUBPROCESSORS.md`.

### R8 — Cycle/menstrual data (highest sensitivity)
- **Mitigations:** separate later HealthKit ask (never first sheet), OFF by default, gated behind the Data & Privacy toggle, **never synced unless cycle-aware baselines are enabled**, computed on-device (`CycleBaselines.swift`, ALGORITHM.md §3.1/§5/§7).
- **Residual:** **Low** *by design* — **verify end-to-end in the built app before shipping cycle features.**

### R9 — Presenting a fictional clinician / auto-"review" to real users
- **Risk:** the mock persona "Dr. S. Nolan, IMC 412887" and auto-marked `clinician_reviewed` values would be a serious clinical-governance (and potential fraud) issue if shown to real users.
- **Residual:** **High for paid tiers** — hard gate: real IMC clinician + medical-ops partner before any real blood result reaches any real user (`LAUNCH_READINESS.md` §3). Does not block the basic tier (self-reported bloods are never presented as clinician-reviewed).

### R10 — AI-OCR of blood-report images (new transfer of identifiable Art. 9 data to AWS Bedrock EU)
- **Risk:** the OCR input is the **whole report image** — special-category health data that **also carries the direct identifiers printed on it** (name, DOB, address, lab reference). The identifiers **cannot be reliably stripped before OCR**, so the full image transits to **AWS Bedrock EU (US-parented processor)** for inference. Exposure vectors: retention/training by the processor, payload logging, egress outside the EU, or a diagnostic/clinical "reading" being surfaced instead of a plain transcription.
- **Mitigations in place (verified in code):** image is **never persisted** (no raw-image field on `BloodworkUpload` — `route.ts`) and **never logged** (explicit no-log invariants across `ai-extraction.bedrock.ts`, `ai-extraction.ts`, `route.ts`); **EU-region only** (eu-west-1, `ARCAEVO_AWS_REGION`); **discarded immediately after extraction** (in-flight only); **confirm-before-save** (the member validates every value; nothing enters the timeline from the model alone); **scope-locked, no diagnosis** (transcription-only prompt + clinical-language output guard — a leaked diagnosis rejects the whole extraction and routes to manual entry); only validated **numeric readings** persist (`self_reported`). **Ships dark** — off unless `ARCAEVO_AWS_*` creds are set; fail-safe to manual entry on any error.
- **To confirm (not assumed):** the **AWS Bedrock DPA no-retention / no-training / model-provider-does-not-receive-the-data** terms cited in §1.6, and that **`@anthropic-ai/bedrock-sdk` does not log request bodies / has no payload telemetry** (version pinned, region-locked).
- **Residual:** **Medium** — the design mitigations are genuinely strong (no-persist/no-log/EU-only/discard/confirm-gate/scope-lock), but it remains a transfer of **identifiable** Art. 9 data to a US-parented processor whose no-retention posture is **unconfirmed until the AWS DPA is executed and cited**. Drops to **Low–Medium** once the DPA/SCCs are signed, the no-retention/no-training terms are confirmed, the SDK payload-logging check is done, and the member-facing privacy notice discloses the AI-OCR (the OCR checklist). **Must not be enabled in production before those.**

---

## 5. Measures to address the risks / mitigations already in place (Art. 35(7)(d))

**Already implemented (verified in code):**
- Server-side Art. 9 consent enforcement + instant withdrawal (`consent-guard.ts`).
- Real, scheduled erasure with a 30-day grace and retained consent trail (`erasure.ts`, `vercel.json`).
- EU-only hosting design; strong data minimisation (4 synced metrics; cycle on-device; routing-key-only Eircode; no health values in email/push; health off `UserDefaults`).
- Fail-closed production secrets; opaque hashed sessions; scrypt passwords; security headers; IP rate-limiting.
- Results never in email/push; critical values → clinician-first; amber-at-worst scoring; blood-layer bounded/decaying with a floor.
- Self-reported bloods permanently distinguished; mock extraction OFF in production.
- **AI-OCR ships dark** (credentials are the switch), never persists/logs the image, EU-region only, discards after extraction, confirm-before-save, scope-locked (no diagnosis) (R10).

**Required before real users (open items / mitigations to add):**
1. **Appoint a DPO or document the decision** + name a privacy contact (Art. 37).
2. **Sign DPAs** with Atlas, Vercel, the EU ESP, PostHog (SCCs where US-parented) — `SUBPROCESSORS.md`.
3. **Replace shared-password admin** with per-user accounts + roles + audit log (R4) — `ADMIN_AUTH_OPTIONS.md`.
4. **Set `CRON_SECRET`**, monitor the erasure cron, and keep proof it ran (R5).
5. **Wire a real EU ESP**; keep rate-limiting on (R6).
6. **Solicitor-review** the privacy policy, consent copy, terms, sub-processor page; confirm the interim controller entity **Codú Limited** (record its CRO number) and the migration plan to a dedicated entity on monetisation.
7. **Verify EU region pinning** (Atlas cluster + backups, Vercel functions, PostHog account) (R7).
8. **Verify cycle-data flow end-to-end** before shipping cycle features (R8).
9. **Write a short MDR intended-purpose self-assessment** (wellness, not a device) + confirm the blood-layer ON/OFF behaves as a true config flag (R3).
10. **Breach runbook** in place (`BREACH_RESPONSE.md`).
11. **Paid tiers only:** real IMC clinician + clinical governance (R9); extend erasure to lab copies + original files (R5); DPAs with LGC/Stripe/phlebotomy/OCR.
12. **Before enabling AI-OCR (R10) in production:** complete the OCR checklist at the top of this DPIA — sign this DPIA; update the Art. 30 record; **update the member-facing privacy notice** to disclose AI-OCR image processing (see §6 open items for the suggested wording); execute the **AWS Bedrock DPA + SCCs** and confirm the **no-retention/no-training** terms; confirm **`@anthropic-ai/bedrock-sdk`** has no payload logging. Until then, leave `ARCAEVO_AWS_*` unset in production (OCR dark → manual entry).

---

## 6. Residual risk & sign-off

| Risk | Residual (after mitigations) | Owner |
|---|---|---|
| R1 Re-identification | Medium | DPO |
| R2 Notification/share/log exposure | Low | — |
| R3 Profiling / MDR line | Low–Medium | Founder + clinical |
| R4 Admin access | **High** | Founder (must fix) |
| R5 Erasure/retention | Low–Medium | Founder |
| R6 Account takeover | Low–Medium | Founder |
| R7 Transfers | Medium | DPO |
| R8 Cycle data | Low (verify) | Eng |
| R9 Mock clinician (paid) | High (paid gate) | Founder + clinical |
| R10 AI-OCR of report images | Medium (→ Low–Medium once AWS DPA/SCCs confirmed + privacy notice updated) | Founder + DPO |

**Prior consultation (Art. 36):** if, after mitigation, any residual remains **high**, consult the DPC before that processing begins. On this draft, **R4 (admin access)** and **R9 (mock clinician, paid tiers)** are the items most likely to require resolution before launch rather than DPC consultation — close them and re-score.

**Open items for the DPO/solicitor:**
- Confirm interim controller **Codú Limited** (CRO number) + the plan to migrate to a dedicated entity on monetisation + DPO decision.
- Approve lawful-basis analysis and the consent-withdrawal→closure consequence copy.
- Confirm the MDR wellness position and the profiling/Art. 22 conclusion.
- Accept or challenge each residual-risk rating; decide on any Art. 36 consultation.
- Sign and date this DPIA; schedule review on any material processing change (e.g. real generated narration, lab go-live, cycle features, **enabling AI-OCR**).
- **AI-OCR (R10):** confirm the **AWS Bedrock DPA + SCCs** and the **no-retention / no-training / provider-does-not-receive-data** terms (cite the executed DPA); confirm the **`@anthropic-ai/bedrock-sdk`** supply chain has no payload logging; and **approve an update to the member-facing privacy notice**. The public copy (`apps/web/src/content/legal.ts`) is verbatim/contractual, so it has **NOT been edited** in this change — it is **flagged for sign-off**. **Suggested exact wording** (to add to the health-data / sub-processors copy):
  > "When you upload or photograph a blood-test report, the image or PDF is sent to an EU-based AI service that reads the biomarker values from it. You confirm every value before it is saved. The image is processed only in the EU, is never used to train any model, and is not stored — we keep only the numbers you confirm."

_This DPIA must be reviewed and signed by the appointed DPO/controller before it can be relied upon._
