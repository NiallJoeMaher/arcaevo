# Arcaevo — Whole-Codebase Security Audit

**Date:** 2026-07-05
**Auditor:** Senior application-security engineer (adversarial, read-only)
**Scope:** `apps/web` backend (all 52 API route handlers + shared libs), `apps/ios` + `apps/ios/ArcaevoWatch` security-relevant code, `infra/cdk`.
**Data at stake:** GDPR Art.9 special-category health data (Apple Watch metrics + blood biomarkers). A leak is business-ending — this audit hunts concrete, exploitable paths to member health data.

---

## Executive summary

**Overall risk verdict: LOW–MODERATE. No Critical or High confirmed-exploitable issue. No unauthenticated path to another member's health data was found.**

This is an unusually well-secured codebase for its stage. Authentication, authorization, and IDOR hygiene are strong and consistent: **every** member data route scopes its Mongo query to `auth.member._id` (no route trusts a client-supplied member id), every admin route is guarded, role-gating is correct, secrets fail closed in production, webhooks do real Stripe signature verification, sessions are opaque + individually revocable, passwords use scrypt, admin MFA is TOTP with an AES-256-GCM-sealed secret, and rate limiting covers all auth surfaces. iOS stores tokens in the Keychain with a hardened accessibility class, enforces ATS in Release, and logs nothing.

The findings below are **defense-in-depth gaps and privacy leaks**, not open doors. The single most important one for the founder's stated fear (a health-data leak) is **W-1**: consent withdrawal does not revoke a member's already-issued public GP share links, so Art.9 lab values keep being served from the public `/s/[token]` endpoint after the member has withdrawn consent, until the link expires or the account is erased.

### Findings by severity
| Severity | Count |
|---|---|
| Critical | 0 |
| High | 0 |
| Medium | 5 |
| Low | 6 |
| Informational | 3 |

### Top 3 most serious

1. **W-1 (Medium) — Consent withdrawal leaves public GP share links live.** Withdrawing `health_processing` revokes sessions but does **not** revoke `share_links`. The public `/api/v1/share/[token]` (and `/s/[token]` page) keeps returning the member's lab biomarker values + name to anyone holding the link, for up to 30 days (link expiry / erasure grace), despite consent being withdrawn. Direct Art.9 exposure + GDPR enforcement gap. `apps/web/src/app/api/v1/share/[token]/route.ts:20-105`, `apps/web/src/lib/consent-guard.ts:92-109`.
2. **A-1 (Medium) — Bootstrap `ADMIN_PASSWORD` is a mandatory, MFA-exempt, non-revocable shared owner credential in production.** `assertRequiredSecrets()` *requires* `ADMIN_PASSWORD` to boot in prod; the password-only login path resolves to a synthetic `bootstrap-owner` that `adminHasMfa()` always treats as MFA-off and `currentAdmin()` exempts from the DB disabled/role check. One shared-secret compromise = full owner access, bypassing MFA and per-account revocation. `apps/web/src/lib/auth.ts:63-67,119-130,152-176`, `apps/web/src/lib/admin-mfa.ts:414-419`, `apps/web/src/lib/env.ts:53-64`.
   **RESOLVED (branch `post-launch-improvements`):** (1) MFA is now **mandatory** for every real admin account — a no-MFA account is forced through an enrolment gate (scoped `mfa-enroll` cookie, no session) before any admin session is issued, so the email+password path can no longer reach data with a single factor. (2) A new **`ADMIN_BOOTSTRAP_DISABLED=true`** env flag rejects the shared-password bootstrap login entirely and removes the `ADMIN_PASSWORD` boot requirement, so once a real MFA-enrolled owner exists the break-glass credential can be turned off in prod. The bootstrap path stays MFA-exempt by design (break-glass) but is now disable-able; pointing `ADMIN_EMAIL` at a real MFA owner also makes it challenge MFA. Bootstrap logins are logged as `adminId:"bootstrap-owner"` for alerting.
