# SOC 2 Readiness Assessment — Arcaevo

> **Practical guidance, not a substitute for a qualified auditor / vCISO or Irish solicitor.** SOC 2 is a US attestation framework (AICPA Trust Services Criteria). For an Ireland-first, pre-revenue trial, **GDPR is the legal obligation; SOC 2 is not** — but B2B/corporate-wellness buyers and enterprise partners will eventually ask for it, and most SOC 2 controls are the same controls that reduce breach risk and satisfy GDPR Art. 32 today. This assessment maps where Arcaevo already stands and gives a **pragmatic near-term subset** worth doing now regardless of whether a formal audit ever happens.
>
> Interim controller: **Codú Limited**. Written 2026-07-05 from the codebase and `docs/legal/*`, `docs/LAUNCH_READINESS.md`.

---

## 0. Framing — read this first

- **SOC 2 is a 6–12 month journey, not a checklist you clear in a sprint.** Type I attests that controls are *designed* correctly at a point in time; **Type II** attests they *operated effectively over a period* (typically 3–12 months of evidence). You cannot shortcut the observation window.
- **You do not need SOC 2 to run a <10-user closed trial.** Pursue it when a buyer contractually requires it. **What you should do now** is the overlap set: controls that are (a) cheap, (b) required by GDPR anyway, and (c) directly reduce the chance of a special-category-data breach. That subset is §8.
- **Five Trust Services Criteria (TSC):** **Security** (a.k.a. Common Criteria, mandatory), **Availability**, **Confidentiality**, **Processing Integrity**, **Privacy** (the last four are optional; a health product should scope in **Confidentiality** and **Privacy** at minimum when it does pursue SOC 2).
- **Legend:** ✅ have · 🟡 partial · ❌ gap · **[code/infra]** engineering can build · **[org]** founder/organisation must establish (policy, contract, process, people).

---

## 1. Security (Common Criteria — mandatory)

The backbone. Arcaevo is unusually strong on the *technical* controls for its stage and weak on the *organisational* wrapper — the same shape as its GDPR posture.

| Control area | Status | Evidence / gap |
|---|---|---|
| Logical access — end users | ✅ | Server-enforced Art. 9 consent guard on all health endpoints; opaque SHA-256 session tokens, individually revocable; scrypt passwords; magic-link with attempt burn + cool-off (`consent-guard.ts`, `member-auth.ts`). |
| Logical access — **admin / privileged** | 🟡 → ✅ | **Materially fixed:** per-admin accounts with `owner/ops/clinician` roles, `admin_access_log` on every access to member Art.9 data, owner-only management UI, IP rate-limiting, and **opt-in TOTP MFA** (AES-256-GCM-sealed secret, backup codes) (`ADMIN_AUTH_OPTIONS.md`). **Remaining [org] decisions:** make MFA **mandatory** (at least owners), define owner-driven MFA recovery, self-service password reset. |
| Encryption in transit | ✅ | HTTPS everywhere; iOS Release is HTTPS-only with full ATS; security headers (HSTS, CSP `frame-ancestors none`, nosniff). **[code/infra]** |
| Encryption at rest | 🟡 | Atlas encryption-at-rest must be **confirmed enabled** on the prod cluster; iOS token in Keychain (`AfterFirstUnlockThisDeviceOnly`, no iCloud/backup); admin TOTP secrets sealed with AES-256-GCM. **Gap:** document the at-rest posture across Atlas (storage + backups) and Vercel logs. **[code/infra + org]** |
| Secrets management | ✅ | Fail-closed: server refuses to boot in prod without `SESSION_SECRET`/`ADMIN_PASSWORD`; `MFA_ENC_KEY`/`CRON_SECRET` fail-closed; SMTP creds never logged (`env.ts`, `instrumentation.ts`). **Gap [org]:** a written secret-rotation policy + custody register (who holds what, rotation cadence). |
| Network / infra hardening | 🟡 | **[infra]** Atlas IP allow-list + least-privilege DB user + EU region pinning still to confirm (`SUBPROCESSORS.md`). |
| Rate-limiting / abuse | ✅ | IP rate-limiting on auth + admin login (`rate-limit.ts`). Note: dev-grade fixed-window; fine for trial. |
| **Logging / monitoring / alerting (SIEM)** | ❌ | **Biggest Security gap.** There is an `admin_access_log` (data-access audit) but **no application error monitoring, no security-event alerting, no centralised log aggregation, no intrusion/anomaly detection.** No one is paged if something breaks or is attacked. **[code/infra]** — see §8. |
| **Change management** | ❌ | Git history exists, but **no documented change-management process** (PR review requirement, approval gates, deployment record, rollback procedure). **[org + light code]** |
| **Vulnerability / patch management** | ❌ | No documented dependency-scanning (`npm audit`/Dependabot), no patch cadence, no pen-test on record (two internal security reviews done — good, but not a substitute). **[code/infra + org]** |
| **Risk assessment (formal)** | 🟡 | The DPIA is an excellent risk assessment for data protection; there is **no organisation-level risk register** covering availability, vendors, personnel. **[org]** |
| **Policies (the SOC 2 backbone)** | ❌ | **No formal written policies** — Information Security Policy, Access Control, Acceptable Use, Incident Response (the breach runbook is close), Change Management, Vendor Management, BCP/DR, Data Classification. SOC 2 is heavily policy-evidenced. **[org]** |

