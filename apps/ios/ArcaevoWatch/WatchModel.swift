import Foundation
import Observation
import WatchKit

/// Watch-side state. The wrist shows STATUS + DELTAS only — never a raw
/// alarming value, never a red number. Deterministic demo data keeps every
/// screen walkable offline; the API is tried where it adds truth.
@MainActor
@Observable
final class WatchModel {
    /// The six prototype screens, in swipe order.
    enum Screen: Int, Hashable, CaseIterable {
        case face, today, glance, quickLog, experiment, resultReady
    }

    var screen: Screen = .face

    // MARK: Today / baseline

    /// Readiness vs the member's own baseline (pure arithmetic, shared with
    /// the phone dashboard).
    var score = 74
    /// Wrist status line — derived from the score band, calm by design.
    var statusTitle: String { score >= 60 ? "Steady" : "Ease off" }
    var statusBody: String {
        score >= 60
            ? "Within your baseline band. Nothing needs you today."
            : "A little under your baseline band. An easy day is enough."
    }

    // MARK: Face entry (in-app stand-in for the complication)

    /// Days until the next scheduled test (T−12 fixture until the booking
    /// API carries a date).
    var daysToNextTest = 12

    // MARK: Biomarker glance (status + delta, no raw alarming values)

    var hrvLatest = 52
    var hrvSeries: [Double] = []
    let glanceEyebrow = "INFLAMMATION · HRV PROXY"
    let glanceCaption = "hs-CRP was low in July. HRV steady since — likely still quiet."

    // MARK: Quick-log (prototype `wlogged`)

    let quickLogTags = ["Supplement", "Alcohol", "Cold plunge", "Late meal", "Workout", "Stress"]
    var logged: Set<String> = []

    var quickLogCaption: String {
        logged.isEmpty
            ? "One tap. It lands in your experiments on iPhone."
            : "\(logged.count) tagged today → feeds your experiments"
    }

    func toggleTag(_ tag: String) {
        if logged.contains(tag) {
            logged.remove(tag)
        } else {
            logged.insert(tag)
        }
        WKInterfaceDevice.current().play(.click) // haptic confirm
    }

    // MARK: Active experiment (design fixture — the experiment itself lives
    // on the phone; the wrist is a one-tap check-in)

    let experimentName = "EVENING WALKS"
    var experimentDay = 51
    let experimentLength = 60
    let adherencePercent = 87
    var experimentLogged = false

    func logExperimentDay() {
        guard !experimentLogged else { return }
        experimentLogged = true
        WKInterfaceDevice.current().play(.success) // haptic confirm
    }

    // MARK: Loading

    func load() async {
        // Readiness from the deterministic wearable series (API optional —
        // the same series the phone syncs).
        let hrv = DemoDataProvider.wearableSeries(metric: .hrv)
        let rhr = DemoDataProvider.wearableSeries(metric: .restingHeartRate)
        let sleep = DemoDataProvider.wearableSeries(metric: .sleepHours)
        score = Readiness.score(hrv: hrv, restingHeartRate: rhr, sleep: sleep)
        hrvSeries = hrv.suffix(9).map(\.value)
        hrvLatest = Int((hrv.last?.value ?? 52).rounded())
    }
}