3. **I-1 (Medium, iOS) — Subjective health data in plaintext UserDefaults.** Daily wellbeing check-ins (`feel` 1–5, `sick` bool, tags incl. "Feeling ill" / "Alcohol" / "Stressed") plus DOB + email are written to unencrypted UserDefaults (in device backups, readable on a jailbroken/forensically-imaged device) — inconsistent with the app's own correct decision to keep biomarker values out of UserDefaults. `apps/ios/Arcaevo/AppModel.swift:311,341-347`, `apps/ios/ArcaevoWatch/WatchModel.swift:230-240`, `apps/ios/ArcaevoKit/AppState.swift:486-509`.

---

## Findings (ranked by severity)

| ID | Sev | Category | Location | Exploit scenario | Fix |
|----|-----|----------|----------|------------------|-----|
| **W-1** | Medium | AuthZ / Consent enforcement / Art.9 exposure | `api/v1/share/[token]/route.ts:20-105`; guard omission in `lib/consent-guard.ts` | Member withdraws `health_processing` consent (or requests deletion). Sessions are revoked, but any GP share link they previously created stays valid. The public `GET /s/<token>` continues to return their name + lab biomarker values for up to 30 days (link TTL / erasure grace). Consent no longer covers the processing, yet the data is still disclosed. **Confirmed** (share GET checks only `revoked`, `expiresAt`, member existence — not `processingSuspended` / `status`). | On withdrawal/closure, also `shareLinks.updateMany({ userId }, { $set: { revoked: true } })` inside `suspendProcessingForWithdrawal`; additionally have the share GET refuse when the owning member is `processingSuspended`/`closing`/`closed`. |
| **A-1** | Medium | AuthN / MFA bypass / least-privilege | `lib/auth.ts:63-67,119-130,152-176`; `lib/admin-mfa.ts:414-419`; `lib/env.ts:53-64` | The single shared `ADMIN_PASSWORD` grants an OWNER session via the password-only login. When no enabled admin account matches `ADMIN_EMAIL`, it resolves to the synthetic `bootstrap-owner`, which is (a) MFA-exempt (`adminHasMfa` hardcodes `false` for it), and (b) exempt from the DB disabled/role revocation check (`SYNTHETIC_ADMIN_IDS`). Because `assertRequiredSecrets()` *requires* `ADMIN_PASSWORD` in prod, this MFA-exempt break-glass path cannot be turned off in production. Anyone who learns the shared secret gets full admin, sidestepping MFA and offboarding. Requires the secret (not a remote 0-click). | Once real admin accounts exist, allow prod to run without `ADMIN_PASSWORD` (drop it from `assertRequiredSecrets` or add an `ADMIN_BOOTSTRAP_DISABLED=true` gate); ensure `ADMIN_EMAIL` maps to a real, MFA-enrolled owner so the password path still challenges MFA; alert on any `adminId:"bootstrap-owner"` login in the access log; rotate the secret. |
| **I-1** | Medium | iOS data-at-rest / Art.9 | `Arcaevo/AppModel.swift:341-347`; `ArcaevoWatch/WatchModel.swift:230-240`; `ArcaevoKit/EngineModels.swift:207-226` | Subjective health check-ins (`feel`, `sick`, lifestyle tags) persisted to unencrypted UserDefaults (`arcaevo.feltCheckins.v1`). Exposed via unencrypted iTunes/Finder backup, jailbreak, or forensic extraction. | Store in the App-Group container file with `NSFileProtectionComplete` (or Keychain); exclude from backup; raise file-protection class. |
| **I-2** | Medium | iOS data-at-rest / PII | `Arcaevo/AppModel.swift:311`; `ArcaevoKit/AppState.swift:486,501,509` | DOB (`arcaevo.aboutYou.dob`) and `signupEmail` in plaintext UserDefaults. DOB + the check-in log raises re-identification risk. Same backup/forensic exposure as I-1. | Move DOB/email to protected storage (App-Group file with complete protection, or Keychain). |
| **I-3** | Medium (theoretical) | iOS transport | `ArcaevoKit/APIClient.swift:80-85` (no `URLSessionDelegate`) | No certificate/public-key pinning. A device with an attacker-installed/enterprise root CA (or a mis-issued CA cert) can MITM `/api/v1`, capturing the bearer token and all biomarker/insight responses. ATS enforces valid TLS but not pin identity. | Add SPKI pinning for `arcaevo.com` via a `URLSessionDelegate` challenge handler, with a backup pin for rotation. Defense-in-depth. |
| **W-2** | Low | Data exposure / enumeration | `api/v1/waitlist/route.ts:83-108` | `GET /api/v1/waitlist?email=<any>` is unauthenticated and confirms whether an arbitrary email is on the waitlist, plus their county + join date. Contrasts with the deliberately non-revealing auth flows. Enables membership/PII enumeration. | Require member auth (drop the `?email=` bypass), or return non-committal output for the unauthenticated case; at minimum rate-limit it. |
| **W-3** | Low | Weak secret entropy / brute force | `api/v1/gift/route.ts:17-32`; `api/v1/gift/redeem/route.ts` | Gift codes derive from a 32-bit FNV-1a hash (`h`), so the effective code space is ≤ ~2^32 regardless of the 8-char rendering; `gift/redeem` has member auth but **no IP rate limit**. A determined authenticated attacker could grind for unredeemed €329 codes to activate on their own account. Impractical at 2^31 seed entropy but not defense-grade. | Generate gift codes from `randomBytes` (≥ 80 bits) instead of a 32-bit hash; add `limitByIp` to `gift/redeem`. |
| **I-4** | Low | iOS ATS | `apps/ios/project.yml:115-116` | The Watch target ships a single shared `Info.plist` with `NSAllowsLocalNetworking: true` in **Release** (the iOS app correctly splits Debug/Release). Relaxes ATS for loopback/`*.local` in production. Benign (Release base URL is HTTPS `arcaevo.com`, not local) but unnecessary. | Give the watch target per-config Info.plists; drop `NSAllowsLocalNetworking` from the Release watch plist. |
| **W-4** | Low | Integrity / availability | `lib/consents.ts:55-57`; `api/v1/admin/support/route.ts:45-48`; `api/v1/waitlist/route.ts:57-60`; `api/v1/account/delete/route.ts:76-78` | Several non-security ids are generated as `${prefix}_${countDocuments()+1}`. Two concurrent writes compute the same count → duplicate `_id` → the second insert throws (500). Not a confidentiality issue; the security-sensitive ids already use collision-free `newId()`. | Use `newId()` (or an atomic counter) for these collections too. |
| **C-1** | Low | Infra / S3 (GDPR export bucket) | `infra/cdk/lib/arcaevo-stack.ts:20-34` | Exports bucket is otherwise well-configured (BLOCK_ALL, SSE-S3, enforceSSL, 30-day expiry, RETAIN). Gaps: versioning off (no overwrite/ransomware recovery), no S3 server-access / CloudTrail data-event logging (downloads of a member's health export aren't auditable at the infra layer), SSE-S3 rather than a KMS CMK (no key-level revocation/audit for Art.9 data). | Enable versioning + noncurrent-version expiry; add access logging / S3 data events; consider a customer-managed KMS key for Art.9 exports. |
| **C-2** | Low | Infra / secret handling | `infra/cdk/lib/arcaevo-email-stack.ts:93,104`; `infra/cdk/scripts/ses-smtp-password.mjs:16-17` | SES IAM user uses a long-lived static access key with no rotation. The secret key is materialized into the CloudFormation template via `secretStringValue` (better than a CfnOutput, but readable by anyone with `cloudformation:GetTemplate`). The password-derivation script's documented usage passes the IAM secret as an argv (shell history / process-table leak on the operator host). | Rotate SES keys periodically; generate the SES credential out-of-band and write it straight to Secrets Manager; read the script input from stdin/env, not argv. |
| **I-5** | Info | iOS code hygiene | `ArcaevoKit/APIClient.swift:70`; `ArcaevoKit/DemoDataV2.swift:16` | Demo token literals (`demo-member-token`, `demo-watch-session-token`) are un-`#if DEBUG`'d `static let`s, so the strings ship in the Release binary. Unreachable at runtime (all call sites are gated by compile-time-`false` `DemoMode.isEnabled`), and the token authenticates nothing on prod (server gate `demoTokenEnabled()` is off). No exploit. | Wrap the constants in `#if DEBUG` to strip them from Release. |
| **W-5** | Info | Log hygiene / PII | `lib/vendors/email.mock.ts:39-41` | The mock email vendor `console.log`s the recipient email + template + subject on every send. No health values (subjects are value-free by design), but recipient email is PII in stdout logs. Mock-only; a real ESP swap should drop the log. | Remove or DEBUG-gate the console echo before production; never log recipient addresses. |

