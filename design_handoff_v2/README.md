# Arcaevo — Design Handoff

Personalised health platform for Ireland: blood testing + Apple Watch fusion, launching Dublin-first.
This package contains every design produced to date: the full marketing site, the complete accounts/auth/commerce flow specification, and a 33-screen clickable prototype of the iOS app.

Every `.dc.html` file opens directly in a browser (keep `support.js` beside them). All styling is inline — every hex value, radius and spacing is readable in the markup. These are design references, not production code — recreate them in the target codebase (spec: Next.js App Router for web, SwiftUI for iOS).

---

## 0. What's new since the last handoff

The previous handoff (`design_handoff_arcaevo_site`) covered the marketing site + admin skeleton only. **New in this package:**

1. **`AccountFlows.dc.html` — the accounts & access spec (entirely new).** 19 sections covering everything between a stranger and a member:
   - §01–02 Auth strategy decisions + full flow map
   - §03 Web sign-up/sign-in (email + magic link, **no social sign-in at launch** — see rationale) + 4 designed edge states
   - §04 GDPR Art. 9 consent gate (3 purposes, versioned, revocable)
   - §05 Free tier — two variants, **Fusion-lite recommended** (real Watch data + one locked card)
   - §06 **Eircode eligibility gate** + early-access waitlist (launch allowlist included)
   - §07 3-step web checkout (Stripe + Apple Pay on web; app links out, no IAP)
   - §08 Kit activation, nurse booking, sample-journey tracker
   - §09 iOS onboarding (6 screens incl. HealthKit primer-before-sheet pattern)
   - §10 Account surface + honest delete-account flow
   - §11 Gap audit with priorities
   - §12 **All 11 transactional emails, fully designed**
   - §13 Bloodwork upload: photo/PDF → AI extraction → user confirms every value
   - §14 Failure states: critical-value escalation (clinician phones first), dunning → read-only pause, failed-sample auto-replacement, in-context support, waitlist nurture
   - §15 GP share (revocable link + the page the GP sees)
   - §16 Referrals + gifting
   - §17 Security roadmap (passkeys, TOTP, sessions; Sign in with Apple deferred)
   - §18 Admin ops: waitlist demand, Eircode config, consent audit
   - §19 Household / corporate / non-Apple wearables
2. **`Prototype.dc.html` — 33-screen clickable iOS prototype (entirely new).** Full journey from first open to member app core (dashboard, results, ApoB marker detail, insights, experiments, "did it work?" verdict) with working tab bar and 15+ interactive states.
3. **Pricing page updated:** plan CTAs now route into the checkout flow (Fusion → sign-up, Essential/Performance → Eircode check) with eligibility hint lines under the buttons. Previously they pointed at Contact.
4. **Copy change everywhere: the AI is called "AI"** — vendor names removed from Science and product-story pages.
5. Business rules newly locked (full detail in §3 below): Eircode allowlist as config, magic-link expiry/throttle, dunning timeline (0/3/10/14 days → pause, never delete), consent versioning, critical-value SOP, founding-member waitlist pricing, refund-until-ship.

**Unchanged since last handoff:** marketing page layouts, design tokens, tier pricing, SEO/AEO plan, admin skeleton. The previous README's guidance still applies to those files.

---

## 1. Package contents

| File | What it is |
|---|---|
| `designs/AccountFlows.dc.html` | **The flow spec.** 19 numbered sections: every screen, email, edge state and business rule for auth → eligibility → checkout → account. Start here. |
| `designs/Prototype.dc.html` | **Clickable prototype.** 33 iOS screens in 7 groups, fully joinable end-to-end. Left rail jumps to any screen. |
| `designs/Home / HowItWorks / Science / Pricing / Compare / Versus / About / Blog / Article / Careers / Contact / Help / Legal` | Marketing site pages. `SiteNav` + `SiteFooter` are shared components imported by each page. |
| `designs/App.dc.html` | App marketing page (product story). |
| `designs/Admin.dc.html` | Internal admin console concept. |
| `designs/Solas.dc.html`, `designs/Arcaevo.dc.html` | Earlier product/brand exploration documents. |
| `designs/Handover.dc.html` | Prior engineering handover notes for the site. |

