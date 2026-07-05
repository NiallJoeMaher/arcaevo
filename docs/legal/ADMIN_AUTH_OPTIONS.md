# Admin Authentication — Options & Recommendation (decision doc)

> **DRAFT — prepared for review by a Data Protection Officer / solicitor before reliance. Not legal advice.**
>
> This is a **decision document**, not a legal instrument. It lays out the options for replacing the current admin authentication so the founder can make the call. Replacing it is a **top-5 security/GDPR gap** (`docs/LAUNCH_READINESS.md` Top-5 #5; `docs/MOCKED_APIS.md` §3) that must be closed before real members' data exists.

> **STATUS (implemented):** **Option A is shipped** — self-hosted per-admin accounts (`admins` collection, scrypt reusing `member-auth.ts`), `owner`/`ops`/`clinician` roles, a role gate on clinician sign-off, an `admin_access_log` (DPIA R4) written on every admin access to member Art.9 data, and IP rate-limiting on admin login. The single `ADMIN_PASSWORD` is retained only as a **bootstrap owner** credential. An **owner-only management UI** now ships too: `/admin/admins` (add/enable/disable/re-role admins, with self- and last-owner-lockout guards) and `/admin/access-log` (audit viewer) — no direct Mongo edits. **TOTP MFA is now implemented (opt-in per admin, default OFF):** `src/lib/admin-mfa.ts` (RFC 6238, node:crypto only), self-service enrol/disable at `/admin/security`, the TOTP secret **sealed at rest with AES-256-GCM** under a dedicated `MFA_ENC_KEY` (fail-closed in prod), 8 single-use backup codes, and a two-step login (password → signed short-lived `mfa-pending` token → second factor → session). **Still open on Option A:** self-service password reset, and the **MFA enforcement/recovery policy** (mandatory-for-owners, owner-driven reset of a locked-out admin, and the disable owner-override are founder decisions — see below). **Option B (managed EU IdP) remains open** as the medium-term move. See `docs/MOCKED_APIS.md` §3 for the concrete surface.

## The problem, precisely

Admin authentication today is a **single shared password**:
- `verifyAdminPassword` compares a submitted password against one `ADMIN_PASSWORD` env value (`apps/web/src/lib/auth.ts`). Success mints a 12-hour HMAC-signed cookie carrying only `{role:"admin"}` (`createAdminSessionValue`).
- **No per-user accounts, no roles, no audit log, no rate limiting** on the admin login.
- The one admin identity can read **every** member's Article 9 health data through `/admin` (members, results, consent-audit, support tabs — `BUILD_STATE.md` Phases 6/13).

Fail-closed secret handling is done well (`env.ts` refuses to boot in production without `SESSION_SECRET`/`ADMIN_PASSWORD`, so the cookie can't be forged with a default secret). But that only protects the *signing* — it does nothing about the fact that **one shared credential unlocks all special-category data with no accountability**.

### Why this matters for GDPR
- **Art. 5(1)(f) / Art. 32** — access to special-category data must be restricted to those who need it, on a least-privilege basis, with the ability to demonstrate who accessed what.
- **Art. 30 / breach forensics** — with no audit log, a breach via the shared password is **very hard to reconstruct** (`BREACH_RESPONSE.md` §5). You could not tell the DPC whose data was accessed or by whom.
- **Shared credentials** defeat accountability, revocation of a single leaver, and MFA per individual.

## Requirements for the replacement
1. **Per-user admin accounts** (unique identity per staff member / clinician).
2. **Roles** — at least *ops* vs *clinician* (clinician-review needs different, narrower access than billing/support).
3. **Audit log** — who accessed / changed which member record, when (retained; feeds breach forensics).
4. **MFA** on admin accounts.
5. **Easy revocation** of a single account (offboarding a leaver without rotating a shared secret).
6. **Least privilege** — scope access to the records actually being worked on where feasible.

---

## Option A — Self-hosted: per-user accounts + roles + audit log — **IMPLEMENTED**

Build admin identity into the existing stack: an admin accounts collection (email, per-user password hash — reuse the existing scrypt in `member-auth.ts` — role, active flag, MFA secret), replace the shared-password check, add a middleware-enforced role check, and write an audit record on every access to member data.

**As shipped:** the collection is **`admins`** (`email, passwordHash, role ∈ {owner,ops,clinician}, name?, createdAt, disabledAt?`); the session cookie carries `{adminId, role}`; `requireAdminRole()` gates clinician sign-off to `clinician|owner`; the audit collection is **`admin_access_log`** (`logAdminAccess()`, fire-and-forget, no health values); admin login is IP rate-limited. `ADMIN_PASSWORD` survives only as a bootstrap-owner credential.

**Owner-only management UI (shipped):** the **leaver-offboarding UI now exists** — an OWNER manages admins and reads the audit log from the panel without editing Mongo. `/admin/admins` lists accounts and provides an add-admin form + enable/disable + role-change; `/admin/access-log` renders the `admin_access_log` (who/what/when/target/outcome/ip, newest first). Both pages and every mutating route are **owner-gated** (`requireAdminRole("owner")`); disabling an admin revokes their live session immediately (`currentAdmin` rejects a disabled record). Two server-authoritative **lockout guards** prevent an owner disabling/demoting **themselves** or the **last enabled owner**. Responses go through `publicAdmin()`, which never emits `passwordHash`. **Still not built (Option A remainder): MFA/TOTP + self-service password reset/rotation** (an owner sets a temp password today).

| Pros | Cons |
|---|---|
| No new vendor, no new DPA, no data leaves the stack | You build + maintain MFA (TOTP), password reset, lockout, session management |
| Full control over the audit schema (tailored to Art. 9 access logging) | More code to get right on a security-critical surface (the exact area you're trying to harden) |
| Cheap; reuses proven crypto already in the repo | Slower to reach "enterprise-grade" (SSO, SCIM, anomaly detection) |
| Keeps the EU-only, minimal-processor posture clean | You own the incident risk for the admin IdP itself |

**Effort:** medium. **Good fit** if the admin team stays small (founder + a clinician + an ops person) for the foreseeable future.

## Option B — Real IdP (WorkOS / Auth0 / Amazon Cognito)

Delegate admin identity to a managed identity provider; the app trusts the IdP's tokens and enforces roles locally; keep a local audit log of data access regardless of the IdP.

| Pros | Cons |
|---|---|
| MFA, SSO, password policies, lockout, anomaly detection out of the box | **New sub-processor → new DPA + region check** (`SUBPROCESSORS.md`); another party in the trust chain |
| Faster to a mature posture; less security-critical code you own | Cost + integration work; some lock-in |
| Scales cleanly as the team grows (roles, SCIM, org management) | Must confirm **EU data region** (WorkOS/Auth0/Cognito all offer EU); admin PII leaves your stack |
| Offloads the IdP breach surface to a specialist | Audit-of-data-access still has to be built locally (the IdP logs *auth*, not which member record was opened) |

**Notes per vendor:**
- **WorkOS** — enterprise SSO/Directory focus; clean if you later sell B2B/corporate wellness; EU data residency available.
- **Auth0 (Okta)** — mature, flexible RBAC; confirm EU tenant region; pricing scales with MAU.
- **Amazon Cognito** — cheapest, sits naturally next to the CDK/AWS escape hatch (`infra/cdk`, eu-west-1); rougher DX, RBAC is more manual.

**Effort:** medium (integration) but less ongoing maintenance.

---

## Recommendation

**Short term (before the first real user): Option A, minimal.** Ship the smallest honest version — per-user admin accounts (scrypt, reusing `member-auth.ts`), an *ops* vs *clinician* role check on the `(panel)` admin routes, an `admin_audit` write on every read/write of member Art. 9 data, and TOTP MFA. This directly removes the shared-credential and no-accountability problems, adds no new sub-processor/DPA, and keeps the EU-only posture — matching where the product actually is (tiny admin team, closed beta).

**Medium term (as the team / paid tiers grow): move to Option B, EU-region.** When you add a real clinician, medical-ops, and support staff — and especially before corporate/B2B — a managed IdP (Cognito if you lean into the AWS path, WorkOS if B2B SSO becomes a selling point) is worth the DPA. **Keep the local data-access audit log either way** — no IdP records *which member record was opened*, and that log is what you need for Art. 32 accountability and breach forensics.

**Non-negotiable regardless of option:** the **per-record access audit log** is the single most important addition — it is what turns "someone with the shared password could see everything" into "we can prove who accessed what." Prioritise it even ahead of MFA if you must sequence.

## Open items for the founder / DPO
1. Choose **Option A now** (recommended) or jump straight to **Option B**.
2. Define the **role matrix** (ops vs clinician: who sees billing, health results, consent audit, support).
3. Specify the **audit-log schema + retention** and where it is stored (survives an incident).
4. ~~Add **MFA**~~ (TOTP MFA shipped, opt-in) and a **leaver-offboarding** procedure. **Open MFA policy calls for the founder/DPO:** (a) make MFA **mandatory** (at least for `owner`, ideally all admins) rather than opt-in; (b) define a **recovery path** for a locked-out admin (owner-driven MFA reset) and whether the current **owner-override on disable** stays; (c) `MFA_ENC_KEY` custody + rotation (rotating it invalidates enrolled TOTP secrets — admins re-enrol, backup codes still work); (d) whether backup-code exhaustion should force re-enrolment.
5. Confirm **EU region** if a managed IdP is chosen (new DPA — `SUBPROCESSORS.md`).