---

## Per-route AuthZ matrix

Legend — IDOR-safe = the handler scopes every member-data query to the authenticated principal (or is admin-only / public-by-design).

### Member routes (bearer session/demo token or `arcaevo_member_session` cookie)
| Route | Method | Guard | Who can access | IDOR-safe? |
|---|---|---|---|---|
| `/members/me` | GET | `requireMember` | authed member | ✅ uses `auth.member._id` |
| `/results` | GET | `requireConsentedMember` | consented member | ✅ `memberId: auth.member._id` |
| `/insights` | GET | `requireConsentedMember` | consented member | ✅ `memberId: auth.member._id` |
| `/orders` | GET/POST | `requireConsentedMember` (POST also `clinicianReview`) | consented member | ✅ `memberId: auth.member._id` |
| `/orders/[id]` | GET | `requireConsentedMember` | consented member | ✅ `findOne({_id:id, memberId: auth.member._id})` |
| `/sync/wearables` | POST | `requireConsentedMember` | consented member | ✅ ids built from `auth.member._id` |
| `/uploads/bloodwork` | POST | `requireConsentedMember` | consented member | ✅ `memberId: auth.member._id` |
| `/uploads/bloodwork/confirm` | POST | `requireConsentedMember` | consented member | ✅ `findOne({_id, memberId: auth.member._id})` |
| `/share` | GET/POST | `requireConsentedMember` | consented member | ✅ `userId: auth.member._id` |
| `/share/[token]` | DELETE | `requireMember` | authed member | ✅ ownership check `link.userId !== auth.member._id → 404` |
| `/consents` | GET/POST | `requireMember` | authed member | ✅ `auth.member._id` |
| `/account/delete` | POST | `requireMember` | authed member | ✅ acts on self |
| `/account/portal` | POST | `requireMember` | authed member | ✅ acts on self |
| `/auth/sessions` | GET | `requireMember` | authed member | ✅ own sessions |
| `/auth/sessions/[id]/revoke` | POST | `requireMember` | authed member | ✅ `deleteOne({_id:id, userId: auth.member._id})` |
| `/auth/watch-session` | POST | `requireMember` | authed member | ✅ mints session for self only |
| `/auth/watch-session/revoke` | POST | `requireMember` | authed member | ✅ own watch sessions |
| `/gift/redeem` | POST | `requireMember` | authed member | ✅ activates onto self; see W-3 |