---

## 1b. Sitemap — updated

### Web (arcaevo.com)
```
/                        Home                              (unchanged)
/pricing                 Pricing — CTAs now → /join or /checkout   ★ updated
/how-it-works            How it works                      (unchanged)
/science                 Science — "AI" copy               ★ updated
/app                     App tour — "AI" copy              ★ updated
/compare, /compare/[x]   Comparisons                       (unchanged)
/blog, /blog/[slug]      Blog                              (unchanged)
/about /careers /contact /help /legal/[doc]                (unchanged)

NEW — product web app:
/join                    Create account (W1)
/signin                  Sign in — password or magic link (W3)
/verify                  Check-your-inbox (W2; shared with magic link)
/consent                 Health-data consent gate (W4)
/checkout                3 steps: eligibility (W5) → details (W7) → payment (W8)
/early-access            Outside-Dublin waitlist (W6)
/welcome                 Post-purchase success (W9)
/book                    Nurse booking — Performance (A2)
/gift                    Gift Essential (R2)
/redeem                  Gift & corporate code redemption
/s/[token]               GP share page — public, read-only, revocable (G2)
/account                 Membership & billing (W10)
/account/security        Passkeys, password, 2FA, sessions (W12)
/account/privacy         Consents, export, GP links, delete (W11)

NEW — admin additions:
/admin/waitlist          Demand by county (ADM-1)
/admin/eligibility       Eircode allowlist config (ADM-2)
/admin/consent           Consent audit log (ADM-3)
```

### iOS app (33 prototype screens, 7 groups)
```
ONBOARDING   welcome · signup · verify · consent · healthkit · about-you · notifications
FREE TIER    home (Fusion-lite) · plans
PURCHASE     eircode gate · waitlist · checkout (links out to web) · success
TESTING      activate kit · nurse booking · sample journey · critical value
MEMBER APP   dashboard · results · marker detail · insights · experiments · verdict
             └ tab bar: Today / Results / Experiments / Account
YOUR DATA    upload bloodwork · confirm AI reading · timeline · GP share
ACCOUNT      hub · security · privacy · delete · invite · connections
```

### Emails (hello@arcaevo.com)
E1 verify · E2 magic link · E3 reset · E4 receipt · E5 kit shipped · E6 sample received · E7 results ready · E8 renewal (equal-weight cancel) · E9 payment failed · E10 waitlist joined · E11 county-open invite

---

## 2. Design tokens

### Color
| Token | Hex | Use |
|---|---|---|
| Ink | `#1C2620` | Primary text, dark surfaces (app screens, feature cards) |
| Deep green | `#1E5C45` | Primary actions, links, brand accents, section numbers |
| Signal green | `#34A07C` | Positive states, toggles-on, chart lines, "in range" |
| Mint | `#7FD3AE` | Accents on dark surfaces, active states |
| Cream (page) | `#ECE7DD` | Page/screen background |
| Cream (card) | `#FBFAF6` | Card surfaces on light bg |
| Cream (light) | `#F4F1EA` | Browser chrome bars, text on dark |
| Muted text | `#4A554D` (light bg) / `#9FB0A6`, `#8FA89A` (dark bg) | Body copy |
| Faint text | `#7C887F` (light) / `#5E6E64` (dark) | Captions, metadata |
| Amber | `#D99A4E` / `#E9BC85` | Warnings, "watch" states, waitlist |
| Rust | `#B3543A` | Destructive actions, "act" states. Never used in push notifications. |
| Hollow-dot gold | `#D9C9A4` | Self-reported (user-uploaded) data points in charts |

Brand orb: `radial-gradient(circle at 32% 30%, #5FB592, #1E5C45 70%)`, circular.

