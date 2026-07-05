import Foundation

// MARK: - Phase 22 shared engine models (contract: docs/BUILD_STATE.md §Phase 22)
//
// Pure Foundation value types compiled into BOTH the iOS and watchOS targets.
// Deterministic engines only — no AI anywhere in the maths (AI narrates later).

/// One daily observation of a signal (HRV, RHR, respiratory rate, …).
/// The engine-facing twin of `WearableSignal` without transport baggage.
struct DailyPoint: Codable, Hashable {
    var date: Date
    var value: Double

    init(date: Date, value: Double) {
        self.date = date
        self.value = value
    }

    init(_ signal: WearableSignal) {
        self.date = signal.date
        self.value = signal.value
    }
}

extension Array where Element == WearableSignal {
    /// Engine-facing conversion, oldest first.
    var dailyPoints: [DailyPoint] {
        sorted { $0.date < $1.date }.map(DailyPoint.init)
    }
}

/// Recent overnight vitals series used for the illness flag (ALGORITHM §1.1):
/// out-of-band respiratory rate / SpO₂ / wrist temperature widen the band;
/// a sustained run softens toward rest and can enter sick mode (§1.7).
/// Series are daily, oldest first; the last point is last night.
struct VitalsSnapshot: Codable, Hashable {
    var respiratoryRate: [DailyPoint]
    var spo2: [DailyPoint]
    var wristTemp: [DailyPoint]

    init(
        respiratoryRate: [DailyPoint] = [],
        spo2: [DailyPoint] = [],
        wristTemp: [DailyPoint] = []
    ) {
        self.respiratoryRate = respiratoryRate
        self.spo2 = spo2
        self.wristTemp = wristTemp
    }
}

/// One explanatory line under the readiness score ("HRV vs 60-day baseline: +9").
struct ScoreContribution: Codable, Hashable {
    var label: String
    /// Signed points. Wearable drivers move the core; blood entries carry the
    /// ceiling penalty (negative); informational rows may be 0.
    var points: Int
    var detail: String?

    init(label: String, points: Int, detail: String? = nil) {
        self.label = label
        self.points = points
        self.detail = detail
    }
}

/// The decision every score ends in (ALGORITHM §1). Amber at worst — the copy
/// for `rest` is permission-to-rest, never an alarm.
enum ReadinessDecision: String, Codable, CaseIterable, Hashable {
    case trainHard
    case trainAsPlanned
    case goEasy
    case rest

    /// Design-verbatim decision headline.
    var headline: String {
        switch self {
        case .trainHard: return "Train hard today."
        case .trainAsPlanned: return "Train as planned."
        case .goEasy: return "Go easy today."
        case .rest: return "Rest today."
        }
    }

    /// One step toward rest (§1.3b band widening / §1.5 felt correction).
    var softened: ReadinessDecision {
        switch self {
        case .trainHard: return .trainAsPlanned
        case .trainAsPlanned: return .goEasy
        case .goEasy: return .rest
        case .rest: return .rest
        }
    }

    /// Target Exertion ceiling out of 10 (§1.6) — a ceiling, not a quota.
    /// Design: 7/10 wearable-only (trainAsPlanned) vs 4/10 blood-recalibrated
    /// (goEasy); sick/rest drops to rest.
    var exertionCeiling: Int {
        switch self {
        case .trainHard: return 9
        case .trainAsPlanned: return 7
        case .goEasy: return 4
        case .rest: return 1
        }
    }
}

/// Degraded/first-run states (ALGORITHM §6) — scores never bluff. The result
/// always carries best-effort numbers, but any state other than `.ok`/`.sick`
/// means the UI must show the state, not a confident score.
enum ReadinessState: Codable, Hashable {
    /// < 28 days of overnight HRV/RHR (14 with historical bloods on file).
    /// Ring shows fill progress, never a fake score.
    case calibrating(day: Int, of: Int)
    case ok
    /// No overnight read last night — never interpolate; grey out yesterday's.
    case sparseNight
    /// §1.7 — rest is the plan, not a failure.
    case sick

    /// Stable string for `GlanceSnapshot.state` / analytics.
    var key: String {
        switch self {
        case .calibrating: return "calibrating"
        case .ok: return "ok"
        case .sparseNight: return "sparseNight"
        case .sick: return "sick"
        }
    }

    /// True when the UI may present the score as a confident number.
    var showsScore: Bool {
        switch self {
        case .ok, .sick: return true
        case .calibrating, .sparseNight: return false
        }
    }
}

/// The blood layer's own honesty states (ALGORITHM §6 "No bloods yet" /
/// "Stale blood") — separate from `ReadinessState` because readiness keeps
/// running wearable-only in all three.
enum BloodLayerState: Codable, Hashable {
    /// Zero biomarker readings — the blood card is an invite, and the
    /// ON/OFF toggle must NOT be shown with nothing behind it.
    case noBloods
    case active(latestDraw: Date)
    /// Last draw > 26 weeks — penalties fully decayed; sell the recheck honestly.
    case stale(latestDraw: Date)