### Public / unauthenticated by design
| Route | Method | Guard | Notes |
|---|---|---|---|
| `/share/[token]` | GET | none (public token) | **By design** GP link; 72-bit token, logged, expiring, revocable. See **W-1** (post-withdrawal gap). |
| `/auth/demo` | POST | none | Returns the demo token string; token only *works* if `demoTokenEnabled()` (prod-off). Harmless. |
| `/auth/magic-link` | POST | `limitByIp` (REQUEST) | Non-revealing; per-email resend throttle. |
| `/auth/magic-link/verify` | POST | `limitByIp` (VERIFY) | Opens session; 5-attempt code ceiling + single-use burn. No fixation. |
| `/auth/signin` | POST | `limitByIp` (SIGNIN) | Generic 401 + per-account cool-off. |
| `/auth/signup` | POST | (rate-limited flow) | — |
| `/auth/reset`, `/auth/reset/confirm` | POST | token-gated | Reset consumes single-use magic link; revokes all other sessions. |
| `/auth/session/refresh`, `/auth/signout` | POST | token-in-body/cookie | Slides/deletes own session. |
| `/checkout` | POST | none (server-side price/eligibility enforced) | Prices/eligibility never trusted from client. |
| `/gift` | POST | none | Creates gift + Stripe session; see W-3 entropy. |
| `/eligibility/check` | POST | none | Eircode routing-key lookup only. |
| `/waitlist` | POST/GET | none | **W-2**: GET is an email-enumeration surface. |
| `/webhooks/stripe` | POST | real Stripe sig OR shared-secret gate | Signature over raw body, 5-min replay window, idempotency ledger. |
| `/webhooks/letsgetchecked` | POST | `verifyWebhookSecret` (fail-closed in prod) | Mock signing; shared-secret gate. |
| `/cron/run-erasure` | GET/POST | `cronRequestAuthorized` (fail-closed in prod) | Bearer `CRON_SECRET`. Returns counts + ids only, no health values. |