### Type
- **Instrument Serif** (400, italic) — display headlines only, tight leading (1.02–1.15), letter-spacing −0.01 to −0.015em
- **Hanken Grotesk** (300–800) — everything else
- **Geist Mono** (400/500) — eyebrows/labels (10–12px, letter-spacing 0.1–0.16em, uppercase), numbers, codes, data values
- Loaded from Google Fonts; see any file's `<helmet>`.

### Shape & elevation
- Cards 14–22px radius; buttons/chips fully rounded (`border-radius:100px`)
- Borders: `rgba(28,38,32,0.08–0.16)` on light; `rgba(255,255,255,0.08–0.25)` on dark
- Shadows only on floating artifacts (phones, browser mocks): `0 22px 44px -32px rgba(28,38,32,0.4)`
- Dark surfaces use `rgba(255,255,255,0.06)` inner cards

---

## 3. Product & business rules (as designed)

### Plans
- **Fusion €119/yr** — watch + user-uploaded bloodwork. No shipping → **sold worldwide, no eligibility check.**
- **Essential €329/yr** — 2 finger-prick tests/yr (full baseline + recheck), clinician-reviewed. Dublin only.
- **Performance €399/yr** — 1 venous panel, 80+ markers, nurse visit. Dublin only.
- Quarterly upgrade +€130/yr; single add-ons €99/€69/€199. Annual billing only at launch.

### Auth (launch)
- **Email + password (password optional) and email magic links. No social sign-in.**
- Rationale: Apple's App Review 4.8 only mandates Sign in with Apple when *third-party* logins are offered — email-only is exempt. Early users can't hide behind relay addresses.
- HealthKit sync is a **device permission, not an identity** — works fine with email accounts.
- Roadmap: passkeys + optional TOTP at +3 months (prompted after 3rd sign-in, never in onboarding); Sign in with Apple later, linked by verified email.
- Magic links: 30-minute expiry, single-use, universal links (open into the app). Resend throttled 60s.
- Account-exists and wrong-password responses never reveal whether an email is registered.
- 5 failed passwords → 15-minute cool-off. Password reset signs out all other sessions + confirmation email.

### Dublin eligibility (Eircode gate)
- Checked **only at checkout for Essential/Performance** (step 1 of 3). Fusion and free accounts are never gated.
- Only the **routing key** (first 3 chars) is validated; not stored until an order is placed.
- Launch allowlist: `D01–D18, D20, D22, D24, D6W, A94, A96, K32, K34, K36, K45, K56, K67, K78`.
- The list is **config, not code**. Rejected keys are logged (key only) to drive expansion.
- Fail state = early-access waitlist + Fusion cross-sell, never a dead end. Waitlist: position visible in Account, monthly updates, 30-day founding-member window (e.g. €279 year one) when a county opens.

### Consent (GDPR Art. 9(2)(a))
- Dedicated screen after email verification, on whichever surface is touched first — **never bundled with Terms**.
- Three purposes: health-data processing (required), clinician review (required for tests), anonymised research (optional, **off by default**).
- Each grant stored with timestamp + wording version + surface. Material changes trigger a re-consent screen on next sign-in.
- Withdrawal lives in Account → Data & privacy; withdrawing the required purpose starts account closure (with export offered first).

### Payment
- **All payment on the web (Stripe + Apple Pay on web).** iOS app links out — no IAP, no commission.
- Checkout: eligibility → details → payment. Signed-in users skip to step 2; guests create the account inline.
- DOB collected at checkout (lab requirement). Full refund until kit ships / draw is booked.
- Renewal reminder 30 days out with **equal-weight cancel button** (EU consumer rules).
- Dunning: fail day 0 → email + quiet banner (full access), retries day 3 + 10, day 14 → **read-only pause, nothing deleted, instant resume**. Deletion only ever by explicit request.

