# Arcaevo — Launch Readiness & Compliance Audit

_Read-only audit for the first closed beta / real-user test. Written 2026-07-04 by the compliance & launch-readiness lead. Sources: `docs/BUILD_STATE.md`, `docs/MOCKED_APIS.md`, `docs/STRATEGY.md`, `docs/DEVICE_TESTING_AND_RELEASE.md`, `design_handoff_daily_engagement/ALGORITHM.md`, and the GDPR/consent/erasure code under `apps/web/src/lib` + `apps/web/src/app/api/v1`. No code was changed by this audit._

---

## Executive summary — the honest bottom line

**Is it safe to test with real users on the basic (wearables + Fusion) tier right now? Not yet — but you are close, and the gaps are operational, not architectural.**

The good news, said plainly: the GDPR machinery in this codebase is unusually well-built for a startup at this stage. Consent is genuinely enforced on the server (not a checkbox that does nothing), withdrawal instantly kills every session, "delete everything" really queues a hard-deletion of the member across every collection, and the whole stack is designed EU-only. The wellness-not-diagnosis framing is consistent and deliberate, and the blood-informed readiness engine is designed on the correct side of the medical-device line. These are the hard things to get right, and they are right.

The blockers are the boring, operational half: **nothing actually runs the erasure job on a schedule, there is no real email provider or rate-limiting on sign-in, the "upload a photo of your bloodwork" feature fabricates fake numbers instead of reading the file, admin access is a single shared password, and there is no legal sign-off or DPIA on file for what is legally "large-scale processing of special-category health data."** None of these are hard to fix, but every one of them must be closed before a real person's real health data touches the system.

**Verdict:** A tiny **internal** TestFlight with yourself and a handful of trusted people (who understand it is demo-grade) is fine today. A **real closed beta with strangers on the basic tier is NOT safe until the Top 5 below are done.** Paid blood-testing tiers are much further out and gated on a real clinician and lab partner (Section 6).

### Top 5 must-fix before ANY real user (basic tier)

1. **Wire the erasure cron.** The "erased within 30 days" promise is a lie until a scheduler actually calls `npm run erase:run`. The queue and runner exist (`apps/web/src/lib/erasure.ts`, `apps/web/scripts/run-erasure.ts`); nothing triggers them. Add a Vercel Cron (daily). — `MOCKED_APIS.md` §17.
2. **Stop the mock AI from showing fake bloodwork numbers.** `apps/web/src/lib/vendors/ai-extraction.mock.ts` fabricates biomarker values from a hash of the file name — it never reads the uploaded file. If a real user uploads a real lab PDF, they will "confirm" invented numbers as their own health data. Before real users: disable the photo/PDF upload path and allow **manual hand-entry only** (that path is real), OR ship real EU OCR extraction.
3. **Real EU email provider + rate-limiting on sign-in.** Magic links are the only way in, and today they only land in MailHog (local). Wire an EU ESP (Scaleway TEM / Postmark EU) and add IP/global rate-limiting to `POST /api/v1/auth/magic-link/verify` — currently there is none beyond a per-token attempt ceiling. — `MOCKED_APIS.md` §7, §12.
4. **Legal foundation for special-category data.** Confirm the data-controller entity actually exists and is named (the privacy copy asserts "Arcaevo Health Ltd", Dublin — `apps/web/src/content/legal.ts`), get a solicitor to review the privacy policy + sub-processor page, sign a real DPA with every processor (Vercel, MongoDB Atlas, the ESP, PostHog), and complete a **DPIA** — Art. 9 health data at any scale effectively mandates one under Irish DPC guidance.
5. **Lock down admin + production secrets.** Admin is a single shared password that unlocks every member's Art. 9 data (`MOCKED_APIS.md` §3). Set `SESSION_SECRET` and `ADMIN_PASSWORD` in prod (the server refuses to boot without them — `apps/web/src/lib/env.ts`), **never** set `ALLOW_DEMO_TOKEN`/`ALLOW_OPEN_WEBHOOKS` in real prod, and move admin to a real IdP with per-user accounts + audit log before strangers' data exists.

