import Foundation
import Observation
import WatchKit

/// Watch-side state. The wrist shows STATUS + DELTAS + a DECISION only — never
/// a raw alarming value, never a red number. Deterministic engines (ArcaevoKit
/// compiles into the watch target) run on the crafted baseline series so every
/// screen matches the phone's story offline; the API is tried where it adds
/// truth (real member via the watch token).
///
/// BASELINE CACHING (ALGORITHM §4): the Watch can only query ~7 days of health
/// locally, so the real product posts the 60-day HRV/RHR baseline + current
/// blood penalties from the phone via a background task. Until that transport
/// lands, the wrist renders the deterministic engine story from the shared
/// demo baseline — the same numbers the phone computes — so the surfaces are
/// populated and honest. The real member name always overlays via the token.
@MainActor
@Observable
final class WatchModel {
    /// The ten prototype watch screens, in the design's swipe order.
    enum Screen: Int, Hashable, CaseIterable {
        case face, today, energy, checkin, vitality, glance, quickLog, workout, experiment, resultReady
    }

    var screen: Screen = .face

    // MARK: Readiness (from the real engine)

    /// Locked-at-wake readiness. Drives the today ring + decision + one-line why.
    private(set) var readiness: ReadinessResult?

    /// Displayed score — the blood-recalibrated final. `showsScore` gates
    /// whether it's shown at all, so this is only read once real.
    var score: Int { readiness?.final ?? 0 }
    var decision: ReadinessDecision { readiness?.decision ?? .goEasy }
    var exertionCeiling: Int { readiness?.exertionCeiling ?? decision.exertionCeiling }
    /// Honest by default: with no computed readiness (the wrist can't build a
    /// real baseline locally yet), show the calibrating state — never a number.
    var showsScore: Bool { readiness?.state.showsScore ?? false }

    /// Short decision headline for the today ring (design: "Go easy").
    var decisionShort: String {
        switch decision {
        case .trainHard: return "Train hard"
        case .trainAsPlanned: return "On plan"
        case .goEasy: return "Go easy"
        case .rest: return "Rest"
        }
    }

    /// One-line why + the exertion ceiling, straight from the engine. Only read
    /// when `showsScore` is true, so there's always a real `why` behind it.
    var whyLine: String {
        let why = readiness?.why ?? "From your overnight HRV and resting heart rate."
        return "\(why) Ceiling \(exertionCeiling) of 10."
    }

    /// Calm today-baseline status (legacy fallback surface).
    var statusTitle: String { score >= 60 ? "Steady" : "Ease off" }
    var statusBody: String {
        score >= 60
            ? "Within your baseline band. Nothing needs you today."
            : "A little under your baseline band. An easy day is enough."
    }

    // MARK: Energy (all-day gauge)

    private(set) var energyDay: EnergyDay?
    /// True once there's a real all-day curve to show; otherwise the screen
    /// stays in its honest "building" state rather than inventing a percent.
    var energyKnown: Bool { energyDay != nil }
    var energyPercent: Int { energyDay?.value(at: Date()) ?? energyDay?.start ?? 0 }
    /// Amber gauge when the ceiling is pulled down (go-easy / rest).
    var energyLowered: Bool { decision == .goEasy || decision == .rest }
    var energyBestWindow = "Best window 10:00–12:30. Dip due ~15:00 — a walk beats coffee."
    /// Blood-derived note only when there's a real blood penalty behind it;
    /// otherwise nothing (never claim "low iron" the member hasn't measured).
    var energyCeilingNote = "Modelled from your HRV, sleep and movement."

    // MARK: Vitality (glance: age ± band)

    private(set) var vitality: VitalityScore?
    /// Vitality is blood-anchored — shown only once there's a real score.
    var vitalityKnown: Bool { vitality != nil }
    var vitalityAge: Int { vitality?.age ?? 0 }
    var vitalityBand: Int { vitality?.band ?? 0 }
    var vitalityDelta = "Appears after your first blood panel."
    let vitalityFootnote = "The slow score — it only moves when it's real."

    // MARK: Face entry (in-app stand-in for the complication)

    var daysToNextTest = 12

    // MARK: Biomarker glance (status + delta, no raw alarming values)

    var hrvLatest = 0
    var hrvSeries: [Double] = []
    /// HRV is a wearable signal — never framed as a blood/inflammation reading.
    let glanceEyebrow = "HRV · OVERNIGHT"
    var glanceCaption = "Your recovery signal. Full trends on iPhone."

    // MARK: Felt check-in (§1.5 — one tap → posts back into today's score)

    /// 5-point feel chips, best→worst; picking one saves a FeltCheckin and
    /// recomputes readiness so the wrist score reflects how you actually feel.
    struct FeelChip: Identifiable, Hashable {
        let id: Int          // the 1–5 feel value
        let label: String
    }
    let feelChips: [FeelChip] = [
        FeelChip(id: 5, label: "Great"),
        FeelChip(id: 4, label: "Good"),
        FeelChip(id: 3, label: "So-so"),
        FeelChip(id: 2, label: "Off"),
        FeelChip(id: 1, label: "Rough"),
    ]
    private(set) var selectedFeel: Int?
    var checkinDone: Bool { selectedFeel != nil }

    func pickFeel(_ feel: Int) {
        selectedFeel = feel
        WKInterfaceDevice.current().play(.click)
        // Post back: persist today's check-in and recompute so the score tunes
        // to how you feel (a low feel softens the decision one step, §1.5).
        let checkin = FeltCheckin(date: Date(), feel: feel)
        Self.persistCheckin(checkin)
        recompute(felt: checkin)
    }

