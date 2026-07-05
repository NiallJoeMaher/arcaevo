import Foundation

// MARK: - User & Membership

/// A member. Mirrors the backend `User` entity (`GET /members/me`).
struct User: Codable, Identifiable, Hashable {
    let id: String
    var name: String
    var email: String
    var joinedAt: Date
    var membership: Membership

    /// Neutral placeholder for Release builds when `me()` is unavailable —
    /// carries no real member data or PII (used instead of the demo member).
    static let anonymous = User(
        id: "",
        name: "",
        email: "",
        joinedAt: Date(timeIntervalSince1970: 0),
        membership: Membership(tier: .fusion, term: .annual, cadence: .standard,
                               renewsAt: Date(timeIntervalSince1970: 0))
    )
}

/// Membership tier / term / renewal. Annual billing only in v1.
struct Membership: Codable, Hashable {
    enum Tier: String, Codable, CaseIterable {
        case fusion
        case essential
        case performance

        var displayName: String {
            switch self {
            case .fusion: return "Fusion"
            case .essential: return "Essential"
            case .performance: return "Performance"
            }
        }

        /// Verbatim launch pricing (annual only).
        var priceLine: String {
            switch self {
            case .fusion: return "€119/yr"
            case .essential: return "€329/yr"
            case .performance: return "€399/yr"
            }
        }
    }

    enum Term: String, Codable {
        case annual
    }

    enum Cadence: String, Codable {
        case standard
        case quarterly
    }

    var tier: Tier
    var term: Term
    var cadence: Cadence
    var renewsAt: Date
}

// MARK: - Test orders

/// A blood-test order (finger-prick kit or venous draw).
struct TestOrder: Codable, Identifiable, Hashable {
    enum Kind: String, Codable {
        case kit
        case venous
    }

    /// Status timeline, in order. Mirrors the mock LetsGetChecked state machine.
    enum Status: String, Codable, CaseIterable {
        case ordered
        case shipped
        case delivered
        case sampleRegistered = "sample_registered"
        case inLab = "in_lab"
        case resultsReady = "results_ready"

        var displayName: String {
            switch self {
            case .ordered: return "Ordered"
            case .shipped: return "Shipped"
            case .delivered: return "Delivered"
            case .sampleRegistered: return "Sample registered"
            case .inLab: return "In lab"
            case .resultsReady: return "Results ready"
            }
        }

        var stepIndex: Int {
            Status.allCases.firstIndex(of: self) ?? 0
        }
    }

    let id: String
    var kind: Kind
    var panel: String
    var status: Status
    var isAddOn: Bool
    var orderedAt: Date
    var updatedAt: Date
}

/// Body for `POST /orders`.
struct CreateOrderRequest: Codable {
    var kind: TestOrder.Kind
    var panel: String
    var isAddOn: Bool
}

// MARK: - Biomarkers

/// The member's personal baseline band for a marker (their normal, not population normal).
struct BaselineBand: Codable, Hashable {
    var low: Double
    var high: Double
}

/// Reference Change Value verdict — did the marker really move, beyond test noise?
/// Decided by deterministic rules on the backend; AI only narrates.
enum RCVVerdict: String, Codable, CaseIterable {
    case improved
    case noRealChange = "no_real_change"
    case worsened

    var displayName: String {
        switch self {
        case .improved: return "Improved"
        case .noRealChange: return "No real change"
        case .worsened: return "Worsened"
        }
    }
}

/// A single biomarker result (`GET /results`).
struct BiomarkerReading: Codable, Identifiable, Hashable {
    let id: String
    var code: String
    var name: String
    var panel: String
    var unit: String
    var value: Double
    var baselineBand: BaselineBand
    var rcvVerdict: RCVVerdict
    var measuredAt: Date
    /// Dr. Nolan's short human note for this reading's reviewed panel —
    /// embedded per reviewed panel on the results payload (Phase 22; the
    /// same note repeats on each reading of the panel). nil pre-review.
    var clinicianNote: ClinicianNote? = nil

    var isWithinBaseline: Bool {
        value >= baselineBand.low && value <= baselineBand.high
    }
}

// MARK: - Wearable signals

