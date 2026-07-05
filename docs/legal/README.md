# Arcaevo — Legal & Compliance Documentation

> **DRAFT — every document here is prepared for review by a Data Protection Officer / solicitor before reliance. Not legal advice.**
>
> These are **first drafts** grounded in what the codebase actually does (with file citations), written to reduce the founder's legal burden and accelerate a real professional review — **not** final legal instruments. Arcaevo processes special-category health data (GDPR Art. 9), so a DPO/solicitor sign-off is required before relying on any of this.

## The set

| Document | What it is | Status |
|---|---|---|
| [DPIA.md](./DPIA.md) | Data Protection Impact Assessment (Art. 35) — description, necessity/proportionality, lawful basis, risk assessment, mitigations, residual risks | Draft — needs DPO sign-off |
| [RECORDS_OF_PROCESSING.md](./RECORDS_OF_PROCESSING.md) | Article 30 register of processing activities (A1–A11) | Draft |
| [SUBPROCESSORS.md](./SUBPROCESSORS.md) | Sub-processor register + DPA tracking checklist | Draft — **0 DPAs signed** |
| [DATA_RETENTION.md](./DATA_RETENTION.md) | Retention & minimisation schedule per data category | Draft — statutory periods TBD |
| [BREACH_RESPONSE.md](./BREACH_RESPONSE.md) | Art. 33/34 personal-data breach runbook (72-hour DPC duty) | Draft — contacts TBD |
| [ADMIN_AUTH_OPTIONS.md](./ADMIN_AUTH_OPTIONS.md) | Decision doc: replacing the shared-password admin | Recommendation (Option A now) |
| [MEDICAL_DEVICE_POSITIONING.md](./MEDICAL_DEVICE_POSITIONING.md) | How to word/design the app to stay wellness, outside EU MDR/IVDR (claims, DO/DON'T table, risky-surface review, red lines, risk verdict) | Draft — best-estimate MDR risk **LOW** under current wellness framing |
| [DPO_NOT_REQUIRED_MEMO.md](./DPO_NOT_REQUIRED_MEMO.md) | Dated, defensible "DPO not required (yet)" assessment (Art. 37(1) + WP243 "large scale" analysis) — scale-dependent, time-limited, with explicit review triggers | Draft — for solicitor / accredited-privacy-professional sign-off |

**Controller (interim): Codú Limited** — the founder's existing registered Irish company acts as the data controller for the early closed trial; a dedicated entity will be formed if the product monetises (at which point controller identity, DPAs and public privacy copy migrate). **Data-protection / privacy contact: `privacy@arcaevo.com`** — the durable, role-based, monitored address used across the public copy and every document here (receiving-mailbox setup in [`../EMAIL_ADDRESSES.md`](../EMAIL_ADDRESSES.md)). **No DPO is appointed at trial scale** — see [`DPO_NOT_REQUIRED_MEMO.md`](./DPO_NOT_REQUIRED_MEMO.md); the privacy contact is deliberately **not** labelled "DPO" (Art. 37(7)/WP243). Companion readiness docs: [`../SOC2_READINESS.md`](../SOC2_READINESS.md), [`../PRELAUNCH_CHECKLIST.md`](../PRELAUNCH_CHECKLIST.md).

Companion (existing) docs: [`../LAUNCH_READINESS.md`](../LAUNCH_READINESS.md) (the audit these draw on), [`../MOCKED_APIS.md`](../MOCKED_APIS.md), [`../BUILD_STATE.md`](../BUILD_STATE.md), [`../STRATEGY.md`](../STRATEGY.md).

## Overall status

The **GDPR architecture in the codebase is strong** for this stage — server-side Art. 9 consent enforcement with instant withdrawal, a real +30-day erasure job wired to a daily cron, EU-only hosting by design, and genuine data minimisation (only 4 wearable metrics sync; cycle data stays on-device unless enabled; no health values in email/push). The gaps are **operational and legal**, not architectural: no signed DPAs, no DPIA sign-off, and a single shared admin password unlocking all health data.

## The single most urgent legal action

**Complete and sign off the DPIA (Art. 35) before any real user, and — inseparable from it — replace the single shared admin password (which today unlocks every member's Art. 9 health data with no per-user accounts, roles, or audit log) with per-user accounts + a per-record access audit log.** The DPIA is effectively mandatory for large-scale special-category processing under Irish DPC guidance, and the admin-access gap is the highest residual risk it identifies (DPIA R4). Neither is hard; both must precede real health data in the system.

### The rest of the "before real users" shortlist (see DPIA §5)
1. **Sign DPAs** with MongoDB Atlas, Vercel, the EU ESP, and PostHog (SCCs where the processor is US-parented).
2. **Solicitor-review** the privacy policy / consent copy / terms / sub-processor page, and **confirm the interim controller entity** (**Codú Limited**, CRO number). Public privacy copy is now reconciled to **Codú Limited** with the role-based **`privacy@arcaevo.com`** contact (`legal.ts`, `/legal/[doc]`, `/contact`, `/consent`, `/account/privacy`). The **DPO decision** is captured as a documented "not required (yet)" position in [`DPO_NOT_REQUIRED_MEMO.md`](./DPO_NOT_REQUIRED_MEMO.md) — **needs sign-off**, and a DPO **will** be appointed at launch scale.
3. **Set `CRON_SECRET`, monitor the erasure cron**, and keep proof it ran; wire a **real EU ESP** for magic-link delivery.
4. **Fill the breach-response contacts** (DPC portal, insurer, solicitor) and confirm **cyber-insurance**.
5. **Paid tiers only:** a real IMC-registered clinician + clinical governance before any real blood result; extend erasure to lab copies + original upload files; DPAs with LGC/Stripe/phlebotomy/OCR.

_Last generated from the codebase on 2026-07-05. Regenerate/review on any material processing change (real generated narration, lab go-live, cycle features)._
