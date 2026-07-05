import Foundation
import XCTest

// MARK: - Deterministic fixtures for the Phase 22 engine regression suite
//
// Every test drives the engines with EXPLICIT inputs and an EXPLICIT `now` +
// UTC calendar — no wall-clock, no HealthKit, no network, no demo coupling.
// Series are built so the pure maths lands on the documented design numbers
// (readiness 71→62, band ±9, energy 68/88/15:00, impacts −11/−6/+4, …).

enum Fixture {

    /// Fixed, UTC, gregorian calendar so `startOfDay` bucketing is stable
    /// regardless of the machine's locale / timezone / DST.
    static let cal: Calendar = {
        var c = Calendar(identifier: .gregorian)
        c.timeZone = TimeZone(identifier: "UTC")!
        return c
    }()

    /// Fixed reference "now": 2024-07-03 12:00:00 UTC (midday so ± a few hours
    /// stays on the same UTC day).
    static let now = Date(timeIntervalSince1970: 1_720_008_000)

    static let day: TimeInterval = 86_400

    /// `k` whole days before `now`, keeping the 12:00 time-of-day.
    static func daysAgo(_ k: Int) -> Date {
        now.addingTimeInterval(-Double(k) * day)
    }

    static func weeksAgo(_ w: Double) -> Date {
        now.addingTimeInterval(-w * 7 * day)
    }

    /// Daily series with population mean = `mu` and population SD = `sigma`.
    /// Alternates `mu+sigma` / `mu-sigma` over an EVEN `count` (balanced), one
    /// point per day starting `startOffset` days ago. Order is irrelevant — the
    /// engine sorts and de-dupes by day.
    static func series(mu: Double, sigma: Double, count: Int, startOffset: Int = 1) -> [DailyPoint] {
        precondition(count % 2 == 0, "use an even count so mean/SD are exact")
        return (0..<count).map { i in
            DailyPoint(date: daysAgo(startOffset + i), value: i % 2 == 0 ? mu + sigma : mu - sigma)
        }
    }

    /// A biomarker reading with sensible defaults for the penalty/vitality tests.
    static func reading(
        code: String,
        value: Double,
        measuredAt: Date,
        name: String? = nil,
        unit: String = "u",
        panel: String = "Panel",
        verdict: RCVVerdict = .noRealChange,
        low: Double = 0,
        high: Double = 0
    ) -> BiomarkerReading {
        BiomarkerReading(
            id: "\(code)-\(measuredAt.timeIntervalSince1970)",
            code: code,
            name: name ?? code.capitalized,
            panel: panel,
            unit: unit,
            value: value,
            baselineBand: BaselineBand(low: low, high: high),
            rcvVerdict: verdict,
            measuredAt: measuredAt
        )
    }

    static func ferritinPenalty(penalty: Int = 12, weeksOld: Double = 0) -> BiomarkerPenalty {
        BiomarkerPenalty(
            marker: "ferritin", value: 29, unit: "µg/L",
            testDate: weeksAgo(weeksOld), penalty: penalty,
            note: "Low iron caps recovery — Ferritin 29 µg/L.", widensBand: false
        )
    }

    // MARK: Readiness input builders

    /// HRV/RHR baselines (mu 50/σ5 and mu 60/σ5, 30 balanced days) with a
    /// crafted last night giving z_hrv=+0.5 / z_rhr=+0.3 →
    /// weighted 0.42 → core = 50 + 50·0.42 = 71 (the design's wearable-only #).
    static func core71Inputs() -> (hrv: [DailyPoint], rhr: [DailyPoint]) {
        var hrv = series(mu: 50, sigma: 5, count: 30)
        var rhr = series(mu: 60, sigma: 5, count: 30)
        hrv.append(DailyPoint(date: now, value: 52.5))   // z = +0.5
        rhr.append(DailyPoint(date: now, value: 58.5))   // inverted z = +0.3
        return (hrv, rhr)
    }

    /// Series whose crafted last night yields exactly `weighted` (both z equal
    /// to `w`), so core = round(50 + 50·w). Used for decision-threshold sweeps.
    static func weightedInputs(_ w: Double) -> (hrv: [DailyPoint], rhr: [DailyPoint]) {
        var hrv = series(mu: 50, sigma: 5, count: 30)
        var rhr = series(mu: 60, sigma: 5, count: 30)
        hrv.append(DailyPoint(date: now, value: 50 + w * 5))   // z_hrv = w
        rhr.append(DailyPoint(date: now, value: 60 - w * 5))   // inverted z_rhr = w
        return (hrv, rhr)
    }
}
