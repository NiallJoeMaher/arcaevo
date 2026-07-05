import Foundation

/// A bounded, decaying ceiling penalty from one out-of-range fatigue-driving
/// biomarker (ALGORITHM §1.3). Deterministic, additive, capped — blood shifts
/// the baseline ceiling and widens the band; it NEVER silently invents a
/// number and never pushes toward alarm (flagged/critical values never reach
/// this engine — they route to the clinician-first flow).
struct BiomarkerPenalty: Codable, Hashable, Identifiable {
    /// Marker code, e.g. "ferritin".
    var marker: String
    var value: Double
    var unit: String
    var testDate: Date
    /// Positive magnitude subtracted from the 100 ceiling (already decayed).
    var penalty: Int
    /// The surfaced explanation, always with value + test date.
    var note: String
    /// Inflammation (hs-CRP) also widens the confidence band (§1.3b).
    var widensBand: Bool

    var id: String { marker }

    init(
        marker: String,
        value: Double,
        unit: String,
        testDate: Date,
        penalty: Int,
        note: String,
        widensBand: Bool = false
    ) {
        self.marker = marker
        self.value = value
        self.unit = unit
        self.testDate = testDate
        self.penalty = penalty
        self.note = note
        self.widensBand = widensBand
    }

    // MARK: - Decay (§1.3): full ≤ 6 weeks, linear to zero by 26 weeks

    static let fullWeightWeeks = 6.0
    static let zeroWeightWeeks = 26.0

    /// 1.0 for a fresh draw → 0.0 at 26 weeks. A 6-week-old ferritin is
    /// weaker evidence than yesterday's HRV.
    static func decayFactor(testDate: Date, now: Date) -> Double {
        let weeks = now.timeIntervalSince(testDate) / (7 * 86_400)
        if weeks <= fullWeightWeeks { return 1 }
        if weeks >= zeroWeightWeeks { return 0 }
        return (zeroWeightWeeks - weeks) / (zeroWeightWeeks - fullWeightWeeks)
    }

    // MARK: - Rules table (§1.3 — wellness thresholds, tune with clinician)

    /// Derives the active penalties from the member's readings: latest reading
    /// per marker, the §1.3 rules table, then linear decay. Fully-decayed
    /// penalties are dropped (→ the "stale blood" honesty state).
    /// The ceiling floor (55) is applied by the engines, not here.
    static func derive(from readings: [BiomarkerReading], now: Date) -> [BiomarkerPenalty] {
        // Latest reading per marker code.
        var latest: [String: BiomarkerReading] = [:]
        for reading in readings {
            let code = reading.code.lowercased()
            if let existing = latest[code], existing.measuredAt >= reading.measuredAt { continue }
            latest[code] = reading
        }

        var penalties: [BiomarkerPenalty] = []
        for (code, reading) in latest {
            guard reading.measuredAt <= now else { continue }
            guard let rule = baseRule(code: code, value: reading.value) else { continue }
            let factor = decayFactor(testDate: reading.measuredAt, now: now)
            let decayed = Int((Double(rule.base) * factor).rounded())
            guard decayed >= 1 else { continue }
            penalties.append(
                BiomarkerPenalty(
                    marker: code,
                    value: reading.value,
                    unit: reading.unit,
                    testDate: reading.measuredAt,
                    penalty: decayed,
                    note: note(rule: rule, reading: reading),
                    widensBand: rule.widensBand
                )
            )
        }
        return penalties.sorted {
            $0.penalty != $1.penalty ? $0.penalty > $1.penalty : $0.marker < $1.marker
        }
    }

    private struct Rule {
        var base: Int
        var reason: String
        var widensBand = false
    }

    /// The §1.3 table. Ceiling penalties are "up to" values: the pronounced
    /// tier takes the full penalty, the mild tier half.
    private static func baseRule(code: String, value: Double) -> Rule? {
        switch code {
        case "ferritin": // up to −12 — "low iron caps recovery"
            if value < 45 { return Rule(base: 12, reason: "Low iron caps recovery") }
            if value < 70 { return Rule(base: 6, reason: "Iron on the low side slows recovery") }
            return nil
        case "vitamin_d", "vit_d", "25_oh_d": // up to −8 (nmol/L)
            if value < 30 { return Rule(base: 8, reason: "Low vitamin D independently causes tiredness") }
            if value < 50 { return Rule(base: 4, reason: "Vitamin D below optimal can add tiredness") }
            return nil
        case "free_t3", "ft3": // thyroid — up to −10 (pmol/L)
            if value < 3.1 || value > 6.8 { return Rule(base: 10, reason: "Thyroid affects deep sleep + energy") }
            return nil
        case "tsh": // thyroid — up to −10 (mIU/L)
            if value < 0.4 || value > 4.0 { return Rule(base: 10, reason: "Thyroid affects deep sleep + energy") }
            return nil
        case "hs_crp", "crp": // up to −8 AND widen band (mg/L)
            if value > 3 { return Rule(base: 8, reason: "Inflammation lowers recovery", widensBand: true) }
            if value > 1.5 { return Rule(base: 4, reason: "Mildly raised inflammation lowers recovery", widensBand: true) }
            return nil
        case "testosterone": // up to −8, where measured (nmol/L)
            if value < 10 { return Rule(base: 8, reason: "Low testosterone affects recovery + mood") }
            return nil
        default:
            return nil
        }
    }

    /// "Ferritin 29 µg/L, tested 2 Jul — your baseline is adjusted down until
    /// it recovers." Always value + test date; wellness tone, never alarm.
    private static func note(rule: Rule, reading: BiomarkerReading) -> String {
        let value = formatted(reading.value)
        let date = Self.dayMonth.string(from: reading.measuredAt)
        return "\(rule.reason) — \(reading.name) \(value) \(reading.unit), tested \(date). Your baseline is adjusted down until it recovers."
    }

    private static func formatted(_ value: Double) -> String {
        value == value.rounded() ? String(Int(value)) : String(format: "%.1f", value)
    }

    private static let dayMonth: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_IE")
        f.dateFormat = "d MMM"
        return f
    }()
}