Count of open founder questions requiring your decision: **21** (Section 7).

---

## 1. GDPR / Irish DPC posture

**Overall: strong architecture, incomplete operational and legal wrapper.** This is the most mature part of the build.

### Lawful basis for Art. 9 health data
- The lawful basis is **explicit consent** under GDPR Art. 9(2)(a), which is the correct choice for a consumer wellness product processing HealthKit + bloodwork data. This is documented in the consent-guard header (`apps/web/src/lib/consent-guard.ts`) and the design.
- **Caveat:** explicit consent is fragile as a *sole* basis — it can be withdrawn at any moment, and you must be able to stop and erase on withdrawal (you can — see below). Keep it as the basis, but the privacy policy must make the consequence of withdrawal (account closure) unmistakable, because withdrawing the required `health_processing` consent triggers closure, not just a pause.

### Consent design — genuinely good
- **Three purposes**, defined in `apps/web/src/lib/models.ts:63` (`ConsentPurpose`): `health_processing` (required), `clinician_review` (required for tests), `research` (optional, **OFF by default**). This matches the locked design (`BUILD_STATE.md` V2 non-negotiables).
- **Versioned**: `CONSENT_VERSION = "2026-07-01"` (`models.ts:79`); the trail is append-only and stamps version + surface (`web`/`ios`) + timestamp on every grant/withdrawal (`api/v1/consents/route.ts`). Re-consent is detected when the notice version moves.
- **Revocable**: withdrawal is a `POST /api/v1/consents {granted:false}` and is a first-class flow, not buried.

### Server-side enforcement — real, not decorative
- `requireConsentedMember` (`apps/web/src/lib/consent-guard.ts`) composes member auth with a **live** consent check and guards every Art. 9 endpoint: `POST /sync/wearables`, `GET`/`POST /orders` (POST also requires `clinician_review`), `GET /orders/[id]`, `GET /results`, `GET /insights`, `POST /uploads/bloodwork` + `/confirm`, `GET`/`POST /share`. No current `health_processing` grant → **403 `consent_required`**. — `MOCKED_APIS.md` §16.
- **Withdrawal = immediate stop.** `suspendProcessingForWithdrawal` (consent-guard.ts:92) flags the user `processingSuspended`/`status:"closing"` **and deletes every session doc**, so live cookies and bearer tokens stop resolving at once. This is exactly what the DPC expects from "withdrawal is as easy as giving consent."

### Right to erasure — real queue, one unresolved production gap
- `POST /api/v1/account/delete` (`apps/web/src/app/api/v1/account/delete/route.ts`) records the withdrawal in the audit trail, revokes sessions, flags closing, sends the **E12** closure email (with the +30-day date, **no health values**), and enqueues an `erasure_jobs` doc `{eraseAfter: +30d, status:"scheduled"}`. `ERASURE_GRACE_DAYS = 30` (`models.ts:452`).
- `apps/web/src/lib/erasure.ts` hard-deletes the member across **all** PII/health collections (users, memberships, test_orders, biomarker_readings, wearable_signals, bloodwork_uploads, sessions, share_links, referral/gift codes, support_tickets, waitlist, magic_link_tokens, outbox) **except the `consents` audit trail**, which is intentionally retained as proof-of-erasure per DPC guidance. Idempotent.
- **THE UNRESOLVED BLOCKER:** nothing invokes `runDueErasures` automatically. The `+30d` queue is only a promise if a scheduler drains it. `MOCKED_APIS.md` §17 documents this as a hard production TODO. **This is Top-5 item #1.** Also note (§17): once real lab/upload copies exist you must also erase the **lab partner's** copy and any **stored original upload files** — the current runner only covers your own DB.

