import Foundation

// MARK: - RCV maths (ported from apps/web/src/lib/rcv.ts — semantics IDENTICAL)
//
// "Deterministic rules decide; AI only narrates." A change between two
// readings only counts as REAL when it exceeds the marker's RCV percentage.
// Pure functions: no I/O, no clocks, no randomness.

/// Mirrors the web `RuleDirection` union.
enum RuleDirection: String, Codable, Hashable {
    case lowerIsBetter = "lower_is_better"
    case higherIsBetter = "higher_is_better"
}

/// The client-side slice of a biomarker rule the Vitality engine needs
/// (`RcvRuleLike` + the clinician-reviewed age-offset mapping, §3).
struct BiomarkerRuleLite: Codable, Hashable {
    /// Marker code, e.g. "apob".
    var code: String
    var rcvPercent: Double
    var direction: RuleDirection
    /// Optimal (wellness) range for the age-offset mapping.
    var optimalLow: Double?
    var optimalHigh: Double?
    /// Years of age-offset at 100% relative overshoot beyond the optimal
    /// bound (clinician-reviewed weight; deterministic).
    var yearsWeight: Double

    init(
        code: String,
        rcvPercent: Double,
        direction: RuleDirection,
        optimalLow: Double? = nil,
        optimalHigh: Double? = nil,
        yearsWeight: Double = 1
    ) {
        self.code = code
        self.rcvPercent = rcvPercent
        self.direction = direction
        self.optimalLow = optimalLow
        self.optimalHigh = optimalHigh
        self.yearsWeight = yearsWeight
    }

    /// Deterministic client defaults for the age-associated markers (§3
    /// blood anchor) — used when the backend rule table isn't loaded.
    /// Values mirror the seeded web rules' spirit; tune with clinician.
    static let defaults: [BiomarkerRuleLite] = [
        BiomarkerRuleLite(code: "apob", rcvPercent: 10.6, direction: .lowerIsBetter, optimalLow: 0.6, optimalHigh: 1.0, yearsWeight: 3.0),
        BiomarkerRuleLite(code: "hba1c", rcvPercent: 4.5, direction: .lowerIsBetter, optimalLow: 4.8, optimalHigh: 5.4, yearsWeight: 2.5),
        BiomarkerRuleLite(code: "hs_crp", rcvPercent: 46, direction: .lowerIsBetter, optimalLow: 0, optimalHigh: 1.0, yearsWeight: 1.0),
        BiomarkerRuleLite(code: "vitamin_d", rcvPercent: 16, direction: .higherIsBetter, optimalLow: 50, optimalHigh: 125, yearsWeight: 0.8),
        BiomarkerRuleLite(code: "ferritin", rcvPercent: 15, direction: .higherIsBetter, optimalLow: 45, optimalHigh: 150, yearsWeight: 1.7),
    ]
}

/// Pure RCV verdict + baseline-band maths. Keep in lockstep with
/// `apps/web/src/lib/rcv.ts` — including the INCLUSIVE RCV boundary
/// (|Δ%| ≤ rcv → no real change) and the zero-prior guard.
enum RcvMath {

    /// Percent change from `prior` to `current`. 0 when prior is 0.
    static func percentChange(prior: Double, current: Double) -> Double {
        if prior == 0 { return 0 } // zero-prior guard
        return ((current - prior) / abs(prior)) * 100
    }

    /// - |Δ%| ≤ rcvPercent          → .noRealChange (inclusive boundary)
    /// - Δ beneficial per direction → .improved
    /// - otherwise                  → .worsened
    static func computeRcvVerdict(
        prior: Double,
        current: Double,
        rcvPercent: Double,
        direction: RuleDirection
    ) -> RCVVerdict {
        let delta = percentChange(prior: prior, current: current)
        if abs(delta) <= rcvPercent { return .noRealChange }
        let movedDown = delta < 0
        let beneficial = direction == .lowerIsBetter ? movedDown : !movedDown
        return beneficial ? .improved : .worsened
    }