### Admin routes (`arcaevo_admin_session` HMAC cookie; role from live DB)
| Route | Method | Guard | Role |
|---|---|---|---|
| `/admin/login` | POST | `limitByIp` | issues session or MFA challenge |
| `/admin/login/mfa` | POST | `limitByIp` | second factor → session |
| `/admin/logout` | POST | clears cookie | any |
| `/admin/members` | GET | `requireAdmin` | any role; access-logged |
| `/admin/members/[id]` | GET | `requireAdmin` | any role; access-logged (Art.9 read) |
| `/admin/results` | GET | `requireAdmin` | any role; access-logged |
| `/admin/results/[id]/review` | POST | `requireAdminRole("clinician","owner")` | clinician/owner (ops 403) |
| `/admin/support` | GET/POST | `requireAdmin` | any role |
| `/admin/kpis` | GET | `requireAdmin` | any role |
| `/admin/eligibility` | GET/POST | `requireAdmin` | any role |
| `/admin/access-log` | GET | `requireAdminRole("owner")` | owner only |
| `/admin/admins` | GET/POST | `requireAdminRole("owner")` | owner only |
| `/admin/admins/[id]/disable|enable|role` | POST | `requireAdminRole("owner")` | owner only; last-owner guard |
| `/admin/mfa/setup|enable|disable` | POST | `requireAdmin` + `currentAdmin` (self) | any role, acts on self |

**Every route under `src/app/api/v1` was enumerated and confirmed to carry a guard** (member, consented-member, admin, role, webhook-secret, cron-secret, or intentionally-public). No unguarded data route was found.

---

## Confirmed-safe (verified correct)

