import Foundation

// MARK: - Cycle-aware baselines (ALGORITHM §3.1)
//
// Luteal-phase HRV dips and temperature rises are EXPECTED — they must not
// read as "run down". Menstrual data is GDPR Art. 9: opt-in, gated by the
// Data & privacy toggle, requested via a SEPARATE HealthKit ask (never in
// the first sheet), and never synced unless cycle-aware baselines are on.

/// Cycle phase, derived on-device from HealthKit menstrualFlow samples.
enum CyclePhase: String, Codable, CaseIterable, Hashable {
    case menstrual
    case follicular
    case ovulatory
    case luteal

    /// Contract-shape shim (`CyclePhase { phase: … }`) — both `cyclePhase`
    /// and `cyclePhase.phase` read the same value.
    var phase: CyclePhase { self }

    var displayName: String {
        switch self {
        case .menstrual: return "Menstrual"
        case .follicular: return "Follicular"
        case .ovulatory: return "Ovulatory"
        case .luteal: return "Luteal"
        }
    }

    /// Textbook phase mapping from days since the last cycle start.
    static func from(daysSinceCycleStart days: Int) -> CyclePhase {
        switch days {
        case ..<0: return .follicular
        case 0...4: return .menstrual
        case 5...12: return .follicular
        case 13...16: return .ovulatory
        default: return .luteal
        }
    }
}

/// Per-phase baseline adjustment: shift μ toward the expected phase value and
/// widen σ where within-phase variability is higher, so an expected luteal
/// HRV dip never reads as "run down" — no false alarm.
enum CycleBaselines {
    /// Returns the phase-adjusted (μ, σ) for a signal's 60-day baseline.
    /// `metric` defaults to HRV so the contract call shape
    /// `CycleBaselines.phaseAdjusted(mu:sigma:for:)` works as written.
    static func phaseAdjusted(
        mu: Double,
        sigma: Double,
        for phase: CyclePhase,
        metric: WearableMetric = .hrv
    ) -> (mu: Double, sigma: Double) {
        switch metric {
        case .hrv:
            switch phase {
            case .menstrual: return (mu * 0.97, sigma * 1.10)
            case .follicular: return (mu, sigma)
            case .ovulatory: return (mu * 1.01, sigma)
            case .luteal: return (mu * 0.93, sigma * 1.20)
            }
        case .restingHeartRate:
            switch phase {
            case .menstrual: return (mu * 1.01, sigma * 1.10)
            case .follicular: return (mu, sigma)
            case .ovulatory: return (mu * 1.01, sigma)
            case .luteal: return (mu * 1.03, sigma * 1.15)
            }
        case .wristTemp:
            switch phase {
            case .luteal: return (mu + 0.25, sigma * 1.10)
            case .menstrual, .follicular, .ovulatory: return (mu, sigma)
            }
        default:
            return (mu, sigma)
        }
    }
}

/// Shared opt-in flag for cycle-aware baselines. OFF by default; the Data &
/// privacy toggle (Wave 2b UI) and the engines both read this key.
enum CyclePreferences {
    static let defaultsKey = "arcaevo.cycleAwareBaselines"

    static var isEnabled: Bool {
        get { UserDefaults.standard.bool(forKey: defaultsKey) }
        set { UserDefaults.standard.set(newValue, forKey: defaultsKey) }
    }
}