    static func computeRcvVerdict(prior: Double, current: Double, rule: BiomarkerRuleLite) -> RCVVerdict {
        computeRcvVerdict(prior: prior, current: current, rcvPercent: rule.rcvPercent, direction: rule.direction)
    }

    /// Band = mean ± RCV%: values inside are indistinguishable from the
    /// member's own baseline. nil for an empty series.
    static func computeBaselineBand(series: [Double], rcvPercent: Double) -> BaselineBand? {
        guard !series.isEmpty else { return nil }
        let mean = series.reduce(0, +) / Double(series.count)
        let margin = abs(mean) * (rcvPercent / 100)
        return BaselineBand(low: round2(mean - margin), high: round2(mean + margin))
    }

    /// Is a value inside a baseline band (inclusive)?
    static func isWithinBand(value: Double, band: BaselineBand) -> Bool {
        value >= band.low && value <= band.high
    }

    /// JS `Math.round(n*100)/100` parity (half rounds toward +∞, so negative
    /// halves match the web exactly).
    static func round2(_ n: Double) -> Double {
        (n * 100 + 0.5).rounded(.down) / 100
    }
}

// MARK: - Vitality Age (ALGORITHM §3 — the slow score)

/// Recent wearable trends that move the number BETWEEN draws, weighted lower
/// than blood. Daily points, oldest first.
struct WearableTrends {
    var vo2max: [DailyPoint]
    var rhr: [DailyPoint]

    init(vo2max: [DailyPoint] = [], rhr: [DailyPoint] = []) {
        self.vo2max = vo2max
        self.rhr = rhr
    }
}

/// One driver row ("VO₂max 41.2 · −1.9 yrs", "Ferritin 29 µg/L · +0.6 yrs ·
/// holding it back").
struct VitalityDriver: Codable, Hashable, Identifiable {
    /// Code, e.g. "apob", "vo2max".
    var marker: String
    /// Display label with the value, e.g. "ApoB 0.94 g/L".
    var label: String
    /// Signed age-offset (negative = younger).
    var years: Double
    var note: String
    /// The "+x yrs · holding it back" marker — the SAME marker capping
    /// readiness, so the two surfaces tell one story.
    var holdingBack: Bool

    var id: String { marker }
}

/// The monthly banded number. Never a decimal-point age on the surface; the
/// ±band is always shown.
struct VitalityScore: Codable, Hashable {
    var age: Int
    /// ± band (always 2 — "29 ±2").
    var band: Int
    var drivers: [VitalityDriver]
    /// True when RCV gating held at least one blood driver in place this
    /// month (its latest change was within test noise, so it didn't move).
    var rcvGated: Bool
    /// The month this score belongs to (recomputed monthly, never daily).
    var month: Date

    init(age: Int, band: Int = 2, drivers: [VitalityDriver], rcvGated: Bool, month: Date) {
        self.age = age
        self.band = band
        self.drivers = drivers
        self.rcvGated = rcvGated
        self.month = month
    }
}

enum VitalityEngine {

    static let band = 2
    /// Wearable drift is weighted lower than blood (§3).
    static let wearableWeight = 0.5

