# Arcaevo — Local Device Testing & Production Release Guide

_How to run the iOS + Apple Watch apps on your own iPhone/Watch for real (HealthKit needs a physical device), then what's required for a closed beta (TestFlight) and a production release. Written 2026-07-04. Companion: `apps/ios/README.md`, `docs/BUILD_STATE.md`, `docs/MOCKED_APIS.md`._

Bundle IDs today: iOS `co.arcaevo.app`, Watch `co.arcaevo.app.watchkitapp`. Signing is `Automatic`, **no Development Team set yet** — that's the first thing you add below.

---

## Part 1 — Local testing on your own iPhone + Apple Watch

### Why a real device (not just the simulator)
The simulator has **no HealthKit data** and no Watch sensors — Arcaevo's whole daily-engagement layer (readiness, energy, cycle-aware baselines, workouts) reads real HRV/RHR/sleep/workouts. The app falls back to seeded demo data in the simulator, but to see the real fusion you must run on a physical iPhone with a paired Apple Watch that you've been wearing (ideally 2–4 weeks so baselines aren't in the `CALIBRATING` state).

### 1.1 One-time Apple setup (free account works for local device runs)
1. **Apple ID as a developer team.** Open Xcode → Settings → Accounts → add your Apple ID. A free Apple ID can sign apps onto *your own* devices for 7 days per build. A **paid Apple Developer Program membership (€99/yr)** removes the 7-day expiry, and is *required* for TestFlight, HealthKit on distributed builds, App Groups, and associated domains — so if you're about to do a closed beta, just buy it now (Part 2).
2. **Set the team in the project.** Edit `apps/ios/project.yml` — under the `Arcaevo` target's `settings.base` add `DEVELOPMENT_TEAM: <YOUR_TEAM_ID>` (find the 10-char Team ID in Xcode → Settings → Accounts → your team, or at developer.apple.com → Membership). Do the same for the `ArcaevoWatch` target and (once they exist) the widget extension targets. Then regenerate:
   ```bash
   cd apps/ios && xcodegen generate && open Arcaevo.xcodeproj
   ```
   > Keep `DEVELOPMENT_TEAM` out of git if the repo is public — set it via a local `project.local.yml` override or an xcconfig you gitignore. For a private repo it's fine to commit.
3. **Trust the device.** Plug in the iPhone via USB (first time), unlock it, tap "Trust This Computer". After the first wired run you can switch to **Wireless**: Xcode → Window → Devices and Simulators → select the iPhone → "Connect via network".

### 1.2 Capabilities the build needs on-device
These must be enabled on the App ID (Xcode does this automatically once the team is set and you build, *if* you have a paid account; a free account allows HealthKit but not App Groups):
- **HealthKit** — already in `Arcaevo/Arcaevo.entitlements`. The usage/purpose strings live in `Info-Debug.plist` / `Info-Release.plist` and must name every data type in plain language (Phase 22 expanded these: sleep & stages, heart rate, HRV, VO₂max, workouts, active energy, steps, respiratory rate, SpO₂, wrist temperature; cycle tracking is a *separate* purpose string requested only when the user turns on cycle-aware baselines).
- **App Group `group.co.arcaevo.app`** — needed for the widgets/complications to read the glance snapshot the app writes. Requires a paid account. Add it to the app + widget entitlements.
- **Background modes / BGTaskScheduler** — for posting the 60-day baseline + blood penalties to the Watch and refreshing widgets. Enable "Background fetch" + "Background processing".
- **Push notifications (APNs)** — only when you wire real remote pushes; the local notifications (morning readiness, energy dip, recheck) work without APNs. Deferring APNs is fine for the first beta.
- **Associated Domains** (`applinks:arcaevo.com`) — for magic-link universal links to open the app. Currently commented out in `project.yml`; uncomment and add the domain once you control the AASA file at `https://arcaevo.com/.well-known/apple-app-site-association`. Until then, the `arcaevo://` custom scheme + the typed 6-char code fallback both work.

### 1.3 Point the app at a backend your phone can reach
The Debug build currently targets `http://localhost:3000/api/v1` (`ARCAEVO_API_BASE_URL` in `Info-Debug.plist`). `localhost` on the phone means the *phone*, not your Mac — so on a real device you must point it at your Mac's LAN IP:

1. Run the stack on your Mac:
   ```bash
   cd /Users/niallmaher/Projects/arcaevo
   docker compose up --build          # web :3000, mongo :27019, mailhog :8026
   cd apps/web && npm run seed && npm run seed:user EMAIL=niall@codu.co
   ```
2. Find your Mac's LAN IP: `ipconfig getifaddr en0` (e.g. `192.168.1.20`).
3. Set the Debug base URL to it. Either edit `Info-Debug.plist` `ARCAEVO_API_BASE_URL` → `http://192.168.1.20:3000/api/v1`, or (cleaner) add a scheme env override. Because it's plaintext HTTP, the Debug ATS exception (`NSAllowsLocalNetworking`) already permits it — but LAN IPs sometimes need `NSAllowsArbitraryLoads` in Debug only; add it to `Info-Debug.plist` **only** (never Release) if the phone can't connect.
4. Phone and Mac must be on the **same Wi-Fi**, and macOS firewall must allow incoming connections to Docker/node.

Sign in on the phone with `niall@codu.co` → the magic-link email lands in **MailHog** (`http://localhost:8026` on your Mac) → type the 6-char code from the email into the app. That authenticates the phone and silently hands a session to the Watch.

### 1.4 Run it
1. In Xcode select the **Arcaevo** scheme + your iPhone as the destination → ⌘R. The Watch app installs to the paired Watch automatically (it's embedded). First install to a Watch can take a few minutes.
2. On first launch: grant HealthKit (the primer screen shows first, then the system sheet), grant notifications, complete consent. Wear the Watch overnight to get a real overnight HRV/RHR read — until then readiness shows `CALIBRATING` or `SPARSE NIGHT`, which is correct behaviour, not a bug.
3. To exercise the daily engine without waiting weeks: the DEBUG build keeps the demo-data fallback and the 71→62 blood-recalibration example, so you can see every screen populated immediately; real HealthKit values replace demo values as they accrue.

### 1.5 Watch-specific notes
- The Watch has no login screen by design — it's handed a session from the phone over WatchConnectivity. If the Watch shows "Finish setup on your iPhone", sign in on the phone once.
- Complications/widgets read a shared snapshot via the App Group; on a free account (no App Group) the in-app watch screens still work but the watch-face complication won't populate.
- Watch can only query ~7 days of HealthKit locally; the phone posts the 60-day baseline + current blood penalties via a background task so the wrist score matches the phone.

### 1.6 Common local-testing gotchas
- **"Could not launch — the request to open expired"** — CoreSimulator/device flake; documented fix in BUILD_STATE: `simctl shutdown all`, restart the CoreSimulator service, retry with an explicit `OS=17.4` destination.
- **No HealthKit data at all** — you're on the simulator, or the Watch hasn't been worn/synced. Check Apple Health app on the phone shows HRV/sleep first.
- **Phone can't reach the backend** — wrong LAN IP, different Wi-Fi, firewall, or you left it on `localhost`. Test in the phone's Safari: `http://<mac-ip>:3000` should load.
- **Signing error "no team"** — you didn't set `DEVELOPMENT_TEAM` / didn't add your Apple ID in Xcode.

---

## Part 2 — Closed beta (TestFlight) & production release

### 2.1 Non-negotiable prerequisites
| Requirement | Why | Cost/effort |
|---|---|---|
| **Apple Developer Program membership** | Required for TestFlight, HealthKit distribution, App Groups, APNs, associated domains | €99/yr |
| **Real backend host (not your Mac)** | Beta testers hit it from anywhere over HTTPS | Vercel (primary, already the plan) + MongoDB Atlas eu-west-1 |
| **HTTPS + real domain** | Release ATS is HTTPS-only (`arcaevo.com/api/v1`); universal links need the domain | Point `arcaevo.com` at Vercel |
| **App Store Connect record** | The app's listing + TestFlight distribution | Free with membership |

### 2.2 Backend productionisation (from `docs/MOCKED_APIS.md` — the blockers)
The app is only as real as the backend behind it. Before a beta that isn't demo-data:
- **Secrets fail-closed in prod** (already built): set `SESSION_SECRET`, `ADMIN_PASSWORD` in Vercel; the server refuses to boot without them. Do **not** set `ALLOW_DEMO_TOKEN`.
- **Member auth**: magic-link email needs a real EU ESP (Scaleway TEM / Postmark EU) wired into `email.smtp.ts` — MailHog is local-only. Add **IP/global rate-limiting** on `/auth/magic-link/verify` (documented TODO).
- **Stripe** (the very next phase): swap the mock for real Stripe (test keys are already in `apps/web/.env.local`), real `stripe-signature` webhook verification, Products/Prices for €119/€329/€399/+€130 and the €69 recheck add-on, Stripe Tax for IE VAT. Payments are web-only (no IAP) — the app link-outs already do the right thing.
- **LetsGetChecked**: real partner agreement + REST client + webhook signature verification (still mocked).
- **Clinician review**: the Phase-22 "note on every panel" is a mock Dr. Nolan persona — a real medical-ops partner + IMC-registered reviewer is required before real results reach real users.
- **GDPR erasure cron**: `npm run erase:run` must be invoked by a scheduler (Vercel Cron) at least daily — that's the operational half of the "erased within 30 days" promise.
- **Atlas**: provision MongoDB Atlas eu-west-1, set `MONGODB_URI`; the CDK documents the wiring.

### 2.3 iOS release configuration
1. Set `DEVELOPMENT_TEAM` on all targets; enable capabilities on the App ID in the Apple Developer portal: HealthKit, App Groups (`group.co.arcaevo.app`), Background Modes, Push (when ready), Associated Domains (`applinks:arcaevo.com`).
2. Host the **AASA file** at `https://arcaevo.com/.well-known/apple-app-site-association` (paths for `/verify`) and uncomment `com.apple.developer.associated-domains` in `project.yml`. This makes magic-link emails open the app.
3. Confirm the **Release** build is HTTPS-only: `Info-Release.plist` has no ATS exceptions and `ARCAEVO_API_BASE_URL = https://arcaevo.com/api/v1` (already verified in BUILD_STATE — keep it that way).
4. **App Privacy labels** in App Store Connect must declare health data as *linked to the user*, mirroring the Art. 9 consent wording. **HealthKit purpose strings** must name each type + its use in plain language. Menstrual data only appears behind the optional cycle entitlement path.
5. Increment `CFBundleShortVersionString` / build number; Archive (Product → Archive with a "Generic iOS Device" or real device destination) → upload to App Store Connect.

### 2.4 TestFlight (the closed beta)
1. **Internal testing** (up to 100 users on your team, no review): add testers by Apple ID in App Store Connect → TestFlight → Internal. Fastest loop — good for you + a handful of trusted people. Builds available minutes after processing.
2. **External testing** (up to 10,000 via a public/private link): requires a **Beta App Review** (lighter than full App Store review, usually <24h) and a filled-in "Test Information" (what to test, a demo account, and — critically for a health app — an explanation of HealthKit usage and your data handling). Provide the reviewer a working seeded login.
3. **Health-app review sensitivities to pre-empt**: reviewers scrutinise HealthKit apps. Be ready to show (a) you only *read* HealthKit, (b) purpose strings match actual use, (c) you don't use health data for advertising, (d) the wellness-not-diagnosis framing is consistent, (e) the "critical values → clinician phones first, never a red number in-app" flow. Apple rejects apps that show alarming medical interpretations — the design's amber-at-worst posture is deliberately review-safe; keep it.
4. **No IAP is correct** but be ready to justify the external web checkout to review — this is allowed for a *service* consumed outside the app (physical blood kits + membership), which is your case; keep payment CTAs as Safari link-outs, never an in-app purchase sheet.

### 2.5 From closed beta → App Store production
- Full **App Store Review** (stricter than TestFlight's): complete metadata, screenshots (6.7" + 6.1" iPhone, plus Apple Watch if you feature it), privacy policy URL (you have `/legal/privacy`), support URL, age rating.
- **Medical/health category**: expect extra scrutiny; the "wellness, never diagnosis" line must hold across every screen and the App Store description.
- **EU MDR/IVDR posture**: the June-2025 MDCG guidance puts health apps in scope. The blood-informed readiness layer is wellness-framed and has the ON/OFF toggle as the documented fallback to a pure "context" layer if a reviewer/regulator pushes back. Have that toggle behave as a config flag (per ALGORITHM.md §5 guardrails).
- Roll out to a **phased release** (App Store Connect supports 7-day phased rollout) so you catch issues before 100% of users.

### 2.6 Suggested order of operations
1. Buy the Apple Developer membership; set `DEVELOPMENT_TEAM`.
2. Get it running on your own iPhone+Watch over LAN (Part 1) — prove the real HealthKit fusion works.
3. Stand up the production backend on Vercel + Atlas with real secrets, ESP, and **Stripe (next phase)**.
4. Point the Release build at `https://arcaevo.com/api/v1`, host the AASA file, enable capabilities.
5. Internal TestFlight with yourself + a few people → fix → External TestFlight (Beta App Review) with a small closed cohort → iterate → App Store submission.

---

## Quick reference

```bash
# Local backend for device testing
docker compose up --build
cd apps/web && npm run seed && npm run seed:user EMAIL=niall@codu.co
ipconfig getifaddr en0            # → put this IP in Info-Debug.plist ARCAEVO_API_BASE_URL

# Generate + open the Xcode project after any project.yml change
cd apps/ios && xcodegen generate && open Arcaevo.xcodeproj

# MailHog (magic-link codes during device testing)
open http://localhost:8026
```
