# Prompt for Claude Code — Arcaevo build package v2

Paste this alongside the `arcaevo_design_handoff/` folder.

---

You are implementing **Arcaevo**, a personalised health platform for Ireland (blood tests + Apple Watch fusion, Dublin-first launch). The `designs/` folder contains high-fidelity HTML design references — open any `.dc.html` in a browser with `support.js` beside it. **They are references, not production code**: recreate them pixel-faithfully in the target stack.

Read `README.md` first — it contains the full design-token table, the updated sitemap, every business rule (auth, Eircode eligibility, consent, dunning, critical-value SOP), and a changelog against the previous marketing-site handoff.

## Scope of this package (v2)
1. **Marketing site** (unchanged from v1): Next.js App Router, routes per README §1b. Pricing CTAs now route to `/join` and `/checkout` — not Contact.
2. **Product web app** (new): `/join`, `/signin`, `/verify`, `/consent`, `/checkout` (3 steps), `/early-access`, `/welcome`, `/book`, `/gift`, `/redeem`, `/s/[token]`, `/account/*`. Reference: `designs/AccountFlows.dc.html` §03–§10, §15–§17.
3. **iOS app** (new): SwiftUI, 33 screens mapped in `designs/Prototype.dc.html` — open it and click through; the left rail jumps to any screen. Payment always links out to web checkout (no IAP).
4. **Transactional emails** (new): 11 templates, one layout — `AccountFlows.dc.html` §12 + §14.
5. **Admin additions** (new): waitlist demand, Eircode config, consent audit — §18.

## Non-negotiable rules encoded in the designs
- Email + magic-link auth only at launch; no social sign-in; no Sign in with Apple until later (README explains the App Review 4.8 rationale). HealthKit is a device permission, independent of auth.
- Eircode gate runs only at checkout for Essential/Performance; routing-key allowlist is **configuration**; fail → waitlist + Fusion cross-sell.
- GDPR Art. 9 consent: separate screen, 3 purposes, research off by default, versioned grants, revocable in Account.
- Results never in email. Critical values: clinician phones first; never a red number in a push.
- Dunning: retries day 3/10, read-only pause day 14, nothing deleted by lapse.
- Renewal email: cancel gets equal visual weight.
- Uploaded bloodwork: user confirms every AI-extracted value; low-confidence reads block until resolved; self-reported points stay visually distinct (hollow gold dots).
- Wellness positioning, never diagnosis. AI is called "AI" and only narrates; deterministic rules decide.

## Stack
- Web: Next.js (App Router) + React, Stripe (annual subscriptions + Apple Pay on web), EU data residency (eu-west-1).
- iOS: SwiftUI, HealthKit (read-only), universal links for magic links.
- Entities: User, Consent (purpose, version, timestamp, surface), Membership, TestOrder (status timeline), BiomarkerReading (source: lab | self_reported), BiomarkerRule, WearableSignal, Experiment (adherence from HealthKit), WaitlistEntry (routing key, county), GiftCode, ReferralCode, ShareLink (expiry, revoked, access log).
