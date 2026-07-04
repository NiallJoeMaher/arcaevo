# Records of Processing Activities (Article 30) — DRAFT

> **DRAFT — prepared for review by a Data Protection Officer / solicitor before reliance. Not legal advice.**
>
> This is a first-draft Article 30(1) controller register, generated from the current codebase to reduce the founder's legal-review burden and accelerate a real DPO/solicitor review. It describes what the code **actually does today** (with file citations), plus the planned paid-tier activities marked **[PLANNED]**. Every entry needs confirmation against the operating reality before reliance.

## Controller identity (Art. 30(1)(a))

| Field | Value | Source / status |
|---|---|---|
| Controller | Arcaevo Health Ltd, Dublin, Ireland | Asserted in `apps/web/src/content/legal.ts` (privacy doc, "Who we are"). **OPEN: confirm the entity is registered (CRO number) and is the named controller.** |
| Controller representative | Founder (Niall Maher) | Confirm |
| Data Protection Officer | **None appointed** | **OPEN: a DPO is likely required — Art. 37(1)(c), core activities = large-scale special-category processing. Either appoint one or document the decision + name a privacy contact.** Privacy contact address in copy: `privacy@arcaevo.health` (`legal.ts`, data-deletion doc). Note the domain mismatch vs the `arcaevo.com` app host — reconcile. |
| Establishment / lead SA | Ireland — Data Protection Commission (DPC) | Controller is Dublin-based; EU-only processing |

## Register conventions

- **Lawful basis** for health/wearable/special-category data is **explicit consent, Art. 9(2)(a)** (`apps/web/src/lib/consent-guard.ts`, `apps/web/src/lib/models.ts` `ConsentPurpose`). Ordinary account/contract data relies on **Art. 6(1)(b) contract** and **6(1)(f) legitimate interests** (security). See the privacy copy's "lawful basis" section (`legal.ts`).
- **Retention** rows summarise the schedule; the authoritative detail is in `DATA_RETENTION.md`.
- **Security measures** common to all activities are listed once in the footer and referenced as **[S]**.

---

## A1 — Account & authentication

| Attribute | Detail |
|---|---|
| Purpose (Art. 30(1)(b)) | Create and secure a member account; sign-in via magic link (primary) or optional password; device-scoped sessions (web/iOS/watch) |
| Data subjects | Members, prospective members (sign-ups) |
| Personal data categories | Email, display name, `joinedAt`; optional scrypt password hash; `emailVerified`, failed-attempt counter/cool-off; session records (SHA-256 token hash, device, user-agent (truncated 256 chars), `lastSeen`, `expiresAt`); magic-link tokens (SHA-256 hash + code hash) — `apps/web/src/lib/models.ts` (`UserSchema`, `SessionSchema`, `MagicLinkTokenSchema`), `apps/web/src/lib/member-auth.ts` |
| Special-category data | None |
| Lawful basis | Art. 6(1)(b) contract (account) + 6(1)(f) legitimate interests (auth security, abuse rate-limiting) |
| Recipients / processors | MongoDB Atlas (storage), Vercel (hosting), EU ESP (magic-link/code delivery) — see `SUBPROCESSORS.md` |
| Transfers | EU-only by design |
| Retention | Life of account; sessions expire on 30-day sliding TTL (`SESSION_TTL_DAYS`); magic-link tokens single-use, 30-min expiry; rate-limit counters TTL-swept (`apps/web/src/lib/rate-limit.ts`). Erased on account deletion (except consent trail). |
| Security | [S]; opaque 256-bit tokens stored hashed; scrypt passwords (N=16384); IP rate-limiting on verify/signin/link-request |

## A2 — Membership & billing

| Attribute | Detail |
|---|---|
| Purpose | Sell and manage annual membership + add-on tests; billing, renewals, dunning, refunds |
| Data subjects | Members, gift purchasers/recipients |
| Personal data categories | Membership tier/term/renewal, price; `stripeCustomerId`, `stripeSubscriptionId`, `cancelAtPeriodEnd`, dunning stage; date of birth (collected at checkout — a lab requirement); delivery address (Essential/Performance kits); gift/referral codes with purchaser/recipient email — `MembershipSchema`, `TestOrderSchema`, `GiftCodeSchema`, `ReferralCodeSchema`, `CheckoutInput` (`models.ts`) |
| Special-category data | None directly (DOB + address are ordinary personal data; the fact of a health-test purchase can be health-adjacent — treat with care) |
| Lawful basis | Art. 6(1)(b) contract; Art. 6(1)(c) legal obligation for tax/VAT records |
| Recipients / processors | Stripe (payments — see §Stripe controller/processor note in `SUBPROCESSORS.md`); MongoDB Atlas; Vercel; EU ESP (receipts) |
| Transfers | Stripe is a US-headquartered controller for some payment data → **SCCs / adequacy assessment required** |
| Retention | Card data never stored by Arcaevo (Stripe holds it); billing/tax records retained for the statutory period (Irish Revenue — typically 6 years) **isolated from health data** — confirm schedule |
| Security | [S]; no card numbers stored server-side (`legal.ts` "Payments & messaging"); webhook signature verification when `STRIPE_WEBHOOK_SECRET` set (`apps/web/src/lib/stripe-signature.ts`) |