    // MARK: Live workout (HR + zone + today's-ceiling buffer + ease-off)
    //
    // Faithful to the `wworkout` design. Live HR/zone come from an
    // HKWorkoutSession in the shipping product; until that session is wired
    // (a workout Live Activity, documented TODO), these render the design's
    // in-workout demo so the ceiling-buffer pattern is testable end-to-end.

    let workoutTitle = "OUTDOOR WALK"
    let workoutElapsed = "22:14"
    let workoutHR = 128
    let workoutZoneLabel = "ZONE 2 · EASY"
    /// 1-based active zone (of 5).
    let workoutZoneIndex = 2
    /// Live "today's ceiling" buffer — 3.4 used of a 4.0 ceiling (design).
    let workoutCeilingUsed = 3.4
    let workoutCeilingMax = 4.0
    let workoutEaseOff = "Ease off in ~8 min to finish inside today's ceiling."

    // MARK: Quick-log (prototype `wlogged`)

    let quickLogTags = ["Supplement", "Alcohol", "Cold plunge", "Late meal", "Workout", "Stress"]
    var logged: Set<String> = []
    var quickLogCaption: String {
        logged.isEmpty
            ? "One tap. It lands in your experiments on iPhone."
            : "\(logged.count) tagged today → feeds your experiments"
    }
    func toggleTag(_ tag: String) {
        if logged.contains(tag) { logged.remove(tag) } else { logged.insert(tag) }
        WKInterfaceDevice.current().play(.click)
    }

    // MARK: Active experiment

    let experimentName = "EVENING WALKS"
    var experimentDay = 51
    let experimentLength = 60
    let adherencePercent = 87
    var experimentLogged = false
    func logExperimentDay() {
        guard !experimentLogged else { return }
        experimentLogged = true
        WKInterfaceDevice.current().play(.success)
    }

    // MARK: Real member (via the watch token) + demo fallback

    var memberName: String?

    // MARK: Loading + engine compute

    func load(auth: WatchAuthManager) async {
        // Populate the engine outputs. In demo the deterministic story stands
        // in so every ring/gauge/sparkline matches the phone; in a real build
        // the wrist can't build a 60-day baseline locally yet, so readiness /
        // energy / vitality stay honestly empty (calibrating) until the phone→
        // watch baseline transport lands — never a fabricated number.
        recompute(felt: nil)

        if WatchDemoMode.isEnabled {
            let hrv = DemoDataProvider.wearableSeries(metric: .hrv)
            hrvSeries = hrv.suffix(9).map(\.value)
            hrvLatest = Int((hrv.last?.value ?? 52).rounded())
        }

        // Real member via the watch token (Bearer = watch token; one silent
        // refresh on 401). No-op in demo mode; the demo story stands in.
        if let user = await auth.authedDataCall({ try await $0.me() }) {
            memberName = user.name
        }
    }

    /// Runs the deterministic engines on the crafted baseline series and writes
    /// the App-Group GlanceSnapshot the watch complication reads. Demo-only:
    /// outside demo mode there's no real on-wrist baseline to feed them, so the
    /// outputs stay nil and the screens render their honest calibrating states.
    private func recompute(felt: FeltCheckin?) {
        let now = Date()
        let calendar = Calendar.current

        let todayFelt = felt ?? Self.loadTodayCheckin(now: now, calendar: calendar)
        if let f = todayFelt { selectedFeel = f.feel }

        guard WatchDemoMode.isEnabled else {
            // Honest empty state — no bluffed readiness/energy/vitality.
            readiness = nil
            energyDay = nil
            vitality = nil
            SnapshotStore.write(GlanceSnapshot(
                readiness: nil, energy: nil, nextTestDays: daysToNextTest, now: now
            ))
            return
        }

        let hrv = DemoDataProvider.readinessDailyPoints(metric: .hrv)
        let rhr = DemoDataProvider.readinessDailyPoints(metric: .restingHeartRate)
        let penalties = BiomarkerPenalty.derive(from: DemoDataProvider.recalibrationReadings(), now: now)
        let vitals = DemoDataProvider.vitalsSnapshot()

        readiness = ReadinessEngine.compute(
            hrv: hrv,
            rhr: rhr,
            vitals: vitals,
            penalties: penalties,
            felt: todayFelt,
            cyclePhase: nil,
            calendar: calendar,
            now: now
        )
        energyDay = EnergyEngine.day(samples: DemoDataProvider.energyInputs(), penalties: penalties, now: now, calendar: calendar)
        vitality = DemoDataProvider.vitalityScore()

        // Feed the watch complication: honest snapshot (never bluffs).
        SnapshotStore.write(GlanceSnapshot(
            readiness: readiness,
            energy: energyDay,
            nextTestDays: daysToNextTest,
            now: now
        ))
    }

    // MARK: Felt check-in persistence (watch-local; §1.5)

    private static let checkinsKey = "arcaevo.watch.feltCheckins.v1"

    private static func persistCheckin(_ checkin: FeltCheckin) {
        var all = loadCheckins()
        let calendar = Calendar.current
        all.removeAll { calendar.isDate($0.date, inSameDayAs: checkin.date) }
        all.append(checkin)
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        if let data = try? encoder.encode(all) {
            UserDefaults.standard.set(data, forKey: checkinsKey)
        }
    }

    private static func loadCheckins() -> [FeltCheckin] {
        guard let data = UserDefaults.standard.data(forKey: checkinsKey) else { return [] }
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return (try? decoder.decode([FeltCheckin].self, from: data)) ?? []
    }

    private static func loadTodayCheckin(now: Date, calendar: Calendar) -> FeltCheckin? {
        loadCheckins().last { calendar.isDate($0.date, inSameDayAs: now) }
    }
}
