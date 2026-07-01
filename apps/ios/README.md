# Arcaevo — iOS + watchOS app

SwiftUI iOS app (iOS 17+) with a watchOS 10+ companion. Members connect
Apple Watch / Apple Health, order finger-prick blood tests, and the app fuses
wearable + blood data into plain-language insights read off their **own
baseline** — with a "did it work?" loop. Deterministic rules decide the logic;
AI only narrates. Wellness-first, never diagnosis:
*"Not a medical device. Not a diagnosis. Consult a doctor."*

## Getting started

The Xcode project is generated from `project.yml` (the source of truth —
`Arcaevo.xcodeproj` is gitignored, never commit it):

```sh
brew install xcodegen
cd apps/ios
xcodegen generate
open Arcaevo.xcodeproj
```

Run the **Arcaevo** scheme on an iOS 17+ simulator, or **ArcaevoWatch** on a
watchOS 10+ simulator. CLI builds:

```sh
xcodebuild -project Arcaevo.xcodeproj -scheme Arcaevo -destination 'generic/platform=iOS Simulator' build
xcodebuild -project Arcaevo.xcodeproj -scheme ArcaevoWatch -destination 'generic/platform=watchOS Simulator' build
```

## Layout

```
project.yml       XcodeGen manifest (targets, entitlements, Info.plist keys)
ArcaevoKit/       Shared sources group, compiled into BOTH targets:
                  Codable models (User, Membership, TestOrder,
                  BiomarkerReading, WearableSignal, Insight), APIClient,
                  DemoDataProvider (seeded demo data), brand Theme colors,
                  Readiness score + ring view
Arcaevo/          iOS app: onboarding, Today dashboard, Results, Orders,
                  Settings + the HealthKit layer
ArcaevoWatch/     watchOS companion: single scrollable Today view
                  (readiness ring, latest insight, blood-test status)
```

`ArcaevoKit` is a **shared sources group** (not a framework): both app targets
compile the same files directly, which keeps signing/embedding simple for v1.

## API + what's mocked (see also docs/MOCKED_APIS.md)

`APIClient` targets the local web backend at `http://localhost:3000/api/v1`
(`NSAllowsLocalNetworking` is enabled for this):

| Endpoint | Use |
|---|---|
| `GET /members/me` | member + membership tier/term/renewal |
| `GET /results` | biomarker readings (value, baseline band, RCV verdict) |
| `GET /insights` | plain-language insights incl. "did it work?" experiments |
| `GET /orders` / `POST /orders` | test-kit orders + add-on ordering |
| `POST /sync/wearables` | best-effort push of Apple Health daily signals |

- **Auth is mocked**: a static demo bearer token (`demo-member-token`),
  per docs/MOCKED_APIS.md §4. Production = Sign in with Apple + real tokens.
- **Sign-in on the onboarding screen is a mock** — it just marks onboarding
  complete.
- Payments/fulfilment are mocked server-side (Stripe / LetsGetChecked mocks).

## Demo mode — the app always demos

- If the API is unreachable (3s timeout), every screen falls back to
  `DemoDataProvider`: seeded, deterministic, plausible data (member "Aoife",
  results across 4 panels, an in-lab kit order, insights including an
  HbA1c "did it work? — yes" verdict). A small **DEMO DATA — API OFFLINE**
  badge shows when this happens. `POST /orders` also falls back locally.
- **HealthKit**: real `HKHealthStore` reads (HRV SDNN, resting heart rate,
  sleep analysis, VO₂ max) behind the `HealthDataProviding` protocol.
  In the simulator — or when authorization is denied / reads come back
  empty — `MockHealthStore` supplies seeded deterministic 30-day series.
- The watch app tries the API for insight + order status and falls back to
  the same demo data; its ring is computed by the shared deterministic
  `Readiness` score.

## Product rules honoured

- v1 integrations: **Apple Watch + Apple Health only** (WHOOP/Oura/Garmin
  are "on the roadmap" copy only).
- Wellness language, never diagnosis; the disclaimer appears on onboarding,
  Today, Results, Orders and Settings.
- Verbatim pricing on membership/add-ons: Fusion €119/yr · Essential €329/yr ·
  Performance €399/yr; add-ons €99 full panel / €69 recheck.
- Order status timeline mirrors the mock LetsGetChecked state machine:
  ordered → shipped → delivered → sample registered → in lab → results ready.