    /// Monthly Vitality Age. RCV-gated: a blood driver only moves when its
    /// change beats that user's own test-noise threshold — otherwise the
    /// previous RCV-significant value keeps anchoring it (the number does
    /// not move on noise).
    static func compute(
        readings: [BiomarkerReading],
        rules: [BiomarkerRuleLite],
        wearables: WearableTrends,
        calendarAge: Int,
        month: Date
    ) -> VitalityScore {
        var drivers: [VitalityDriver] = []
        var gatedAny = false

        // --- Blood anchor, per rule (only readings up to the scored month).
        for rule in rules {
            let series = readings
                .filter { $0.code.lowercased() == rule.code && $0.measuredAt <= month }
                .sorted { $0.measuredAt < $1.measuredAt }
            guard var anchor = series.first else { continue }

            // Walk the series: the anchor only advances on RCV-significant
            // change (reuse of the platform's verdict engine, §3).
            for reading in series.dropFirst() {
                if RcvMath.computeRcvVerdict(prior: anchor.value, current: reading.value, rule: rule) != .noRealChange {
                    anchor = reading
                } else {
                    gatedAny = true
                }
            }

            let years = ageOffset(value: anchor.value, rule: rule)
            guard abs(years) >= 0.05 else { continue }
            let rounded = (years * 10).rounded() / 10
            let holdingBack = rounded > 0
            drivers.append(VitalityDriver(
                marker: rule.code,
                label: "\(anchor.name) \(trimmed(anchor.value)) \(anchor.unit)",
                years: rounded,
                note: holdingBack ? "holding it back" : "real change — pulling it down",
                holdingBack: holdingBack
            ))
        }

        // --- Wearable drift between draws (VO₂max, RHR) — lower weight.
        if let vo2 = recentMean(wearables.vo2max) {
            let years = ReadinessEngine.clamp((38 - vo2) / 4, -2, 2)
            let rounded = (years * wearableWeight * 10).rounded() / 10
            if abs(rounded) >= 0.05 {
                drivers.append(VitalityDriver(
                    marker: "vo2max",
                    label: "VO₂max \(trimmed(vo2))",
                    years: rounded,
                    note: rounded < 0 ? "did the lifting" : "room to build",
                    holdingBack: rounded > 0
                ))
            }
        }
        if let rhr = recentMean(wearables.rhr) {
            let years = ReadinessEngine.clamp((rhr - 60) / 12, -1.5, 1.5)
            let rounded = (years * wearableWeight * 10).rounded() / 10
            if abs(rounded) >= 0.05 {
                drivers.append(VitalityDriver(
                    marker: "rhr",
                    label: "Resting HR \(trimmed(rhr))",
                    years: rounded,
                    note: rounded < 0 ? "steadily lower than age-typical" : "drifting up",
                    holdingBack: rounded > 0
                ))
            }
        }

        drivers.sort { abs($0.years) > abs($1.years) }
        let offset = drivers.map(\.years).reduce(0, +)
        let age = max(18, calendarAge + Int(offset.rounded()))

        return VitalityScore(
            age: age,
            band: band,
            drivers: drivers,
            rcvGated: gatedAny,
            month: month
        )
    }

    /// Age offset from an anchored blood value: relative overshoot beyond the
    /// nearest optimal bound × the clinician-reviewed weight, capped at ±2
    /// years per marker. Inside the optimal range → 0. Beyond the GOOD side
    /// counts younger at half weight.
    static func ageOffset(value: Double, rule: BiomarkerRuleLite) -> Double {
        guard let low = rule.optimalLow, let high = rule.optimalHigh, high > 0 else { return 0 }
        if value >= low && value <= high {
            return 0
        }
        if value > high {
            let overshoot = (value - high) / high
            let years = min(1, overshoot) * rule.yearsWeight
            // Above range: bad for lower-is-better, good (half weight) otherwise.
            return rule.direction == .lowerIsBetter ? min(2, years) : max(-2, -years * 0.5)
        } else {
            let reference = low > 0 ? low : max(high, 1)
            let undershoot = (low - value) / reference
            let years = min(1, undershoot) * rule.yearsWeight
            // Below range: bad for higher-is-better, good (half weight) otherwise.
            return rule.direction == .higherIsBetter ? min(2, years) : max(-2, -years * 0.5)
        }
    }

    private static func recentMean(_ points: [DailyPoint]) -> Double? {
        let recent = points.suffix(30).map(\.value)
        guard !recent.isEmpty else { return nil }
        return recent.reduce(0, +) / Double(recent.count)
    }

    private static func trimmed(_ value: Double) -> String {
        if value == value.rounded() { return String(Int(value)) }
        var text = String(format: "%.2f", value)
        while text.hasSuffix("0") { text.removeLast() }
        if text.hasSuffix(".") { text.removeLast() }
        return text
    }
}
