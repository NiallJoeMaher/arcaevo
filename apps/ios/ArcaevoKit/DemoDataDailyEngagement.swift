import Foundation

// MARK: - Phase 22 demo data — the daily-engagement layer
//
// Deterministic series + the design's blood-recalibration story so every new
// screen renders instantly offline:
//   · readiness 71 wearable-only → 62 blood-recalibrated (ferritin 29 µg/L,
//     tested 2 Jul, −12 ceiling → 88, band ±9, "Go easy today.")
//   · energy started at 68, not 100 (6.2h short sleep × ceiling 88), 15:00 dip
//   · behaviour impacts: Alcohol −11 · Late meal −6 · Evening walk +4
//   · Vitality 29 ±2 vs calendar 35, ferritin "+0.6 yrs · holding it back"

extension DemoDataProvider {

    // MARK: Readiness series (60-day, crafted last night → core exactly 71)

    /// 60 daily points: 59 seeded baseline days + a crafted last night at
    /// z_hrv = +0.5 / z_rhr = +0.3, so
    /// core = 50 + 50·(0.6·0.5 + 0.4·0.3) = 71 — the design's wearable-only
    /// number. With the ferritin −12 penalty (ceiling 88) the engine lands on
    /// the design's blood-recalibrated 62.
    static func readinessDailyPoints(metric: WearableMetric) -> [DailyPoint] {
        let baselineDays = 59
        var rng = SeededGenerator(seed: metric == .hrv ? 1101 : 1202)
        var points: [DailyPoint] = []
        for offset in stride(from: baselineDays, through: 1, by: -1) {
            let noise = Double.random(in: -1...1, using: &rng)
            let weekly = sin(Double(offset) * .pi / 3.5)
            let value: Double
            switch metric {
            case .hrv: value = 54 + weekly * 2.5 + noise * 3.5
            case .restingHeartRate: value = 57 + weekly * 1.2 + noise * 1.4
            default: value = 0
            }
            points.append(DailyPoint(date: daysAgo(offset), value: (value * 10).rounded() / 10))
        }

        // Crafted last night: μ + 0.5σ HRV (good side), μ − 0.3σ RHR (good side).
        let values = points.map(\.value)
        let (mu, sigma) = ReadinessEngine.meanAndSD(values)
        let lastNight: Double
        switch metric {
        case .hrv: lastNight = mu + 0.5 * sigma
        case .restingHeartRate: lastNight = mu - 0.3 * sigma
        default: lastNight = mu
        }
        points.append(DailyPoint(date: daysAgo(0), value: lastNight))
        return points
    }

    // MARK: Blood-recalibrated results (the July panel, ferritin 29)

    /// The demo July panel with the recalibration story: ferritin 29 µg/L
    /// (personal band 38–52, tested 2 Jul per the design) plus healthy
    /// companions, and Dr. Nolan's note on the reviewed panel.
    static func recalibrationReadings() -> [BiomarkerReading] {
        let tested = daysAgo(2) // "tested 2 Jul" in the design's 4 Jul frame
        let note = clinicianNote()
        func withNote(_ reading: BiomarkerReading) -> BiomarkerReading {
            var r = reading
            r.clinicianNote = note
            return r
        }
        return [
            withNote(BiomarkerReading(
                id: "demo-recal-ferritin", code: "ferritin", name: "Ferritin",
                panel: "Vitamins & Hormones", unit: "µg/L", value: 29,
                baselineBand: BaselineBand(low: 38, high: 52),
                rcvVerdict: .worsened, measuredAt: tested
            )),
            withNote(BiomarkerReading(
                id: "demo-recal-apob", code: "apob", name: "ApoB",
                panel: "Lipids", unit: "g/L", value: 0.94,
                baselineBand: BaselineBand(low: 0.78, high: 0.98),
                rcvVerdict: .improved, measuredAt: tested
            )),
            withNote(BiomarkerReading(
                id: "demo-recal-hscrp", code: "hs_crp", name: "hs-CRP",
                panel: "Inflammation", unit: "mg/L", value: 0.7,
                baselineBand: BaselineBand(low: 0.5, high: 1.2),
                rcvVerdict: .improved, measuredAt: tested
            )),
            withNote(BiomarkerReading(
                id: "demo-recal-vitd", code: "vitamin_d", name: "Vitamin D",
                panel: "Vitamins & Hormones", unit: "nmol/L", value: 82,
                baselineBand: BaselineBand(low: 68, high: 95),
                rcvVerdict: .improved, measuredAt: tested
            )),
            withNote(BiomarkerReading(
                id: "demo-recal-tsh", code: "tsh", name: "TSH",
                panel: "Vitamins & Hormones", unit: "mIU/L", value: 1.8,
                baselineBand: BaselineBand(low: 1.4, high: 2.2),
                rcvVerdict: .noRealChange, measuredAt: tested
            )),
        ]
    }