---

## 2. Availability

For a <10-user trial this is low-stakes; it matters for paid/enterprise later.

| Control | Status | Note |
|---|---|---|
| Hosting resilience | 🟡 | Vercel (dub1/fra1) + Atlas (eu-west-1) are resilient managed platforms; **[infra]** confirm Atlas tier has adequate redundancy. |
| **Backups** | ❌→🟡 | **Confirm Atlas automated backups / PITR are enabled AND EU-region** (`SUBPROCESSORS.md` open item). No documented backup **restore test** — a backup you've never restored is a hope, not a control. **[infra + org]** |
| **BCP / DR plan** | ❌ | No business-continuity / disaster-recovery plan, no defined RPO/RTO. **[org]** — the Dockerfile/compose "AWS escape hatch" (CLAUDE.md) is a partial technical DR asset; document it. |
| Monitoring / uptime alerting | ❌ | No uptime/health-check monitoring or on-call. **[code/infra]** — see §8. |
| Capacity | ✅ (trivially) | Serverless auto-scales; irrelevant at trial scale. |

---

## 3. Confidentiality

Arcaevo's strongest area — this is where the health-data-minimisation work pays off.

| Control | Status | Note |
|---|---|---|
| Data classification | 🟡 | Implicitly excellent (Art. 9 data handled distinctly; health never in email/push/analytics/UserDefaults) but **not written down as a formal data-classification policy.** **[org]** |
| Minimisation | ✅ | Only 4 wearable aggregates sync; cycle data on-device unless enabled; Eircode → 3-char routing key; results never in email/push (`DATA_RETENTION.md`). Genuine design strength. |
| Confidential-data handling | ✅ | EU-only hosting; hashed sessions/tokens; PostHog carries no health data. |
| Encryption | 🟡 | See §1 (in transit ✅, at rest confirm). |
| **Vendor confidentiality (DPAs / NDAs)** | ❌ | **0 signed DPAs** with any processor (Atlas, Vercel, ESP, PostHog) — `SUBPROCESSORS.md`. This is both a GDPR blocker and a SOC 2 Confidentiality gap. **[org]** |
| Secure disposal | ✅ | Real +30-day hard-erasure across all collections (`erasure.ts`). Gap: extend to lab copies + original upload files (paid tiers). |

---

## 4. Processing Integrity

Relevant because Arcaevo computes health-adjacent scores users may act on.