**Authentication**
- Member sessions are opaque 256-bit random tokens; only the SHA-256 hash is stored (`member-auth.ts:362-385`). Individually revocable (delete the row), TTL-expiring, `lastSeen` touched. No signed-stateless-cookie forgery surface.
- Passwords: scrypt (N=16384,r=8,p=1), per-password 16-byte salt, constant-time compare (`member-auth.ts:59-84`). Sign-in is non-revealing (unknown email / no-password / wrong password all return the same 401) with a 5-fail/15-min account cool-off *plus* an IP rate limit (`auth/signin/route.ts`).
- Magic links: single-use, atomic burn (`findOneAndUpdate({usedAt:null})`), 30-min TTL, only the hash stored, 60s resend throttle; the human-code fallback is email-scoped, timing-safe-compared, unbiased 32-char alphabet, with a 5-wrong-attempt burn (`member-auth.ts:245-326`).
- Admin session cookie is HMAC-SHA256 signed; `SESSION_SECRET` **fails closed in production** (`env.ts:25-36`) so a forged admin cookie is impossible without the secret. `currentAdmin()` re-loads the DB record and rejects missing/`disabledAt` accounts and trusts the live DB role — so disable and role-downgrade revoke live sessions immediately (`auth.ts:165-176`).
- Admin MFA: RFC-6238 TOTP (±1 window, constant-time), secret sealed at rest with AES-256-GCM under a dedicated `MFA_ENC_KEY` that **fails closed in production** (`admin-mfa.ts:216-230`); single-use backup codes stored only as hashes; the `mfa-pending` step token carries no role and can never stand in for a session (`admin-mfa.ts:356-398`, verified `readAdminSession` rejects it). Login is non-revealing and rate-limited; codes are never logged.

**Authorization / IDOR**
- No member route trusts a client-supplied member id; all are scoped to `auth.member._id`. The two `[id]` member routes (`orders/[id]`, `uploads/.../confirm`, `sessions/[id]/revoke`, `share/[token]` DELETE) all add an ownership predicate to the query.
- Admin `members/[id]` (which returns Art.9 readings) is admin-guarded and access-logged with `targetMemberId` (DPIA R4).
- The consent guard (`consent-guard.ts`) composes member auth with a live Art.9 consent check and a hard stop on `processingSuspended`/`closing`/`closed`, applied to every health-data read/write route. (Its one blind spot is the public share route — **W-1**.)

**Injection**
- All request bodies are Zod-validated to primitive-typed schemas before reaching Mongo, so operator-object NoSQL injection (`{$gt:...}`) cannot smuggle through string fields. Path/query params (`share/[token]`, `waitlist?email`) are always strings from the framework, used only in equality filters. No dynamic query string construction; no `$where`/eval. No file bytes are handled (uploads are metadata-only mock), so no path traversal. Outbound fetch targets are hardcoded hosts (PostHog EU, SMTP config) — no user-controlled SSRF sink.

**Webhooks**
- Stripe: real signature verification over the **raw** body, HMAC-SHA256, 5-minute replay tolerance, multi-`v1` support for secret rotation, constant-time compare (`stripe-signature.ts`). `invoice.paid`/`invoice.payment_failed` are idempotency-ledgered (`processed_webhook_events`, atomic `$setOnInsert`) so at-least-once redelivery can't hand free renewal years. `checkout.session.completed` defers activation while `payment_status:"unpaid"`.
- Both webhook gates fail closed in production when a secret is configured; the dev-open path requires non-prod or the explicit `ALLOW_OPEN_WEBHOOKS=true` local opt-in (`env.ts:91-104`).

**Secrets / config**
- `SESSION_SECRET`, `ADMIN_PASSWORD` asserted at boot in prod (`instrumentation.ts` → `assertRequiredSecrets`); `MFA_ENC_KEY`, `CRON_SECRET`, webhook secrets all fail closed in prod. Demo token, mock AI extraction, and open webhooks are all prod-off unless explicitly opted in. No hardcoded app secrets; no secret is returned in any API response (the admin projection `publicAdmin` is built explicitly and never includes `passwordHash`, MFA secret, or backup hashes).

**Health-data invariants**
- Results are **never** placed in email or push: email templates are typed so E7 (results-ready) *cannot* carry a value (`emails.ts:118,263-273`); order/results/closure emails contain only invitations/dates. The erasure and cron responses return counts + ids only. No health value appears in any log (web has only two `console.log`s, both value-free; iOS logs nothing at all — grep-confirmed). Analytics is stubbed off by default and hardcoded to the EU host.