    /// Dr. Nolan's panel note — verbatim from the design's results screen.
    static func clinicianNote() -> ClinicianNote {
        ClinicianNote(
            text: "Nothing here worries me. The walks are clearly working — keep them exactly as they are. Ferritin is the one to feed: food first, recheck in January.",
            clinicianName: "Dr. Nolan",
            imcNumber: "412887",
            readAt: daysAgo(1),
            panelKey: "july-2026",
            orderId: "demo-order-2"
        )
    }

    // MARK: Sleep, workouts, vitals

    /// Last night is the design's short night: 6.2 h (deep 1.1 / REM 1.7 /
    /// core 3.4, 2 awakenings) → with ceiling 88 the energy day starts at 68.
    static func sleepNights(days: Int = 30) -> [SleepNight] {
        var rng = SeededGenerator(seed: 1303)
        var nights: [SleepNight] = []
        for offset in stride(from: days - 1, through: 1, by: -1) {
            let noise = Double.random(in: -1...1, using: &rng)
            let hours = max(5.6, min(8.4, 7.2 + sin(Double(offset) * .pi / 3.5) * 0.4 + noise * 0.5))
            nights.append(SleepNight(
                date: daysAgo(offset),
                hours: (hours * 10).rounded() / 10,
                deep: ((hours * 0.17) * 10).rounded() / 10,
                rem: ((hours * 0.24) * 10).rounded() / 10,
                core: ((hours * 0.55) * 10).rounded() / 10,
                awakenings: Int((noise + 1) * 1.5)
            ))
        }
        nights.append(SleepNight(date: daysAgo(0), hours: 6.2, deep: 1.1, rem: 1.7, core: 3.4, awakenings: 2))
        return nights
    }

    static func workouts(days: Int = 14) -> [WorkoutSummary] {
        var rng = SeededGenerator(seed: 1404)
        var workouts: [WorkoutSummary] = []
        for offset in stride(from: days - 1, through: 0, by: -1) {
            let noise = Double.random(in: -1...1, using: &rng)
            let day = daysAgo(offset)
            switch offset % 4 {
            case 0: // easy evening walk (today included → the 3.1 load story)
                workouts.append(WorkoutSummary(
                    type: "Walk", minutes: 35 + Int(noise * 5), avgHR: 104, maxHR: 121,
                    kcal: 160, date: calendar.date(byAdding: .hour, value: 8, to: day) ?? day
                ))
            case 1:
                workouts.append(WorkoutSummary(
                    type: "Run", minutes: 42 + Int(noise * 6), avgHR: 152, maxHR: 178,
                    kcal: 430, date: calendar.date(byAdding: .hour, value: 7, to: day) ?? day
                ))
            case 2:
                workouts.append(WorkoutSummary(
                    type: "Strength", minutes: 48 + Int(noise * 6), avgHR: 118, maxHR: 152,
                    kcal: 300, date: calendar.date(byAdding: .hour, value: 18, to: day) ?? day
                ))
            default:
                break // rest day
            }
        }
        return workouts
    }

    static func vitalsSnapshot() -> VitalsSnapshot {
        VitalsSnapshot(
            respiratoryRate: wearableSeries(metric: .respiratoryRate, days: 30).dailyPoints,
            spo2: wearableSeries(metric: .spo2, days: 30).dailyPoints,
            wristTemp: wearableSeries(metric: .wristTemp, days: 30).dailyPoints
        )
    }

    /// Today's energy inputs → the design curve (start 68, ceiling 88 with
    /// the ferritin penalty, 15:00 dip).
    static func energyInputs() -> EnergyInputs {
        EnergyInputs(
            sleepLastNight: sleepNights().last,
            wakeHour: 7,
            workoutsToday: workouts().filter { calendar.isDate($0.date, inSameDayAs: Date()) },
            learnedDipHour: 15
        )
    }

    // MARK: Felt check-ins + behaviour impacts (design: −11 / −6 / +4)