| Control | Status | Note |
|---|---|---|
| Deterministic, testable logic | ✅ | Scores are deterministic engines; RCV verdicts guard against over-reading noise; vitest + Playwright suites exist. Strong. |
| Input validation | ✅ | Zod schemas on inputs; confirm-array capped; self-reported values permanently distinguished. |
| **No fabricated data to users** | 🟡 | **The known integrity risk:** mock AI extraction fabricates biomarker values from a filename hash — **gated OFF in prod** (`ALLOW_MOCK_EXTRACTION`), and insights/chat are canned demo content. **Must ship real generated content or clearly label as "coming"** before real users act on it (`LAUNCH_READINESS.md` Top-5 #2). **[code]** |
| Payment integrity | ✅ | Stripe webhook signature verification when secret set; payment-settled activation guard. |
| **QA / release gates** | ❌ | No documented QA sign-off or change-approval before deploy. **[org]** — overlaps §1 change management. |
| Processing monitoring | ❌ | No alerting if the scoring/erasure/webhook jobs silently fail. **[code/infra]** — e.g. the erasure cron needs monitored proof-of-run. |

---

## 5. Privacy

Very strong on the mechanisms; the gaps are the documentation/sign-off wrapper — and these are already tracked as the GDPR shortlist.

| Control | Status | Note |
|---|---|---|
| Notice / consent | ✅ | Versioned, un-bundled, server-enforced explicit Art. 9 consent; instant withdrawal (`consents.ts`, `consent-guard.ts`). Gap: solicitor-review the public privacy copy + reconcile controller identity (`legal.ts` still says "Arcaevo Health Ltd"; interim controller is **Codú Limited**). |
| Choice / access / erasure | ✅ | Self-service export/erase + one-month email fallback; real erasure queue + cron. |
| Retention | 🟡 | Real deletion mechanism; **statutory periods (tax, clinical) still TBD** (`DATA_RETENTION.md`). **[org]** |
| **DPIA** | 🟡 | Strong draft; needs **DPO/solicitor sign-off** before real users. **[org]** |
| **DPO / privacy contact** | ❌ | None appointed / documented; privacy email domain unreconciled. **[org]** |
| **Breach response** | 🟡 | Good draft runbook; **contacts [TBD]**, never exercised, DPC portal route to confirm (`BREACH_RESPONSE.md`). **[org]** |
| Transfers | 🟡 | EU-only by design; **confirm region pinning + SCCs in signed DPAs** for US-parented processors. **[infra + org]** |

---

## 6. People / HR controls (cut across all TSC)

At <10 users and essentially a solo founder these are light, but SOC 2 will require them once anyone (a clinician, an ops hire, a contractor) touches the system.

| Control | Status | Note |
|---|---|---|
| Onboarding / offboarding | ❌ | No documented joiner/leaver process. **Partial technical enabler exists:** admin accounts can be disabled from `/admin/admins` (revokes live session), which is the offboarding *mechanism* — wrap it in a written procedure. **[org]** |
| Background checks / confidentiality agreements | ❌ | None — relevant the moment a clinician/contractor is engaged. **[org]** |
| Security-awareness training | ❌ | N/A at solo stage; needed as the team grows. **[org]** |
| Role definition / least privilege | 🟡 | Admin roles exist (`owner/ops/clinician`); define the **role → data-access matrix** in writing (`ADMIN_AUTH_OPTIONS.md` open item). **[org]** |

---

## 7. Vendor / sub-processor risk management

| Control | Status | Note |
|---|---|---|
| Sub-processor inventory | ✅ | Excellent living register (`SUBPROCESSORS.md`). |
| **Signed DPAs / vendor agreements** | ❌ | **0 signed.** Atlas, Vercel, ESP, PostHog required before real users; Stripe/LGC/phlebotomy/OCR before paid tiers. **[org]** |
| Vendor security review | ❌ | No documented assessment of each vendor's own SOC 2 / ISO 27001 / security posture (all the majors have reports — collect them). **[org]** |
| Ongoing monitoring | ❌ | No process to re-review vendors or track their sub-processor changes (the public sub-processor page already promises change-notification — wire it). **[org/code]** |

---

## 8. Prioritised gap list — the pragmatic near-term subset

Ordered by **value now** (breach-risk reduction + GDPR overlap), with owner and build type. **Doing P0–P1 buys you most of the real-world risk reduction that SOC 2 would eventually force — without starting a formal audit.**

### P0 — do before ANY real user (also GDPR blockers)
1. **[org]** Sign **DPAs** with Atlas, Vercel, the EU ESP, PostHog (SCCs where US-parented). *(Confidentiality/Privacy/Vendor)*
2. **[org]** **DPIA sign-off** + name a **DPO/privacy contact**; reconcile controller identity to **Codú Limited**. *(Privacy)*
3. **[infra]** Confirm **Atlas encryption-at-rest + EU-region backups/PITR enabled**, IP allow-list, least-privilege DB user; run one **restore test**. *(Security/Availability/Confidentiality)*
4. **[code/infra]** **Error monitoring + alerting** — wire **Sentry** (app errors) and **basic uptime + erasure-cron success alerting**. This is the single highest-leverage technical gap: today nothing tells you if the app is broken or the erasure job silently failed. *(Security/Availability/Processing Integrity)*
5. **[org]** Make admin **MFA mandatory** (at least owners) and document the **role → data-access matrix** + a **leaver-offboarding procedure** (mechanism already exists). *(Security/People)*
6. **[org]** Fill **breach-runbook contacts** + confirm the **DPC portal route**; confirm **cyber-insurance**. *(Security/Privacy)*

### P1 — do within the first weeks of the trial
7. **[org]** Write the **core policies** as short, honest docs (2–3 pages each, not boilerplate): Information Security, Access Control, Incident Response (adapt the breach runbook), Change Management, Vendor Management, Data Classification & Retention, BCP/DR. These are the SOC 2 backbone **and** GDPR-accountability evidence. A vCISO/template service (Vanta/Drata/Secureframe) accelerates this but isn't required yet.
8. **[code/infra]** **Dependency scanning** (Dependabot/`npm audit` in CI) + a documented patch cadence. *(Security)*
9. **[code/infra]** Lightweight **change-management**: require PR review before deploy, keep a deployment log, document rollback. *(Security/Processing Integrity)*
10. **[org]** **Vendor security-report collection** — pull the SOC 2/ISO reports from Atlas, Vercel, Stripe, PostHog, ESP and file them. *(Vendor)*

### P2 — before wider (non-internal) launch / when a buyer asks
11. **[org]** Third-party **penetration test**. *(Security)*
12. **[code/infra]** **Centralised log aggregation** + basic anomaly alerting (beyond Sentry). *(Security)*
13. **[org]** Formal **risk register** + **annual review** cadence. *(all TSC)*
14. **[org]** If a customer requires it, engage a **SOC 2 automation platform + auditor** and start the **Type I → Type II** clock (expect 6–12 months of evidence). *(all TSC)*

---

## 9. Bottom line

Arcaevo's **technical control maturity is well ahead of its stage** — server-enforced consent, real erasure, per-admin roles + access log + MFA, encryption in transit, EU-only hosting, fail-closed secrets, rate-limiting, deterministic/tested logic. Against SOC 2, the deficits are almost entirely the **organisational wrapper**: written policies, vendor agreements/DPAs, monitoring/alerting, change/vuln management, BCP/DR, and people controls.

**Recommendation:** do **not** start a formal SOC 2 audit for the trial. Do the **P0/P1 subset** — it costs little, closes the same gaps GDPR requires, and materially cuts the chance of a special-category-data breach. When a corporate-wellness or enterprise buyer contractually demands SOC 2, you will already be 60–70% of the way to a Type I, and the policy work will be an evolution of documents you already have (this doc, the DPIA, the breach runbook, the sub-processor register), not a standing start.

---

_Practical guidance only. SOC 2 scoping and any audit should be confirmed with a qualified auditor / vCISO; GDPR obligations with an Irish solicitor._