## A3 — HealthKit / wearable ingestion (Apple Watch + Apple Health)

| Attribute | Detail |
|---|---|
| Purpose | Fuse wearable signals into baseline-relative wellness insights and the readiness/energy scores |
| Data subjects | Members who connect Apple Health |
| Personal data categories | **Special-category (health).** On-device the app reads a broad HealthKit set (HRV, resting HR, sleep + stages, VO₂max, workouts, active energy, steps, respiratory rate, SpO₂, wrist temperature; cycle data opt-in — see A5). **Only 4 daily aggregates sync to the backend**: HRV, resting HR, sleep hours, VO₂max — `WearableSignalType` / `WearableSignalSchema` (`models.ts`), `SyncWearablesInput`. New Phase-22 metrics stay on-device until the web schema grows. |
| Special-category data | Yes — Art. 9 health data |
| Lawful basis | **Art. 9(2)(a) explicit consent** (`health_processing`), enforced server-side on `POST /api/v1/sync/wearables` (`consent-guard.ts`) |
| Recipients / processors | MongoDB Atlas; Vercel. **Apple is NOT a processor for on-device HealthKit** (data stays on the device under the user's iCloud/Apple relationship until the app syncs the 4 aggregates) — see `SUBPROCESSORS.md`. |
| Transfers | EU-only |
| Retention | On-device: a 60-day series queried live from HealthKit and held in memory (baseline window; workouts 14d, sleep 30d) — no raw on-disk health store (`apps/ios/Arcaevo/AppModel.swift`, `HealthKitProvider.swift`); backend daily aggregates retained for active account; erased on deletion |
| Security | [S]; HealthKit read-only (no write/share types); health values excluded from iOS `UserDefaults` (Keychain holds only the session token); data-minimised sync (4 metrics, daily granularity, not raw streams) |

## A4 — Blood-panel processing (upload / manual entry now; lab kits [PLANNED])

| Attribute | Detail |
|---|---|
| Purpose | Capture biomarker values (user-uploaded/typed now; lab-returned [PLANNED]); compute personal baseline bands + RCV "real change" verdicts; render fusion timeline |
| Data subjects | Members |
| Personal data categories | **Special-category (health).** Biomarker readings (code, value, unit, `takenAt`, baseline band, RCV verdict, `source: lab | self_reported`, `clinicianReviewed`); bloodwork uploads (kind photo/pdf/manual, filename, source lab name, document date, extracted values) — `BiomarkerReadingSchema`, `BloodworkUploadSchema` (`models.ts`) |
| Special-category data | Yes — Art. 9 health data |
| Lawful basis | Art. 9(2)(a) explicit consent (`health_processing`); ordering a lab test additionally requires `clinician_review` consent (`consent-guard.ts` `clinicianReview` option) |
| Recipients / processors | MongoDB Atlas; Vercel; **[PLANNED]** LetsGetChecked (lab), EU OCR vendor (extraction), mobile phlebotomy vendor |
| Transfers | EU-only intended |
| Retention | Active account; erased on deletion. **Note:** mock AI extraction is OFF in production (`ALLOW_MOCK_EXTRACTION` gate, `env.ts`) — real users are routed to manual hand-entry until a real EU OCR vendor lands |
| Security | [S]; self-reported values permanently distinguished ("hollow gold dots", never presented as clinician-reviewed); confirm-array capped at 100 |

## A5 — Menstrual / cycle data (opt-in) [HIGHEST SENSITIVITY]

| Attribute | Detail |
|---|---|
| Purpose | Cycle-phase-aware baseline bands so luteal-phase HRV dips don't false-alarm the readiness score |
| Data subjects | Members who explicitly enable cycle-aware baselines |
| Personal data categories | **Special-category (health).** Menstrual flow + cycle-tracking category types, read on-device only |
| Special-category data | Yes — Art. 9, and among the most sensitive |
| Lawful basis | Art. 9(2)(a) explicit consent under the existing `health_processing` grant, plus a distinct in-app opt-in |
| Data-protection-by-design controls | Separate HealthKit authorisation request (`requestCycleAccess()`), **never in the first onboarding sheet**; **OFF by default** (`CyclePreferences.isEnabled`, UserDefaults key `arcaevo.cycleAwareBaselines`); gated behind a Data & Privacy toggle; **never synced to the backend unless cycle-aware baselines are enabled** — confirm against ALGORITHM.md §7/§11 and the iOS implementation |
| Recipients / processors | On-device only unless enabled; then MongoDB Atlas / Vercel per A3 |
| Retention | On device; per A3 when enabled; erased on deletion |
| Security | [S]; strongest minimisation posture in the product |

## A6 — Daily-engagement scoring (readiness / energy / vitality) — profiling

| Attribute | Detail |
|---|---|
| Purpose | Compute a baseline-relative wellness readiness score, energy curve, vitality age index, and behaviour-impact insights from wearable + (optional) blood data |
| Data subjects | Members |
| Personal data categories | Derived special-category health indicators (readiness score/band/decision, exertion ceiling, vitality-age band, behaviour deltas). Blood modulates the score via **bounded, deterministic, decaying** penalties (floor ≈ 55) — Phase 22, ALGORITHM.md §1.3 |
| Special-category data | Yes — derived from Art. 9 data; itself health-related |
| Profiling / automated decisions | **Profiling, yes** (Art. 4(4)); **NOT** a decision producing legal or similarly significant effects (Art. 22). It is a wellness score with a suggestive training-ceiling ("Go easy / Train as planned"), never a diagnosis, never prescriptive dosing. **Critical/flagged values never enter the engine** — they route to the clinician-first flow. See DPIA §Profiling. |
| Lawful basis | Art. 9(2)(a) explicit consent |
| Recipients / processors | Computed largely on-device (iOS `ReadinessEngine`); server holds inputs (the 4 wearable aggregates + biomarker readings) and generates narration [PLANNED real generation] |
| Retention | Per A3/A4 |
| Security | [S]; blood-layer ON/OFF is a real user toggle AND the documented MDR fallback flag |

## A7 — Clinician review & GP-share [PARTLY PLANNED]

| Attribute | Detail |
|---|---|
| Purpose | Human clinician review + note on each reviewed panel; member-initiated, revocable GP-share links |
| Data subjects | Members; recipient GPs (via share link) |
| Personal data categories | Clinician note (text, clinician name, IMC number, `readAt`); share link (token, expiry, revoked flag, coarse access log `{at, location}`) — `ClinicianNoteSchema`, `ShareLinkSchema` (`models.ts`) |
| Special-category data | Yes — the note interprets health data |
| Lawful basis | Art. 9(2)(a) explicit consent (`clinician_review`); GP-share is member-initiated disclosure |
| Recipients / processors | **[PLANNED] real IMC-registered clinician + medical-ops partner** (today: MOCK persona "Dr. S. Nolan, IMC 412887", `CLINICIAN_NAME`/`CLINICIAN_IMC_NUMBER` in `models.ts` — **must not reach real users**); GP recipient of a share link |
| Transfers | EU-only |
| Retention | Share links: 30-day default expiry, revocable; access log coarse (city-level, currently hardcoded "Dublin" — `MOCKED_APIS.md` §14). Note clinical records may carry their own retention obligation — confirm with the clinician partner |
| Security | [S]; results never in email/push; access logged; share links revocable + expiring |

## A8 — Transactional email / messaging

| Attribute | Detail |
|---|---|
| Purpose | Magic-link/code delivery, receipts, kit reminders, results-ready (no result values), closure confirmation (E12) |
| Data subjects | Members, sign-ups |
| Personal data categories | Email address, name, transactional content (**never health values / never result numbers** — `account/delete/route.ts`, `MOCKED_APIS.md` §7) |
| Special-category data | None in payloads by design |
| Lawful basis | Art. 6(1)(b) contract (service emails); Art. 6(1)(f) for security notices |
| Recipients / processors | **[PLANNED] EU ESP** (Scaleway TEM / Postmark EU — TBD); today: Mongo `outbox` + local MailHog only (`email.mock.ts`, `email.smtp.ts`) |
| Transfers | EU-only intended |
| Retention | Outbox retained as an audit log (decision pending — see `DATA_RETENTION.md`); erased on account deletion (`outbox.deleteMany({to})`) |
| Security | [S]; SMTP credentials never logged; no result values in any email |

## A9 — Analytics (product usage)

| Attribute | Detail |
|---|---|
| Purpose | Aggregated product-usage analytics to keep the app working and improve it |
| Data subjects | App/site users who accept analytics |
| Personal data categories | Usage/event data; **off by default**, only active when `NEXT_PUBLIC_POSTHOG_KEY` is set (`apps/web/src/lib/analytics.ts`) |
| Special-category data | **None — health data must never be sent to analytics** (invariant) |
| Lawful basis | Consent (ePrivacy/cookies) — analytics cookies "off until you accept" (`legal.ts` cookie policy) |
| Recipients / processors | PostHog EU (`https://eu.i.posthog.com` hardcoded) |
| Transfers | EU region — **confirm PostHog account region is EU, not just the ingest host** |
| Retention | Per PostHog config — set a retention window |
| Security | [S]; no US-hosted scripts; not used for advertising/tracking |

## A10 — Eligibility & waitlist

| Attribute | Detail |
|---|---|
| Purpose | Launch-area gating (Eircode routing-key allowlist) + waitlist for out-of-area demand |
| Data subjects | Prospective members |
| Personal data categories | Email, **first 3 Eircode chars only** (routing key — deliberate minimisation), county, queue position; rejected routing keys logged **key-only, no address** — `WaitlistEntrySchema`, `EligibilityRejectionSchema` (`models.ts`) |
| Special-category data | None |
| Lawful basis | Art. 6(1)(b)/(f) (pre-contract + service planning) |
| Recipients / processors | MongoDB Atlas; Vercel; EU ESP |
| Retention | Until launch/expansion decisions complete; waitlist erased on account deletion by email |
| Security | [S]; deliberate address minimisation |

## A11 — Right-to-erasure execution & consent audit

| Attribute | Detail |
|---|---|
| Purpose | Honour Art. 17 erasure; maintain the Art. 7(1)/30 consent audit trail as proof of lawful processing + erasure |
| Data subjects | Members who withdraw consent / delete |
| Personal data categories | Erasure job (userId, email, requestedAt, eraseAfter, status); **retained** consent audit trail (append-only grant/withdrawal records with version + surface + timestamp) — `ErasureJobSchema`, `ConsentSchema` (`models.ts`), `apps/web/src/lib/erasure.ts`, `apps/web/src/lib/consents.ts` |
| Special-category data | The consent records reference that health processing occurred, but hold no health values |
| Lawful basis | Art. 6(1)(c) legal obligation (demonstrating GDPR compliance); the retained consent trail is the DPC-expected evidence of erasure |
| Recipients / processors | MongoDB Atlas; Vercel Cron (daily drain, `apps/web/vercel.json` `0 3 * * *`, secured by `CRON_SECRET`) |
| Transfers | EU-only |
| Retention | Erasure job + consent trail **retained after erasure** (proof); everything else hard-deleted after the +30-day grace (`ERASURE_GRACE_DAYS`) |
| Security | [S]; cron fails closed in production without `CRON_SECRET`; response carries counts + user ids only, never health values. **OPEN: extend runner to erase lab-partner copies + stored original upload files once they exist** (`MOCKED_APIS.md` §17) |

---

## [S] — Common technical & organisational security measures (Art. 30(1)(g))

- **EU-only hosting** — Vercel (dub1/fra1), MongoDB Atlas (eu-west-1), PostHog EU (`BUILD_STATE.md`, `MOCKED_APIS.md` §6/§9).
- **Server-side Art. 9 consent enforcement** on all 8 health endpoints; withdrawal instantly revokes every session (`consent-guard.ts`).
- **Real, scheduled erasure** with a 30-day grace window (`erasure.ts`, `vercel.json` cron, `CRON_SECRET`).
- **Fail-closed production secrets** — server refuses to boot without `SESSION_SECRET` + `ADMIN_PASSWORD` (`env.ts`, `instrumentation.ts`).
- **Encryption in transit and at rest**; Release iOS is HTTPS-only with full ATS; session token in Keychain (`AfterFirstUnlockThisDeviceOnly`, no iCloud/backup).
- **Opaque hashed session tokens** (SHA-256), individually revocable; scrypt password hashing.
- **Security headers** globally (CSP `frame-ancestors none`, HSTS, `X-Frame-Options: DENY`, nosniff, referrer-policy; `no-store`/`no-referrer` on token + health pages).
- **IP rate-limiting** on auth endpoints (`rate-limit.ts`).
- **Data minimisation** — 4 wearable metrics synced; cycle data on-device unless enabled; no health values in email/push; Eircode reduced to routing key.
- **Results never in email or push**; critical values routed to clinician-first flow.

### Known control gaps (carry into DPIA residual risks)
- **Admin auth is a single shared password** unlocking every member's Art. 9 data, no per-user accounts/roles/audit log (`MOCKED_APIS.md` §3, `auth.ts`) — see `ADMIN_AUTH_OPTIONS.md`.
- **Signed DPAs not yet in place** with any processor (see `SUBPROCESSORS.md`).
- **No formal breach runbook exercised** (see `BREACH_RESPONSE.md`).
- **Clinician review is a mock persona** — real IMC clinician required before real results (paid-tier gate).