### Testing operations
- Kit activation binds tube QR/code → account + DOB (chain of custody).
- Nurse booking: morning slots, fasted; free reschedule to 24h; fasting reminder night before.
- Sample journey timeline: activated → posted → at lab → clinician review → results. Nothing silent >48h.
- Failed samples (haemolysed/insufficient/lost): user notified within 24h of lab flag, replacement auto-shipped free, doesn't count against allowance.
- **Critical values: clinician phones first** (named doctor, Dublin number, time window). App shows a calm "needs a word" state. Never a red number in a push. Unreachable after 3 attempts in 48h → registered letter + GP notice.

### Results & data
- Results **never appear in email** — only the invitation to open the app (Face ID lock on by default).
- Uploaded bloodwork (Fusion's engine): photo/PDF/manual → AI extraction → **user confirms every value**; low-confidence reads are flagged (e.g. "41 or 47?") and block until resolved. Units auto-converted, original preserved. Self-reported points render as hollow gold dots forever and are excluded from clinician-reviewed claims.
- GP share: revocable 30-day link (`arcaevo.com/s/…`), read-only clinician summary with reviewer's IMC number, PDF one tap away, access logged and shown to the user.
- Export: CSV + clinician PDF within the hour. Delete: type-DELETE confirm, no retention maze, 30-day erasure incl. lab partners, pro-rata refund of unused tests.

### Emails (all from hello@arcaevo.com, one template)
E1 Verify · E2 Magic link · E3 Password reset · E4 Receipt/welcome · E5 Kit shipped (An Post tracking) · E6 Sample received · E7 Results ready (no values) · E8 Renewal reminder · E9 Payment failed ("A small hiccup…") · E10 Waitlist joined · E11 County-open invite ("Cork, you're up").
Designs for all in `AccountFlows.dc.html` §12 and §14.

### Growth & later tiers (designed in §15–19)
- Referral: give a month / get a month, code `NAME-XX`, no leaderboards.
- Gifting: Essential year, email or printed card; year starts at activation; buyer never sees health data; outside-Dublin recipients choose Fusion+waitlist-priority or refund.
- Household €595/yr (Essential ×2): one bill, **sealed data**, sharing only by each person's revocable opt-in.
- Corporate: anonymous redemption codes; employer sees bought/used counts only.
- Wearables: Oura/WHOOP/Garmin via OAuth, one primary source per metric, disconnect keeps history — also the Android path (no HealthKit).

---

## 4. Prototype screen map (33 screens)

ONBOARDING: welcome → signup → verify → consent → healthkit → about → notify
FREE TIER: home (Fusion-lite: real Watch data + one locked card) → plans
PURCHASE: gate (D08 passes / T12 fails) → waitlist | checkout → success (CTA is plan-aware)
TESTING: activate → booking (Performance) → journey → critical
MEMBER APP: dashboard → results → marker (ApoB) → insights → experiments → verdict — with Today/Results/Experiments/Account tab bar
YOUR DATA: upload → confirmupload → timeline → gpshare
ACCOUNT: account hub → security → privacy → deleteacct → invite → connections

Interactive states worth testing: research-consent toggle, notification toggles, Eircode pass/fail, waitlist join, ferritin 41/47 resolution, GP link creation, passkey add, 2FA toggle, session ending, export request, type-DELETE arming, experiment picking, nurse slot picking.

---

## 5. Copy voice

- Plain, warm, unhurried. Serif headlines carry personality; body text stays factual.
- Refusals sell: every "no" comes with a reason, a promise, and an alternative.
- Honesty as a feature: "CRP didn't move", "your card said no — your data isn't going anywhere".
- "AI" — never a vendor name. AI narrates; the maths comes from rules against the user's own baseline.
- No streaks, no guilt, no gamification. One experiment at a time.

## 6. Not yet designed

- **Apple Watch app** (next up — separate chat)
- Marketing-site → checkout web screens at full desktop fidelity (spec'd in AccountFlows §03–07 as browser mocks)
- Transactional email dark-mode variants
- Admin console detail beyond the three ops views (§18)
