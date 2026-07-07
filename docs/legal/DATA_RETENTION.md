# Data Retention & Minimisation Schedule — DRAFT

> **DRAFT — prepared for review by a Data Protection Officer / solicitor before reliance. Not legal advice.**
>
> First-draft retention schedule per data category, grounded in the erasure code (`apps/web/src/lib/erasure.ts`), the deletion flow (`/api/v1/account/delete`), and the models (`apps/web/src/lib/models.ts`). Retention **periods** for legally-mandated records (tax, clinical) are placeholders for the solicitor to fix. The deletion **mechanism** is real and coded.
>
> **Controller (interim): Codú Limited.** Statutory tax/VAT retention (row 2) attaches to **Codú Limited's** Revenue obligations for the trial; keep those records isolated from health data and confirm the period (typically ~6 years).

## Principles (already implemented)

- **Delete on request, honestly.** Account deletion queues a real hard-erasure across every PII/health collection after a **30-day grace window** (`ERASURE_GRACE_DAYS = 30`, `models.ts`), executed by a daily Vercel Cron (`apps/web/vercel.json` `0 3 * * *` → `/api/v1/cron/run-erasure` → `runDueErasures`).
- **Withdraw = stop now.** Withdrawing `health_processing` immediately suspends processing and revokes every session (`consent-guard.ts` `suspendProcessingForWithdrawal`), before the 30-day erasure runs.
- **Retain only the proof.** The append-only **consent audit trail is retained after erasure** as the DPC-expected evidence that erasure happened and when (`erasure.ts`; the `consents` collection is the sole exception).
- **Minimise what is kept at all** (see the minimisation table at the end).

## Deletion mechanism reference

`eraseUserData(userId, email)` (`apps/web/src/lib/erasure.ts`) hard-deletes across: `users`, `memberships`, `test_orders`, `biomarker_readings`, `wearable_signals`, `bloodwork_uploads`, `sessions`, `share_links`, `referral_codes`, `gift_codes` (owned + redeemed), `support_tickets`, `waitlist`, `magic_link_tokens`, `outbox` — keyed by `memberId`/`userId` or by lowercased `email`. **Retained:** `consents` audit trail + the `erasure_jobs` record itself. Idempotent.

---

## Retention schedule

| # | Data category | Store / collection | Retention while active | Deletion trigger & mechanism | Notes |
|---|---|---|---|---|---|
| 1 | **Account** (name, email, DOB, auth fields, `stripeCustomerId`) | `users` (Atlas) | Life of account | +30d after deletion request → `users.deleteMany` | Fail-closed lifecycle: `status` active→closing→closed |
| 2 | **Membership & billing metadata** | `memberships` | Life of account | +30d → `memberships.deleteMany` | **Tax/VAT records** may need separate statutory retention (Irish Revenue, typically ~6y) held by Stripe / accounting, **isolated from health data** — *confirm period* |
| 3 | **Card data** | — (Stripe only) | Never stored by Arcaevo | N/A | PCI scope is Stripe's (`legal.ts`) |
| 4 | **Wearable aggregates** (HRV, RHR, sleep, VO₂max — 4 daily metrics) | `wearable_signals` | Life of account | +30d → `wearableSignals.deleteMany` | Backend holds only daily aggregates; iOS holds a **60-day in-memory** live series (not persisted) |
| 5 | **Biomarker readings** (blood results, bands, RCV verdicts) | `biomarker_readings` | Life of account | +30d → `biomarkerReadings.deleteMany` | **Clinical-record obligations** may apply to lab-returned results — *confirm with clinician partner* |
| 6 | **Bloodwork uploads** (photo/PDF/manual metadata + extracted values) | `bloodwork_uploads` | Life of account | +30d → `bloodworkUploads.deleteMany` | **AI-OCR image/PDF: NOT retained (in-flight only)** — the uploaded image transits to AWS Bedrock EU for the seconds of inference and is then discarded; **there is no raw-image field on `BloodworkUpload`**, and nothing is logged (`uploads/bloodwork/route.ts`, `ai-extraction.bedrock.ts`). Only the **derived numeric readings** persist (the `extracted[]` metadata here + confirmed `biomarker_readings` row 5) — retention **unchanged**. So the "original file" gap below does **not** apply to the OCR path (nothing is stored to erase). **OPEN (unchanged): original uploaded files** IF durable storage is ever added (`MOCKED_APIS.md` §17) |
| 7 | **Test orders** (kit/venous, status, clinician note) | `test_orders` | Life of account | +30d → `testOrders.deleteMany` | **[PLANNED] lab-partner copy** must be erased too — not yet covered |
| 8 | **Menstrual / cycle data** (opt-in) | On-device only unless enabled; then per #4 | On device; per #4 when enabled | Device: user's HealthKit control; backend: +30d via #4 path | OFF by default, never synced unless cycle-aware baselines enabled (`CycleBaselines.swift`, ALGORITHM.md §3.1/§5/§7) |
| 9 | **Sessions** (device-scoped) | `sessions` | 30-day sliding TTL (`SESSION_TTL_DAYS`); revoked on withdrawal/reset | Expiry, revocation, or +30d → `sessions.deleteMany` | Only SHA-256 token hash stored; iOS token in Keychain |
| 10 | **Magic-link tokens + codes** | `magic_link_tokens` | Single-use, 30-min expiry | Consumed/expired; +30d → `magicLinkTokens.deleteMany` | Hash-only; raw exists only in the email |
| 11 | **Rate-limit counters** | `rate_limits` | TTL-swept (window + one extra) | Automatic TTL index (`rate-limit.ts`) | IP-keyed; short-lived |
| 12 | **GP-share links + access log** | `share_links` | Default **30-day expiry**, member-revocable | Revoke/expiry; +30d → `shareLinks.deleteMany` | Access log is coarse (city-level) |
| 13 | **Support tickets** | `support_tickets` | *Set a period (e.g. 12–24 months)* | +30d → `supportTickets.deleteMany` | *Confirm active-support retention* |
| 14 | **Waitlist / eligibility** | `waitlist`, `eligibility_rejections` | Until launch/expansion decisions | +30d (by email) → `waitlist.deleteMany`; rejections are key-only | Address minimised to 3-char routing key |
| 15 | **Referral / gift codes** | `referral_codes`, `gift_codes` | Life of account / until redeemed | +30d → deleteMany (owned + redeemed) | Gift codes carry purchaser/recipient email |
| 16 | **Transactional email (outbox)** | `outbox` | *Decision pending — audit log vs minimise* | +30d (by `to` email) → `outbox.deleteMany` | Never contains health values; **decide whether the outbox stays as an audit log once a real ESP is live** (`MOCKED_APIS.md` §7) |
| 17 | **Consent audit trail** | `consents` | **Retained after erasure** | **NOT deleted** — proof of lawful processing + erasure | Append-only; version + surface + timestamp; no health values |
| 18 | **Erasure job record** | `erasure_jobs` | **Retained after erasure** | **NOT deleted** — proof erasure occurred | Holds userId, email, dates, status |
| 19 | **Analytics events** | PostHog EU | *Set a retention window in PostHog* | Per PostHog config | No health data ever; off by default |