### Data minimisation — well thought through, verify in practice
- HealthKit is **read-only**; the app keeps a 90-day local series and **syncs daily aggregates only**, not raw streams (`STRATEGY.md` §5 data notes; `MOCKED_APIS.md` §8). Health values are deliberately **not** persisted to iOS `UserDefaults` — only the Keychain holds the session token (`MOCKED_APIS.md` §4a).
- **Menstrual / cycle data is the highest-sensitivity case and is handled correctly by design:** it is Art. 9 special-category data, requested via a **separate** HealthKit ask (never in the first sheet), off by default, gated behind a Data & Privacy toggle, and **never synced unless cycle-aware baselines are explicitly enabled** (`ALGORITHM.md` §3.1, §7; `DEVICE_TESTING_AND_RELEASE.md` §2.3). Confirm this holds true in the actual iOS implementation before launch (the daily-engagement Phase 22 that adds cycle handling is still `[ ]` unchecked in `BUILD_STATE.md` — do not ship cycle features until this is verified end-to-end).

### Retention
- Privacy copy commits to "no retention games" and one-tap export/delete (`legal.ts`), and to keeping only the legally-required minimum where law demands it. **Gap:** there is no written, signed-off **retention schedule** (how long wearable aggregates, outbox emails, support tickets, access logs are kept for active members). Produce one — the DPC expects a documented schedule, not just "we delete on request."

### International transfer — EU-only by design (good)
- Web hosting: **Vercel dub1/fra1** (EU regions) — `BUILD_STATE.md` architecture decisions.
- Database: **MongoDB Atlas eu-west-1** — `MOCKED_APIS.md` §9, CDK `region: eu-west-1`.
- Analytics: **PostHog EU** (`https://eu.i.posthog.com` hardcoded, off unless keyed) — `MOCKED_APIS.md` §6.
- Email: intended EU ESP (Scaleway TEM / Postmark EU) — `MOCKED_APIS.md` §7.
- This is a genuinely clean EU-transfer posture **provided you actually pin the Atlas cluster region and Vercel functions to the EU** and confirm no processor silently egresses to the US. Verify PostHog's account region is EU (not just the ingest host) and that Vercel Functions run in `dub1`/`fra1`. If any processor is a US entity, you still need SCCs even for EU-hosted data — the sub-processor page already references SCCs (`legal.ts`), but they must actually be in the signed contracts.