enum WearableMetric: String, Codable, CaseIterable {
    case hrv
    case restingHeartRate = "resting_heart_rate"
    case sleepHours = "sleep_hours"
    case vo2max
    // Phase 22 HealthKit expansion (ALGORITHM §1.1) — read locally for the
    // readiness/energy engines; not yet part of the backend sync contract.
    case steps
    case activeEnergy = "active_energy"
    case respiratoryRate = "respiratory_rate"
    case spo2
    case wristTemp = "wrist_temp"

    var displayName: String {
        switch self {
        case .hrv: return "HRV"
        case .restingHeartRate: return "Resting HR"
        case .sleepHours: return "Sleep"
        case .vo2max: return "VO₂ max"
        case .steps: return "Steps"
        case .activeEnergy: return "Active energy"
        case .respiratoryRate: return "Respiratory rate"
        case .spo2: return "SpO₂"
        case .wristTemp: return "Wrist temp"
        }
    }

    var unit: String {
        switch self {
        case .hrv: return "ms"
        case .restingHeartRate: return "bpm"
        case .sleepHours: return "h"
        case .vo2max: return "ml/kg/min"
        case .steps: return "steps"
        case .activeEnergy: return "kcal"
        case .respiratoryRate: return "br/min"
        case .spo2: return "%"
        case .wristTemp: return "°C"
        }
    }

    /// The v1 backend `sync/wearables` contract only accepts these four —
    /// the Phase 22 metrics stay on-device until the web schema grows.
    static let backendSynced: [WearableMetric] = [.hrv, .restingHeartRate, .sleepHours, .vo2max]
}

/// A daily wearable data point. v1 source is always `apple_health`.
struct WearableSignal: Codable, Identifiable, Hashable {
    let id: String
    var source: String
    var metric: WearableMetric
    var value: Double
    var date: Date

    init(id: String, source: String = "apple_health", metric: WearableMetric, value: Double, date: Date) {
        self.id = id
        self.source = source
        self.metric = metric
        self.value = value
        self.date = date
    }
}

// MARK: - Insights

/// A plain-language insight (`GET /insights`). Deterministic rules decide
/// the logic; AI only narrates the sentence.
struct Insight: Codable, Identifiable, Hashable {
    enum Kind: String, Codable {
        case baseline
        case experiment
        case nudge
    }

    let id: String
    var kind: Kind
    var title: String
    var body: String
    var createdAt: Date
    var relatedBiomarkers: [String]?
    /// For `experiment` insights: the change the member logged ("did it work?" loop).
    var experimentAction: String?
    /// For `experiment` insights: the RCV verdict at the follow-up test.
    var verdict: RCVVerdict?
}

// MARK: - Readiness (shared by iOS dashboard + watch ring)

/// Deterministic readiness-style score from recent wearable trends vs the
/// member's own 30-day baseline. Pure arithmetic — no AI involved.
enum Readiness {
    static func score(
        hrv: [WearableSignal],
        restingHeartRate: [WearableSignal],
        sleep: [WearableSignal]
    ) -> Int {
        var score = 70.0

        if let delta = recentDelta(hrv) {
            // Higher HRV than baseline is good: up to ±15 points.
            score += max(-15, min(15, delta * 150))
        }
        if let delta = recentDelta(restingHeartRate) {
            // Lower resting HR than baseline is good: up to ±10 points.
            score -= max(-10, min(10, delta * 200))
        }
        if let recentSleep = mean(Array(sleep.suffix(7)).map(\.value)), recentSleep >= 7 {
            score += 5
        }

        return Int(max(0, min(100, score.rounded())))
    }

    /// Relative change of the last 7 days vs the whole series baseline.
    private static func recentDelta(_ series: [WearableSignal]) -> Double? {
        let values = series.sorted { $0.date < $1.date }.map(\.value)
        guard let baseline = mean(values), baseline > 0,
              let recent = mean(Array(values.suffix(7)))
        else { return nil }
        return (recent - baseline) / baseline
    }

    private static func mean(_ values: [Double]) -> Double? {
        guard !values.isEmpty else { return nil }
        return values.reduce(0, +) / Double(values.count)
    }
}