---

## Data-minimisation choices already coded (evidence for the DPO)

- **Only 4 wearable metrics sync to the backend** — HRV, resting HR, sleep hours, VO₂max, as daily aggregates, not raw streams (`ArcaevoKit/Models.swift` `backendSynced`; `AppModel.swift` sync site; `SyncWearablesInput`). The Phase-22 expansion metrics (steps, active energy, respiratory rate, SpO₂, wrist temperature) stay **on-device**.
- **Menstrual/cycle data never synced unless cycle-aware baselines are enabled** — separate later HealthKit ask, OFF by default, gated behind the Data & Privacy toggle, computed on-device (`CycleBaselines.swift`, ALGORITHM.md §3.1/§5/§7).
- **Results never appear in email or push**, and the closure email carries the erasure date but **no health values** (`/api/v1/account/delete`).
- **Health values excluded from iOS `UserDefaults`** — the mid-confirmation raw biomarker state and the session token are deliberately never persisted there; the Keychain holds only the token (`apps/ios/Arcaevo/AppState.swift`, `ArcaevoKit/KeychainHelper.swift`).
- **Eircode reduced to its first 3 characters** (routing key) — full address never stored for eligibility (`WaitlistEntrySchema`, `EligibilityRejectionSchema`).
- **Auth secrets stored hashed only** — session tokens SHA-256, passwords scrypt, magic links/codes hash-only.
- **Cron/erasure responses carry counts + user ids only** — never health values.
- **AI-OCR blood-report image has zero retention** — the uploaded photo/PDF (special-category health data, bearing the identifiers printed on the report) is **never persisted and never logged**; it transits to AWS Bedrock EU in-flight only and is discarded immediately after extraction. Only the validated numeric readings the member confirms are stored (`self_reported`) (`uploads/bloodwork/route.ts`, `ai-extraction.bedrock.ts`, `ai-extraction.ts`).

## Open items for the DPO/solicitor
1. Fix the **statutory retention periods** for tax/VAT (row 2) and any **clinical-record** obligation for lab-returned results (rows 5, 7) — these may require keeping an isolated minimum **beyond** the 30-day erasure.
2. Decide the **outbox** policy (row 16) and **support-ticket** period (row 13).
3. Set a **PostHog retention window** (row 19).
4. Close the **original-upload-file** and **lab-partner-copy** erasure gaps (rows 6, 7) before those data sources go live.
5. Confirm the **30-day grace window** wording matches the privacy copy ("within 30 days", `legal.ts`).