**Session/cookie**
- Member + admin + mfa-pending cookies are all `httpOnly`, `sameSite:"lax"`, `secure` in production, scoped `path:"/"` with sane `maxAge`. Password reset and consent withdrawal revoke sessions server-side. Fresh session minted on each successful auth (no fixation).

**iOS / watch**
- Tokens are Keychain-stored with `kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly` (no iCloud/backup migration) — never UserDefaults (`KeychainHelper.swift:24`, `WatchSessionStore.swift`). Release ATS fully enforced (no `NSAppTransportSecurity` block, no `NSAllowsArbitraryLoads` anywhere). Prod base URL is HTTPS. Demo token is compile-time-`false`-gated in Release. The watch handoff mints a *separate*, server-side, independently-revocable watch session and transfers it over Apple-encrypted `WCSession` application context into the watch Keychain — never a copy of the phone token, never UserDefaults. Raw biomarker values are kept in memory only.

**Infra (CDK)**
- Exports bucket: BLOCK_ALL public access, SSE-S3 encryption, `enforceSSL:true`, 30-day lifecycle expiry, `RETAIN` with no `autoDeleteObjects`. SES IAM user is genuinely least-privilege: `ses:SendEmail`/`SendRawEmail` only, scoped to the one domain identity ARN, with a `ses:FromAddress` condition. No wildcard/admin grants, no account IDs or credentials hardcoded, no secret in any `CfnOutput` (only ARNs/username-id output).

---

## SOC2-relevant control gaps (flagged for the SOC2 workstream)

- **Access logging:** admin reads of member records are audit-logged (`logAdminAccess`, DPIA R4) — good. Gaps: (a) infra-level S3 access logging for GDPR exports is absent (C-1); (b) public GP-share opens are logged to the member but not to a central security log; (c) the mock email vendor logs recipient PII to stdout (W-5).
- **Least privilege:** the mandatory MFA-exempt bootstrap owner (A-1) is the main principle-of-least-privilege / change-management gap — a shared credential that bypasses per-admin accountability and MFA.
- **Encryption:** at rest (Atlas — external to this repo, must be confirmed encrypted-at-rest separately; S3 SSE-S3; MFA secret AES-GCM) and in transit (enforced TLS, ATS) are in place. Consider a KMS CMK for Art.9 exports for key-level revocation/audit (C-1).
- **Change management / key rotation:** static SES key with no rotation (C-2); `ADMIN_PASSWORD`/`SESSION_SECRET` rotation procedures should be documented.
- **Backups/retention:** exports bucket versioning is off (C-1); confirm Atlas backup encryption + retention aligns with the 30-day erasure promise (a backup could outlive an erasure — verify erasure covers backups, per the E12 email's claim).

---

## Method / coverage note

All 52 `api/v1` route handlers were enumerated and each guard confirmed by reading the handler (member-data routes read in full for IDOR). Core libs read in full: `auth.ts`, `member-auth.ts`, `admin-auth.ts`, `admin-mfa.ts`, `consent-guard.ts`, `consents.ts`, `env.ts`, `db.ts`, `rate-limit.ts`, `stripe-signature.ts`, `erasure.ts`, `analytics.ts`, `email.mock.ts`, `instrumentation.ts`. iOS/watch and CDK were audited by dedicated read-only sub-audits (Keychain/ATS/logging/pinning/handoff; S3/IAM/secrets/removal-policy). No code was modified. Findings are marked **Confirmed** where read directly and **theoretical** where the risk depends on a precondition (e.g. I-3 requires an attacker-controlled CA). Dependencies were not `npm audit`-scanned per scope; no obviously risky third-party call pattern was observed (crypto is all `node:crypto`; Stripe verification is hand-rolled and correct).