    /// Three weeks of check-ins: Alcohol ×3, Late meal ×3, Evening walk ×5,
    /// plus untagged control days — each ≥ the n≥3 surfacing rule.
    static func feltCheckins() -> [FeltCheckin] {
        func checkin(_ daysBack: Int, feel: Int, tags: [String] = []) -> FeltCheckin {
            FeltCheckin(date: daysAgo(daysBack), feel: feel, tags: tags)
        }
        return [
            checkin(21, feel: 4),
            checkin(20, feel: 3, tags: ["Alcohol"]),
            checkin(19, feel: 3),
            checkin(18, feel: 4, tags: ["Evening walk"]),
            checkin(17, feel: 3, tags: ["Late meal"]),
            checkin(16, feel: 4),
            checkin(15, feel: 4, tags: ["Evening walk"]),
            checkin(14, feel: 2, tags: ["Alcohol"]),
            checkin(13, feel: 3),
            checkin(12, feel: 4, tags: ["Evening walk"]),
            checkin(11, feel: 3, tags: ["Late meal"]),
            checkin(10, feel: 4),
            checkin(9, feel: 4, tags: ["Evening walk"]),
            checkin(8, feel: 2, tags: ["Alcohol"]),
            checkin(7, feel: 3),
            checkin(6, feel: 3, tags: ["Late meal"]),
            checkin(5, feel: 4, tags: ["Evening walk"]),
            checkin(4, feel: 4),
        ]
    }

    /// Daily scores aligned with `feltCheckins()` so the impact model lands
    /// exactly on the design's own-history numbers: next-day delta −11 after
    /// Alcohol, −6 after Late meal, +4 after Evening walk, 0 on control days.
    /// Built cumulatively so EVERY day's next-day delta is exactly its
    /// check-in target (no contamination between consecutive tagged days).
    static func behaviourDatedScores() -> [DatedScore] {
        var targetDelta: [Int: Int] = [:] // keyed by the check-in day's daysBack
        for checkin in feltCheckins() {
            let daysBack = calendar.dateComponents(
                [.day],
                from: calendar.startOfDay(for: checkin.date),
                to: calendar.startOfDay(for: Date())
            ).day ?? 0
            if checkin.tags.contains("Alcohol") { targetDelta[daysBack] = -11 }
            else if checkin.tags.contains("Late meal") { targetDelta[daysBack] = -6 }
            else if checkin.tags.contains("Evening walk") { targetDelta[daysBack] = 4 }
            else { targetDelta[daysBack] = 0 }
        }
        var scores: [DatedScore] = []
        var score = 78
        for daysBack in stride(from: 22, through: 0, by: -1) {
            scores.append(DatedScore(date: daysAgo(daysBack), score: score))
            score += targetDelta[daysBack] ?? 0
        }
        return scores
    }

    /// Learned wake time samples (~07:05) for WakeTimeModel.
    static func sleepEnds(days: Int = 14) -> [Date] {
        var rng = SeededGenerator(seed: 1505)
        return (1...days).compactMap { offset in
            let jitter = Int(Double.random(in: -1...1, using: &rng) * 14)
            return calendar.date(byAdding: .minute, value: 7 * 60 + 5 + jitter, to: daysAgo(offset))
        }
    }

    // MARK: Vitality (design story: 29 ±2 vs calendar 35)

    /// The design's Vitality screen, verbatim: RCV-gated drivers with VO₂max
    /// doing the lifting and ferritin holding it back — the same marker that
    /// caps readiness, so both surfaces tell one story.
    static func vitalityScore() -> VitalityScore {
        let month = calendar.date(from: calendar.dateComponents([.year, .month], from: Date())) ?? Date()
        return VitalityScore(
            age: 29,
            band: 2,
            drivers: [
                VitalityDriver(marker: "vo2max", label: "VO₂max 41.2", years: -1.9, note: "did the lifting", holdingBack: false),
                VitalityDriver(marker: "apob", label: "ApoB 0.94 g/L", years: -1.2, note: "real change — pulling it down", holdingBack: false),
                VitalityDriver(marker: "rhr", label: "Resting HR 54", years: -0.9, note: "steadily lower than age-typical", holdingBack: false),
                VitalityDriver(marker: "ferritin", label: "Ferritin 29 µg/L", years: 0.6, note: "holding it back", holdingBack: true),
            ],
            rcvGated: true,
            month: month
        )
    }

    /// The €69 recheck — the only sell (maps to the add-on order path).
    static func recheckOrder() -> RecheckOrder {
        RecheckOrder(markerId: "ferritin", experimentId: "demo-exp-iron")
    }
}
