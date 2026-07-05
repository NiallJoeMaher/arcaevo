import Foundation

/// Seeded, plausible demo data used whenever the local API is unreachable
/// (or HealthKit has nothing to give), so the app always demos.
/// Everything here is deterministic — same data every launch.
enum DemoDataProvider {

    static var calendar: Calendar { Calendar.current }

    /// Internal so the Phase 22 demo-data extension can share the anchor.
    static func daysAgo(_ days: Int) -> Date {
        calendar.date(byAdding: .day, value: -days, to: calendar.startOfDay(for: Date())) ?? Date()
    }

    // MARK: - Member

    static func user() -> User {
        User(
            id: "demo-member-1",
            name: "Aoife Byrne",
            email: "aoife@example.com",
            joinedAt: daysAgo(190),
            membership: Membership(
                tier: .essential,
                term: .annual,
                cadence: .standard,
                renewsAt: daysAgo(-175) // ~6 months out
            )
        )
    }

    // MARK: - Blood results

    /// The July panel. Tells ONE story with the readiness/energy/vitality
    /// demo (Phase 22): ferritin 29 µg/L under the personal 38–52 band is the
    /// blood-recalibration driver (71 → 62), and Dr. Nolan's clinician note
    /// rides on every reading of the reviewed panel.
    static func results() -> [BiomarkerReading] {
        let measured = daysAgo(18)
        let note = clinicianNote()
        return [
            // Metabolic
            reading("hba1c", "HbA1c", panel: "Metabolic", unit: "%", value: 5.2, band: 5.1...5.5, verdict: .improved, at: measured),
            reading("glucose_fasting", "Fasting glucose", panel: "Metabolic", unit: "mmol/L", value: 4.9, band: 4.6...5.3, verdict: .noRealChange, at: measured),
            reading("triglycerides", "Triglycerides", panel: "Metabolic", unit: "mmol/L", value: 1.1, band: 0.8...1.3, verdict: .noRealChange, at: measured),

            // Lipids
            reading("apob", "ApoB", panel: "Lipids", unit: "g/L", value: 0.98, band: 0.78...0.92, verdict: .worsened, at: measured),
            reading("ldl_c", "LDL cholesterol", panel: "Lipids", unit: "mmol/L", value: 3.1, band: 2.6...3.0, verdict: .worsened, at: measured),
            reading("hdl_c", "HDL cholesterol", panel: "Lipids", unit: "mmol/L", value: 1.6, band: 1.4...1.7, verdict: .noRealChange, at: measured),

            // Inflammation
            reading("hs_crp", "hs-CRP", panel: "Inflammation", unit: "mg/L", value: 0.7, band: 0.5...1.2, verdict: .improved, at: measured),

            // Vitamins & hormones
            reading("vitamin_d", "Vitamin D", panel: "Vitamins & Hormones", unit: "nmol/L", value: 82, band: 68...95, verdict: .improved, at: measured),
            reading("ferritin", "Ferritin", panel: "Vitamins & Hormones", unit: "µg/L", value: 29, band: 38...52, verdict: .worsened, at: measured),
            reading("tsh", "TSH", panel: "Vitamins & Hormones", unit: "mIU/L", value: 1.8, band: 1.4...2.2, verdict: .noRealChange, at: measured),
        ].map { r in
            var withNote = r
            withNote.clinicianNote = note
            return withNote
        }
    }

    private static func reading(
        _ code: String,
        _ name: String,
        panel: String,
        unit: String,
        value: Double,
        band: ClosedRange<Double>,
        verdict: RCVVerdict,
        at date: Date
    ) -> BiomarkerReading {
        BiomarkerReading(
            id: "demo-\(code)",
            code: code,
            name: name,
            panel: panel,
            unit: unit,
            value: value,
            baselineBand: BaselineBand(low: band.lowerBound, high: band.upperBound),
            rcvVerdict: verdict,
            measuredAt: date
        )
    }

    // MARK: - Insights

    static func insights() -> [Insight] {
        [
            Insight(
                id: "demo-insight-1",
                kind: .baseline,
                title: "Your recovery is trending above your baseline",
                body: "Over the last two weeks your HRV has sat about 6% above your own 30-day baseline, and your resting heart rate is a beat lower. Your body is handling your current training and sleep routine well — a good window to keep things steady.",
                createdAt: daysAgo(2),
                relatedBiomarkers: nil,
                experimentAction: nil,
                verdict: nil
            ),
            Insight(
                id: "demo-insight-2",
                kind: .experiment,
                title: "Did it work? Your evening walks — yes.",
                body: "You logged \u{201C}20-minute walk after dinner\u{201D} nine weeks ago. At your latest test, HbA1c moved from 5.5% to 5.2% — a change bigger than test noise for this marker. That counts as a real improvement against your own baseline.",
                createdAt: daysAgo(18),
                relatedBiomarkers: ["hba1c"],
                experimentAction: "20-minute walk after dinner",
                verdict: .improved
            ),
            Insight(
                id: "demo-insight-3",
                kind: .nudge,
                title: "ApoB drifted above your baseline band",
                body: "Your ApoB came back at 0.98 g/L, just above your personal band. One reading isn\u{2019}t a trend — your recheck in the spring will tell us if it\u{2019}s real. In the meantime, fibre at breakfast is the simplest lever most people can pull.",
                createdAt: daysAgo(17),
                relatedBiomarkers: ["apob"],
                experimentAction: nil,
                verdict: nil
            ),
        ]
    }