### DPO, records of processing, DPA chain
- **Data controller** is asserted as "Arcaevo Health Ltd", Dublin (`legal.ts:58`). **Confirm this legal entity is actually registered and is the named controller** (founder question).
- **DPO:** none identified. A DPO is likely required — Art. 37(1)(c) mandates one where core activities involve *large-scale processing of special-category data*, and a health-membership product is squarely in that zone. Even if you argue you're not yet "large scale," a **named privacy contact + a documented decision on DPO status** is expected. (Founder question.)
- **Records of Processing Activities (Art. 30):** not present in the repo. Create one — it is a basic legal obligation for a health-data controller.
- **DPIA (Art. 35):** not present. For large-scale special-category processing this is effectively mandatory. **Do it before real users.** (Top-5 item #4.)
- **Real DPA chain needed** with each processor: **MongoDB Atlas** (hosting + storage), **Vercel** (hosting), the chosen **EU ESP** (email), **PostHog** (analytics), and — for the paid tiers — **LetsGetChecked** (lab), **Stripe** (payments), and the **Dublin phlebotomy vendor** (Performance venous draws, no vendor chosen yet — `MOCKED_APIS.md` §10). Each must be signed, list sub-processors, guarantee EU processing / SCCs, and support your erasure obligations. The sub-processor list already exists as content (`legal.ts` "dpa" doc) but the contracts behind it do not yet.

---

## 2. Medical-device / regulatory line (MDR / IVDR)

**Overall: the design sits on the correct side of the line, deliberately. There is one drift to watch and one config-flag fallback to make sure actually works.**

### Is blood-informed wellness readiness safe under the wellness framing?
Yes, **as specified** — because of how narrowly blood is allowed to act. Per `ALGORITHM.md` §1.3 and §5:
- Blood does **exactly two things**: (a) shifts the *baseline ceiling* of a wellness score by a **bounded, deterministic, decaying** penalty (clamped floor ≈ 55 so it never reads alarmist), and (b) *widens the confidence band* and softens the decision one step toward rest. It **never produces a clinical interpretation** on the daily surface.
- **Flagged/critical values never enter the engine at all** — they route to the clinician-first flow (`ALGORITHM.md` §1.1 note, §5 "Blood never on the alarming edge"). This is the single most important rule keeping you on the wellness side.
- The **ON/OFF blood-layer toggle** is designed as both a real transparency feature **and** the documented MDR fallback: if a reviewer or regulator ever deems blood-modulated scoring too close to the medical line (the June-2025 MDCG guidance explicitly puts health apps in MDR/IVDR scope), you flip blood back to a clearly-separated *context* layer (the WHOOP/Oura pattern) via a config flag, not a rewrite (`ALGORITHM.md` §5; `DEVICE_TESTING_AND_RELEASE.md` §2.5).

### Where's the risk edge?
The regulatory question under MDR is *intended purpose*: does the app claim to diagnose, prevent, monitor, predict, or treat a disease? Wellness/lifestyle framing keeps you out of scope; anything that reads as clinical interpretation or medical advice pulls you in. The edge cases:

1. **The Readiness decision line — `Train hard / Train as planned / Go easy / Rest` (`ALGORITHM.md` §1.6, §1.7).** This is the closest thing to drift. A *training-load ceiling* framed as "here's your recovery, you decide" is wellness; a directive that reads as prescribed exercise dosing edges toward a medical/therapeutic claim. **Keep it a ceiling, not a quota** (the spec says exactly this — "never nag to hit a number; only cap"), and keep the copy suggestive, not prescriptive.
2. **Blood modifiers with plain-language "why" (`ALGORITHM.md` §1.3, Phase B in STRATEGY).** "Recovery capped by low ferritin — recheck in 6 weeks" is wellness (it explains a score and points at a recheck). "Ferritin 28 → reduce eccentric training volume" (the Vitara pattern, explicitly called out in `ALGORITHM.md` §5 as the line NOT to cross) is training *prescription* and sits closer to MDR. Hold the line: adjust the score and explain it; never prescribe.
3. **Vitality Age (`ALGORITHM.md` §3).** A banded, RCV-gated wellness index of age-associated markers is fine as wellness. It must never read as a health-risk prediction ("your biological age suggests disease risk") — that is predictive/diagnostic language.
4. **Clinician notes on every panel (Section 3 below).** The moment a human clinician writes an interpretation of a blood result, that is a *medical* act (not a device question, a clinical-governance one) — covered in Section 3, but note it changes the risk profile from "wellness app" to "wellness app + regulated clinical service."

### Concrete rules to keep it on the wellness side (make these launch invariants)
- Blood only modulates **score + band + ceiling**, never a clinical statement on the daily surface. (`ALGORITHM.md` §1.3)
- **Flagged/critical values leave the engine entirely** and go to the clinician-first flow. Verify the derivation code actually excludes flagged values from `BiomarkerPenalty.derive`.
- **No prescriptive training advice** — ceilings and suggestions only.
- **Amber at worst, no red numbers** anywhere in the daily layer (`ALGORITHM.md` §5, §6).
- The **ON/OFF fallback must behave as a genuine config flag** — test that flipping blood OFF cleanly reverts to a wearable-only "context beside the score" experience with no orphaned blood-derived copy. (Phase 22 is unbuilt; verify when it lands.)

### Things in the spec to keep watching
- The word **"prescriptive"** anywhere in generated insight copy is a red flag — the AI narrates, rules decide (`ALGORITHM.md` §5), and the AI must be constrained so it never crosses into advice. Since insights/chat are currently canned demo content (`STRATEGY.md` §2), the real risk arrives when generated narration ships — review that copy against this line before it goes live.
- Keep a **short written MDR self-assessment on file** ("intended purpose = wellness; not a medical device; rationale") so that if the DPC/HPRA or Apple asks, you have a documented position, not an improvised one.

---

## 3. Clinical safety

**Overall: the safety-flow design is excellent; the clinical *governance* behind it is entirely mocked and is a hard gate for the paid tiers.**

### The critical-value flow — well designed
- The locked pattern is **"Dr. Nolan would like a word first" — a clinician phones before the member ever sees an alarming number, and the app never shows a red value** (`BUILD_STATE.md` Phase 16 CriticalValueV3; `ALGORITHM.md` §4 "Critical values never push at all — clinician phones first"). Results are **never** in email or push payloads (`ALGORITHM.md` §4, `BUILD_STATE.md` V3 non-negotiables). This is exactly right for a health product and is also review-safe for Apple.

### The clinician note — currently a fictional persona (HARD GATE)
- The clinician-note-on-every-panel is the flagship differentiator (`STRATEGY.md` §3 #2; `ALGORITHM.md` §5), but today it is a **mock persona**: "Dr. S. Nolan, IMC 412887" is a fictional reviewer from the designs (`MOCKED_APIS.md` §15), and results are auto-marked `clinician_reviewed` by the seed/mock pipeline with no human in the loop (`MOCKED_APIS.md` §5).
- **This is a hard gate: a real, IMC-registered reviewing clinician + a medical-ops partner MUST be in place before any real blood result reaches any real user.** Presenting a fabricated clinician name/IMC to a real person, or auto-"reviewing" a real result with no clinician, would be a serious clinical-governance and potentially fraud issue. (`DEVICE_TESTING_AND_RELEASE.md` §2.2 flags the same.)
- Additional clinical-governance items the medical partner brings: professional indemnity insurance for the clinician, a defined escalation/on-call protocol for critical values (who actually makes the phone call, within what SLA), IMC scope-of-practice sign-off, and clinical responsibility for the biomarker threshold tables (currently "tune with clinician" placeholders in `ALGORITHM.md` §1.3 — **these thresholds must be clinician-owned, not engineering guesses**, and `STRATEGY.md` evidence caveats explicitly note the ferritin/CRP→recovery mappings are asserted, not clinically validated).

### Disclaimers
- Wellness-not-diagnosis language and disclaimers are consistently present across web (`/legal/clinical-safety`, `/science` safety bar), iOS, and the daily layer (`BUILD_STATE.md`). Keep every one; do not let any generated copy dilute them. Ensure the GP/112 emergency disclaimer is present wherever a user might mistake the app for urgent care.

**Note for the basic tier:** the wearables + self-uploaded (self-reported, hollow-gold, *never clinician-reviewed*) bloodwork path does **not** involve your clinician, so the clinician gate does not block a basic-tier launch — provided the app never implies a self-uploaded value was clinically reviewed (the "hollow gold dots" design enforces this distinction). But see Section 6 blocker #2: the mock extraction must not fabricate values.

---

## 4. Security

**Overall: a serious hardening pass was done and is genuinely solid; a defined set of production items remain.**

### Completed hardening (verified in code / `BUILD_STATE.md` security section)
- **Fail-closed secrets** (`apps/web/src/lib/env.ts`): `sessionSecret()` and `assertRequiredSecrets()` throw in production if `SESSION_SECRET`/`ADMIN_PASSWORD` are unset — the server refuses to boot rather than run with a forgeable admin cookie (wired via `src/instrumentation.ts`).
- **Server-side consent guard** on all 8 health endpoints (Section 1).
- **Demo-token gating**: `demo-member-token` is rejected in production unless `ALLOW_DEMO_TOKEN=true`; iOS only sends it in DEBUG builds (`env.ts` `demoTokenEnabled`, `MOCKED_APIS.md` §4).
- **Security headers** globally: CSP `frame-ancestors none`, HSTS, `X-Frame-Options: DENY`, nosniff, referrer-policy; `no-store`/`no-referrer` on token + health pages (`BUILD_STATE.md`).
- **Webhook secrets**: Stripe/LGC webhooks require a shared secret in prod, fail-closed (`env.ts` `verifyWebhookSecret`).
- **Session model**: opaque 256-bit tokens stored SHA-256-hashed, individually revocable; scrypt passwords; iOS token in Keychain (`AfterFirstUnlockThisDeviceOnly`, never iCloud/backup); Release build is HTTPS-only with full ATS (`MOCKED_APIS.md` §4a, §12).

### What remains for production (all documented, none yet done)
1. **Real admin IdP** — replace the single shared `ADMIN_PASSWORD` with per-user accounts, roles (ops vs clinician), and an audit log. Today one password reveals every member's Art. 9 data. (`MOCKED_APIS.md` §3) — **Top-5 #5.**
2. **IP/global rate-limiting on `/auth/magic-link/verify`** — there is none today beyond a 5-attempt-per-token ceiling and a per-email cool-off. Magic link is the only auth method, so this is exposed. (`MOCKED_APIS.md` §12) — **Top-5 #3.**
3. **Real webhook signature verification** — replace the shared-secret gate with real `stripe-signature` verification and LGC's real signature scheme. (`MOCKED_APIS.md` §1, §2) — paid-tier gate.
4. **Erasure cron** (also a GDPR item) — **Top-5 #1.**
5. **Real EU ESP** wired into `email.smtp.ts` with auth + TLS. (`MOCKED_APIS.md` §7) — **Top-5 #3.**
6. Confirm production env never sets `ALLOW_DEMO_TOKEN` or `ALLOW_OPEN_WEBHOOKS` (both are local-stack conveniences that would open real prod).

---

## 5. App Store / TestFlight review risks (HealthKit health app)

Apple scrutinises HealthKit apps hard. The design is deliberately review-safe; the risks are about *evidence and consistency*, and are covered in `DEVICE_TESTING_AND_RELEASE.md` §2.4 — summarised:

- **HealthKit purpose strings** must name **each** data type and its use in plain language (`Info-Debug.plist`/`Info-Release.plist`). Phase 22 expands the read types (sleep & stages, HR, HRV, VO₂max, workouts, active energy, steps, respiratory rate, SpO₂, wrist temperature); **cycle tracking must be a separate purpose string requested only when the user enables cycle-aware baselines** — never in the first sheet. **Do not list a type you don't actually read** (the old "Workouts" copy claim before ingestion existed was flagged in `STRATEGY.md` §2 as an integrity + review risk — make sure the primer matches reality).
- **App Privacy labels** must declare health data as **linked to the user**, mirroring the Art. 9 consent wording. Health data must **not** be used for advertising/tracking (it isn't — PostHog is EU + off by default).
- **No-IAP web checkout** is allowed here because you sell a *service consumed outside the app* (physical blood kits + membership). Keep payment CTAs as Safari link-outs, **never** an in-app purchase sheet, and be ready to justify it to review. (`MOCKED_APIS.md` §13; `DEVICE_TESTING_AND_RELEASE.md` §2.4)
- **No alarming medical claims / no diagnosis.** The amber-at-worst, no-red-numbers, clinician-phones-first design is exactly what keeps this clear — hold it across every screen and the App Store description.
- **Give the reviewer a working seeded demo login** and a written explanation of HealthKit usage + data handling for the Beta App Review (external TestFlight) and full review.
- **Practical prerequisites** (not compliance but launch-blocking): paid Apple Developer membership (€99/yr), `DEVELOPMENT_TEAM` set on all targets, real HTTPS backend + domain, AASA file hosted for universal links. (`DEVICE_TESTING_AND_RELEASE.md` Part 2)

---

## 6. Production blockers checklist

The founder is pursuing the bloodwork partnership **separately** and wants to launch the **basic tier without it**. That split is realistic — here it is made explicit. The basic tier = **wearables (HealthKit) + Fusion (user-uploaded/manual bloodwork, self-reported, never clinician-reviewed)**. It still processes Art. 9 data, so the GDPR + security + Apple items still apply; it just does **not** need a lab, a clinician, or payments-for-blood.

### A. Needed for basic / Fusion tier launch (NO bloodwork partner)

**GDPR / legal**
- [ ] **Erasure cron** wired (Vercel Cron → `npm run erase:run`, daily). *(Top-5 #1)*
- [ ] **DPIA** completed for Art. 9 processing.
- [ ] **Privacy policy + sub-processor page reviewed by a solicitor**; confirm data-controller entity is real and named.
- [ ] **DPAs signed** with Vercel, MongoDB Atlas, the EU ESP, PostHog (SCCs where any processor is non-EU).
- [ ] **Records of Processing (Art. 30)** + a written **retention schedule** on file.
- [ ] **DPO / named privacy contact** decision documented.
- [ ] **Breach-notification process** defined (72-hour DPC notification path).
- [ ] Verify **cycle/menstrual data** is never synced unless cycle-aware baselines are enabled (once Phase 22 ships).

**Security**
- [ ] Set `SESSION_SECRET` + `ADMIN_PASSWORD` in prod; **never** `ALLOW_DEMO_TOKEN` / `ALLOW_OPEN_WEBHOOKS`. *(Top-5 #5)*
- [ ] **Real admin IdP** (per-user accounts, roles, audit log) before real member data exists. *(Top-5 #5)*
- [ ] **IP/global rate-limiting** on `/auth/magic-link/verify`. *(Top-5 #3)*
- [ ] **Real EU ESP** for magic-link delivery. *(Top-5 #3)*

**Product integrity (basic tier specific)**
- [ ] **Disable mock AI bloodwork extraction** (`ai-extraction.mock.ts` fabricates values from the file name) — allow **manual hand-entry only**, or ship real EU OCR, before any real upload. *(Top-5 #2)*
- [ ] Ensure onboarding **HealthKit primer lists only signals actually ingested** (no "Workouts" claim until ingestion ships).
- [ ] Insights / Ask-Arcaevo chat are canned demo content (`STRATEGY.md` §2) — either ship real generated (rules-decide/AI-narrates) content or clearly gate/label these as coming, so users aren't shown fabricated "insights" about their real data.

**Infra / Apple**
- [ ] Production backend on **Vercel (EU) + Atlas eu-west-1** with `MONGODB_URI` set; confirm EU function region.
- [ ] Paid **Apple Developer membership**, `DEVELOPMENT_TEAM`, HTTPS domain, AASA file, HealthKit purpose strings + privacy labels.
- [ ] Release build verified HTTPS-only (already the case — keep it).

### B. Additionally needed BEFORE paid blood-testing tiers (Essential / Performance)

- [ ] **Real IMC-registered reviewing clinician + medical-ops partner** — replaces the fictional Dr. Nolan; no auto-"review". *(hard clinical gate — Section 3)*
- [ ] **Clinician-owned biomarker threshold tables** (readiness penalties + critical-value rules), not engineering guesses.
- [ ] **Clinical governance**: critical-value escalation/on-call protocol + SLA, clinician professional indemnity, IMC scope sign-off.
- [ ] **LetsGetChecked partner agreement** + real REST client + **real webhook signature verification** + biomarker-code mapping. (`MOCKED_APIS.md` §1)
- [ ] **Dublin phlebotomy vendor** for Performance venous draws (no vendor modelled yet — `MOCKED_APIS.md` §10).
- [ ] **Real Stripe** (EU entity) + real `stripe-signature` verification + Products/Prices (€119/€329/€399/+€130, €99/€69/€199) + Stripe Tax for IE VAT. (`MOCKED_APIS.md` §2)
- [ ] **Extend the erasure runner** to delete the lab partner's copy + stored original upload files.
- [ ] DPAs with **LetsGetChecked, Stripe, phlebotomy vendor**.
- [ ] Clinician-note-on-every-panel admin workflow made real (currently mock).

**Bottom line on the split:** launching the basic tier without a bloodwork partner is realistic and sensible. It removes the two longest-lead items (clinician + lab). But "basic" is **not** "compliance-light" — it still processes real HealthKit + user-entered blood data, so the entire Section A list is mandatory. The paid tiers add a *clinical service* on top, which is a materially higher bar (Section B).

---

## 7. Final questions & walkthroughs the founder must answer

Specific, actionable, and ordered roughly by urgency. These are decisions only you can make.

**Legal entity & governance**
1. Is **Arcaevo Health Ltd** actually registered (CRO number), and is it the named **data controller**? The privacy copy already asserts it — is it true?
2. Do you have a **DPO**, or have you documented the decision that you don't need one (and named a privacy contact instead)?
3. Who signs off the **DPIA**, and when will it be done — before or after first real user? (It must be before.)
4. Has a **solicitor reviewed** the privacy policy, terms, and sub-processor list? Who, and when?

**Clinical (gates the paid tiers)**
5. **Who is the named, IMC-registered reviewing clinician**, and what is their IMC number? (The current "Dr. S. Nolan, IMC 412887" is fictional.)
6. Who is the **medical-ops partner** running the review workflow and the critical-value phone call, and what is the SLA for a critical value?
7. Who **owns and signs off the biomarker thresholds** (readiness penalties + critical-value rules)? Do you have clinical evidence, or are these placeholders?
8. Do you have **professional indemnity insurance** for the reviewing clinician?

**Data processors & transfers**
9. Which **EU ESP** (Scaleway TEM, Postmark EU, other)? Is a DPA signed?
10. Is the **Atlas cluster confirmed in eu-west-1** with a signed DPA, and are backups/PITR also EU-region?
11. Are **Vercel functions confirmed to run in the EU** (dub1/fra1), with a signed DPA?
12. Is **PostHog's account region EU** (not just the ingest URL), with a DPA? Will analytics be on at launch or stay off?
13. For any **non-EU processor**, are **SCCs** actually in the signed contract?

**Insurance & risk**
14. Do you have **cyber / data-breach insurance**? For a health-data controller this is strongly advisable.
15. Do you have **product/professional liability insurance** appropriate to a health-wellness product?

**Security & operations**
16. Who holds the **admin password** today, and when does admin move to a **real IdP** with per-user accounts + audit log?
17. What is your **breach-notification runbook** (who decides, how you hit the 72-hour DPC deadline, how you notify affected users)?
18. Who runs (and monitors) the **erasure cron**, and how will you prove to the DPC it ran?

**Product scope decisions**
19. For the basic-tier launch, will you **disable photo/PDF bloodwork upload** (manual entry only) until real OCR exists, or fund real EU OCR first? (You cannot ship the mock extraction to real users.)
20. Will **insights / Ask-Arcaevo chat** ship as real generated content, or be gated/labelled as "coming" so real users aren't shown fabricated insights?
21. Do you have a written **MDR intended-purpose self-assessment** (wellness, not a medical device) on file, and have you confirmed the blood-layer **ON/OFF toggle behaves as a true config flag** for the regulatory fallback?

---

_End of audit. Nothing in this document is legal advice; it is an engineering-and-compliance readiness review. The two items that most change your legal exposure — a DPIA for Art. 9 data, and a real clinician before real results — are worth a professional's time before you press launch._
