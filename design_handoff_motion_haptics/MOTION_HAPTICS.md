# Motion & Haptics — Arcaevo iOS + watchOS

The prototype (`designs/Prototype.dc.html`) now carries the intended motion layer and haptic
annotations. Every animation in it is a spec, not a decoration: recreate with the SwiftUI
equivalents below. The tone is Apple-Health-calm — short, eased, never bouncy except toggles,
never looping, nothing over 1.3s. **All motion must respect Reduce Motion** (the prototype
respects `prefers-reduced-motion`).

## The haptic chip

In the prototype, a small green chip flashes under the device (`◉ HAPTIC · …`) at the exact
moment a real device would buzz. It is a prototyping affordance only — do not build it.
Map the labels to:

| Label in prototype | iOS API | Use |
|---|---|---|
| SELECTION | `UISelectionFeedbackGenerator.selectionChanged()` | chips, day/slot pickers, plan/marker choices |
| IMPACT · LIGHT | `UIImpactFeedbackGenerator(style: .light)` | toggles, copy link, end session, fusion point tap |
| IMPACT · SOFT | `UIImpactFeedbackGenerator(style: .soft)` | blood-layer compare, sending a chat prompt |
| IMPACT · RIGID | `UIImpactFeedbackGenerator(style: .rigid)` | arming DELETE |
| NOTIFICATION · SUCCESS | `UINotificationFeedbackGenerator → .success` | save check-in, start experiment, booking, Eircode pass, passkey, GP link, export, manual add |
| NOTIFICATION · WARNING | `UINotificationFeedbackGenerator → .warning` | Eircode fail (Cork), confirming account deletion |
| WATCH · CLICK | `WKInterfaceDevice.current().play(.click)` | quick-log tags, felt check-in |
| WATCH · SUCCESS | `WKInterfaceDevice.current().play(.success)` | "Log today's walk" |

Rules of restraint:
- One haptic per user action, fired on state change, never on scroll or navigation.
- Success haptics only for completed intents (saved, booked, started) — never for taps that merely select.
- The watch never buzzes for the morning readiness Smart Stack card (it *surfaces*, silently — see README).
- No haptic on critical-value screens; the phone call is the event, the UI stays quiet.

## Motion vocabulary (what's animated, and with what)

| Moment | Prototype spec | SwiftUI equivalent |
|---|---|---|
| Screen entry | fade + 10px rise, 450ms, cubic-bezier(0.22,1,0.36,1) | default `NavigationStack` push; for tab/sheet content `transition(.opacity.combined(with:.offset(y:10)))`, `.easeOut(duration:0.45)` |
| Readiness / score rings | stroke draws from 0 → value, 1s, ease-out, 0.2s delay | `trim(from:0, to:value)` with `.animation(.easeOut(duration:1).delay(0.2))` |
| Blood layer toggle (71 ⇄ 62) | ring offset + color cross-animate 0.7s; the number **counts** between values (650ms, cubic ease-out) | animate `trim`/`foregroundStyle`; count via `contentTransition(.numericText())` or a `TimelineView` counter |
| Trend charts | line draws left→right, 0.9–1.2s ease-out, ~0.25s delay | `trim(from:0,to:1)` on the `Path`/Swift Charts `chartAnimation` |
| Progress bars (adherence, energy, ceiling) | width grows from 0, 0.9s ease-out, 0.2–0.3s delay | animate the bar's `width`/`scaleEffect(x:)` |
| Toggles | knob 0.3s spring with slight overshoot `cubic-bezier(0.32,1.4,0.55,1)` | `.spring(response:0.3, dampingFraction:0.7)` |
| Chip selection | background/border/color cross-fade 0.22s | `.easeOut(duration:0.22)` |
| Confirmation cards (✓ saved / booked / logged) | scale 0.94→1 with 1.5% overshoot + fade, 0.4s | `.spring(response:0.4, dampingFraction:0.75)` + `.transition(.scale(0.94).combined(with:.opacity))` |
| HealthKit primer sheet | rises 44px + fade, 0.55s, 0.25s after screen | native sheet presentation covers this |
| Chat bubbles | rise + fade 0.35s on insert | `.transition(.move(edge:.bottom).combined(with:.opacity))` |
| Button press | scale 0.97, 120ms | `.scaleEffect(isPressed ? 0.97 : 1)` via `ButtonStyle` |
| Watch screens | same vocabulary, slightly faster (0.4s entry); rings/gauges draw in 1s | identical SwiftUI, watchOS |

Deliberately **not** animated: list scrolling, tab switches beyond the content fade, the
critical-value screen (static, calm), and anything that would delay reading data.

## Logo usage (factor into every surface)

The mark is the two-stroke "A" arc (asset: `uploads/arc-svg.svg`, viewBox 643×495, ≈1.3:1 —
never stretch or redraw). It is a single-colour glyph (`currentColor`):

- **On light (Bone/Surface):** Forest `#1E5C45`. **On dark (Ink/watch black):** bright green `#7FD3AE`. Never any other colour, never gradients.
- **Lockup:** mark + wordmark "Arcaevo" (Hanken Grotesk 600, tight −0.01em), gap ≈ half the mark width. Wordmark never appears without the mark.
- **iOS app:** mark only — the wordmark does not appear inside app screens (screens use Geist Mono eyebrow labels instead). Welcome screen: mark alone, 34px. App icon: mark alone.
- **Apple Watch:** mark only, ≥10px; notifications/result-ready use mark + `ARCAEVO` in Geist Mono 8.5px caps — that mono caption is a label, not the wordmark.
- **Push notifications gallery:** mark 10px + mono `ARCAEVO` label (already final in the prototype).
- **Minimum size:** 16px wide (mark), else drop it rather than shrink further.
- **Clear space:** one mark-width on all sides; never place on photography or busy fills.
- **Mobile / narrow contexts:** when horizontal space is tight (e.g. nav bars < 640px), keep the **mark only and drop the wordmark** — never shrink the lockup below 19px wordmark size, and never abbreviate the wordmark.
- No animation of the logo itself anywhere in the app — it is the one permanently still element.