    // MARK: - Orders

    static func orders() -> [TestOrder] {
        [
            TestOrder(
                id: "demo-order-2",
                kind: .kit,
                panel: "Recheck panel",
                status: .inLab,
                isAddOn: false,
                orderedAt: daysAgo(9),
                updatedAt: daysAgo(1)
            ),
            TestOrder(
                id: "demo-order-1",
                kind: .kit,
                panel: "Full baseline panel",
                status: .resultsReady,
                isAddOn: false,
                orderedAt: daysAgo(120),
                updatedAt: daysAgo(108)
            ),
        ]
    }

    /// Local stand-in for `POST /orders` when the API is unreachable.
    static func createOrder(_ request: CreateOrderRequest) -> TestOrder {
        TestOrder(
            id: "demo-order-\(UUID().uuidString.prefix(8))",
            kind: request.kind,
            panel: request.panel,
            status: .ordered,
            isAddOn: request.isAddOn,
            orderedAt: Date(),
            updatedAt: Date()
        )
    }

    // MARK: - Wearable series (seeded, deterministic)

    /// Plausible daily series for the last `days` days. Seeded per metric so
    /// every run of the demo shows the same story: gently improving HRV,
    /// gently falling resting HR, decent sleep, slowly climbing VO₂ max.
    static func wearableSeries(metric: WearableMetric, days: Int = 30) -> [WearableSignal] {
        var rng = SeededGenerator(seed: seed(for: metric))
        var signals: [WearableSignal] = []
        signals.reserveCapacity(days)

        for offset in stride(from: days - 1, through: 0, by: -1) {
            let progress = Double(days - 1 - offset) / Double(max(days - 1, 1)) // 0 → 1 over the window
            let noise = Double.random(in: -1...1, using: &rng)
            let weekly = sin(Double(offset) * .pi / 3.5) // gentle weekly rhythm

            let value: Double
            switch metric {
            case .hrv:
                value = 52 + progress * 5 + weekly * 2.5 + noise * 3.5
            case .restingHeartRate:
                value = 58 - progress * 2.5 + weekly * 1.2 + noise * 1.4
            case .sleepHours:
                value = 7.2 + weekly * 0.4 + noise * 0.5
            case .vo2max:
                value = 41.5 + progress * 1.2 + noise * 0.4
            case .steps:
                value = (8600 + progress * 700 + weekly * 1100 + noise * 1300).rounded()
            case .activeEnergy:
                value = (540 + progress * 50 + weekly * 85 + noise * 100).rounded()
            case .respiratoryRate:
                value = 14.1 + weekly * 0.3 + noise * 0.4
            case .spo2:
                value = min(99.4, 97.3 + weekly * 0.3 + noise * 0.5)
            case .wristTemp:
                value = 35.9 + weekly * 0.1 + noise * 0.15
            }

            let date = daysAgo(offset)
            signals.append(
                WearableSignal(
                    id: "demo-\(metric.rawValue)-\(offset)",
                    metric: metric,
                    value: (value * 10).rounded() / 10,
                    date: date
                )
            )
        }
        return signals
    }

    private static func seed(for metric: WearableMetric) -> UInt64 {
        switch metric {
        case .hrv: return 101
        case .restingHeartRate: return 202
        case .sleepHours: return 303
        case .vo2max: return 404
        case .steps: return 505
        case .activeEnergy: return 606
        case .respiratoryRate: return 707
        case .spo2: return 808
        case .wristTemp: return 909
        }
    }
}

/// Small deterministic PRNG (splitmix64) so demo series are stable.
struct SeededGenerator: RandomNumberGenerator {
    private var state: UInt64

    init(seed: UInt64) {
        state = seed &+ 0x9E37_79B9_7F4A_7C15
    }

    mutating func next() -> UInt64 {
        state = state &+ 0x9E37_79B9_7F4A_7C15
        var z = state
        z = (z ^ (z >> 30)) &* 0xBF58_476D_1CE4_E5B9
        z = (z ^ (z >> 27)) &* 0x94D0_49BB_1331_11EB
        return z ^ (z >> 31)
    }
}