    static let staleAfterWeeks = 26

    static func from(readings: [BiomarkerReading], now: Date = Date()) -> BloodLayerState {
        guard let latest = readings.map(\.measuredAt).max() else { return .noBloods }
        let weeks = now.timeIntervalSince(latest) / (7 * 86_400)
        return weeks > Double(staleAfterWeeks) ? .stale(latestDraw: latest) : .active(latestDraw: latest)
    }
}

/// Locked-at-wake readiness output (ALGORITHM §1). `core` is the wearable-only
/// number (blood layer OFF), `final` the blood-recalibrated one; the band is a
/// first-class UI element.
struct ReadinessResult: Codable, Hashable {
    /// Wearable-only score — 50 + 50·clamp(w·z, −1, +1).
    var core: Int
    /// 100 − Σ blood penalties, floored at 55 (§1.3) — never alarmist.
    var ceiling: Int
    /// Blood-recalibrated score shown by default (blood layer ON).
    var final: Int
    /// ± confidence band (§1.3b — widened by inflammation/vitals).
    var band: Int
    var decision: ReadinessDecision
    /// The one-line why (deterministic; AI may re-narrate around it later).
    var why: String
    var contributions: [ScoreContribution]
    var state: ReadinessState
    /// Target Exertion ceiling 0–10 (§1.6). Additive to the shared contract.
    var exertionCeiling: Int

    init(
        core: Int,
        ceiling: Int,
        final: Int,
        band: Int,
        decision: ReadinessDecision,
        why: String,
        contributions: [ScoreContribution],
        state: ReadinessState,
        exertionCeiling: Int? = nil
    ) {
        self.core = core
        self.ceiling = ceiling
        self.final = final
        self.band = band
        self.decision = decision
        self.why = why
        self.contributions = contributions
        self.state = state
        self.exertionCeiling = exertionCeiling ?? decision.exertionCeiling
    }
}

// MARK: - Felt check-in + behaviour impacts (ALGORITHM §1.5)

/// The morning felt check-in — 5-point feel + optional tags. `sick` mirrors
/// the "Feeling ill" tag and is the sick-mode entry signal (§1.7).
struct FeltCheckin: Codable, Hashable, Identifiable {
    var date: Date
    /// 1 (awful) – 5 (great).
    var feel: Int
    var tags: [String]
    var sick: Bool

    var id: Date { date }

    init(date: Date, feel: Int, tags: [String] = [], sick: Bool? = nil) {
        self.date = date
        self.feel = max(1, min(5, feel))
        self.tags = tags
        self.sick = sick ?? tags.contains(FeltCheckin.sickTag)
    }

    /// The design's tag vocabulary (checkin screen).
    static let sickTag = "Feeling ill"
    static let allTags = ["Sore legs", "Stressed", "Slept away", "Alcohol", "Late meal", sickTag]
}

/// One (day, readiness) pair for the behaviour-impact regression.
struct DatedScore: Codable, Hashable {
    var date: Date
    var score: Int

    init(date: Date, score: Int) {
        self.date = date
        self.score = score
    }
}

/// "Alcohol −11 readiness next day" — this user's own coefficient, never a
/// population average (ALGORITHM §1.5).
struct BehaviourImpact: Codable, Hashable, Identifiable {
    var tag: String
    /// Next-day readiness delta vs the user's own untagged days.
    var delta: Double
    /// Number of tagged days behind the estimate (surfaced only when ≥ 3).
    var n: Int

    var id: String { tag }
}

// MARK: - HealthKit expansion models (workouts + sleep stages)

/// One workout, HR-weighted so resistance work counts toward load (§1.6).
struct WorkoutSummary: Codable, Hashable, Identifiable {
    /// Display name, e.g. "Run", "Strength", "Walk".
    var type: String
    var minutes: Int
    var avgHR: Int?
    var maxHR: Int?
    var kcal: Int?
    /// Workout start.
    var date: Date

    var id: String { "\(type)-\(date.timeIntervalSince1970)" }

    /// Resistance sessions carry load even at low average HR — the top
    /// documented complaint against cardio-only strain models.
    var isResistance: Bool {
        let t = type.lowercased()
        return t.contains("strength") || t.contains("weight") || t.contains("resistance")
    }
}

/// One night of sleep with stages. Sleep is SHOWN, never folded into the core
/// readiness score (ALGORITHM §1.4); it drives the Energy model instead.
struct SleepNight: Codable, Hashable, Identifiable {
    /// The morning the night ended (start of day).
    var date: Date
    /// Total asleep hours.
    var hours: Double
    var deep: Double?
    var rem: Double?
    var core: Double?
    var awakenings: Int?

    var id: Date { date }

    /// 0.6–1.0 restorative-quality factor for the overnight recharge:
    /// deep+REM fraction against a 45% restorative target. No stages → 0.85.
    var qualityFactor: Double {
        guard hours > 0, let deep, let rem else { return 0.85 }
        let restorative = (deep + rem) / hours
        return min(1.0, max(0.6, 0.6 + (restorative / 0.45) * 0.4))
    }
}
