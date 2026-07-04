import Foundation

/// The flagship daily readiness score (ALGORITHM §1). Pure and deterministic:
/// same inputs → same output. Locked at wake by the caller (compute once from
/// the overnight read; don't recompute through the day).
///
/// Blood does exactly two things (§1.3): it lowers the achievable ceiling by
/// bounded, decaying penalties, and it widens the confidence band. It never
/// invents a number, and it can never drag the score below 55 (the floor —
/// "never reads alarmist"). Wearable-only lows below 55 remain possible; blood
/// just can't be the reason.
enum ReadinessEngine {

    static let calibrationDays = 28
    /// Historical bloods anchor the baseline biologically, shortening the
    /// purely-statistical calibration window (§1.2).
    static let calibrationDaysWithBloods = 14
    static let ceilingFloor = 55
    static let hrvWeight = 0.6
    static let rhrWeight = 0.4
    static let baseBand = 3

    // MARK: - Main compute

    static func compute(
        hrv: [DailyPoint],
        rhr: [DailyPoint],
        vitals: VitalsSnapshot?,
        penalties: [BiomarkerPenalty],
        felt: FeltCheckin?,
        cyclePhase: CyclePhase?,
        calendar: Calendar = .current,
        now: Date = Date()
    ) -> ReadinessResult {
        let hrvDays = dedupedByDay(hrv, calendar: calendar, before: now)
        let rhrDays = dedupedByDay(rhr, calendar: calendar, before: now)

        // --- §6 Calibrating: < 28 days of overnight HRV/RHR (14 with bloods).
        let observedDays = min(hrvDays.count, rhrDays.count)
        let neededDays = penalties.isEmpty ? calibrationDays : calibrationDaysWithBloods
        let calibrating = observedDays < neededDays

        // --- §6 Sparse night: no overnight read for last night — never interpolate.
        let lastNightCutoff = now.addingTimeInterval(-36 * 3600)
        let hrvLastNight = hrvDays.last.flatMap { $0.date >= lastNightCutoff ? $0 : nil }
        let rhrLastNight = rhrDays.last.flatMap { $0.date >= lastNightCutoff ? $0 : nil }
        let sparseNight = hrvLastNight == nil || rhrLastNight == nil

        // --- §1.2 60-day baseline (μ, σ) per signal, EXCLUDING last night.
        let hrvBaselinePoints = baselineWindow(hrvDays, excluding: hrvLastNight, calendar: calendar, now: now)
        let rhrBaselinePoints = baselineWindow(rhrDays, excluding: rhrLastNight, calendar: calendar, now: now)
        var (muHrv, sigmaHrv) = meanAndSD(hrvBaselinePoints.map(\.value))
        var (muRhr, sigmaRhr) = meanAndSD(rhrBaselinePoints.map(\.value))

        // --- §3.1 Cycle-aware baselines (opt-in): expected luteal dip ≠ run down.
        if let phase = cyclePhase {
            (muHrv, sigmaHrv) = CycleBaselines.phaseAdjusted(mu: muHrv, sigma: sigmaHrv, for: phase, metric: .hrv)
            (muRhr, sigmaRhr) = CycleBaselines.phaseAdjusted(mu: muRhr, sigma: sigmaRhr, for: phase, metric: .restingHeartRate)
        }

        // --- Acute z-scores (RHR inverted — higher RHR = worse).
        let lastHrv = (hrvLastNight ?? hrvDays.last)?.value
        let lastRhr = (rhrLastNight ?? rhrDays.last)?.value
        let zHrv = zScore(value: lastHrv, mu: muHrv, sigma: sigmaHrv)
        let zRhr = zScore(value: lastRhr.map { muRhr + (muRhr - $0) }, mu: muRhr, sigma: sigmaRhr)

        // core = 50 + 50 · clamp(w_hrv·z_hrv + w_rhr·z_rhr, −1, +1)
        let weighted = clamp(hrvWeight * zHrv + rhrWeight * zRhr, -1, 1)
        let core = Int((50 + 50 * weighted).rounded())

        // --- §1.3(a) Blood shifts the ceiling: 100 − Σ penalties, floor 55.
        let penaltySum = penalties.map(\.penalty).reduce(0, +)
        let ceiling = max(ceilingFloor, 100 - penaltySum)

        // Recalibrated score: the core rescaled into the blood-capped range
        // (reproduces the design's 71 → 62 with a −12 ferritin ceiling), then
        // bounded so blood can never drag readiness below the 55 floor and
        // never raise it above the wearable core.
        let final: Int
        if penaltySum > 0 {
            let scaled = Int((Double(core) * Double(ceiling) / 100).rounded())
            final = min(core, max(ceilingFloor, scaled))
        } else {
            final = min(core, ceiling)
        }

        // --- §1.3(b) Confidence band: first-class, widened by blood + vitals.
        let vitalsFlag = vitals.map { vitalsOutOfBand($0) } ?? VitalsFlag(outOfBand: false, sustained: false)
        var band = baseBand
        if penaltySum > 0 { band += Int((Double(penaltySum) / 2).rounded()) }
        if penalties.contains(where: \.widensBand) { band += 2 }
        if vitalsFlag.outOfBand { band += 2 }
        band = min(12, band)

        // --- §1.7 Sick mode: "Feeling ill" tag or a sustained out-of-band run.
        let sick = (felt?.sick ?? false) || vitalsFlag.sustained

        // --- Decision, one step toward rest on inflammation/vitals/felt (§1.3b, §1.5).
        var decision: ReadinessDecision
        switch final {
        case 85...: decision = .trainHard
        case 68...: decision = .trainAsPlanned
        case 55...: decision = .goEasy
        default: decision = .rest
        }
        var feltContradicts = false
        if penalties.contains(where: \.widensBand) || vitalsFlag.outOfBand {
            decision = decision.softened
        }
        if let felt, felt.feel <= 2, decision == .trainHard || decision == .trainAsPlanned {
            decision = decision.softened
            feltContradicts = true
        }
        if sick { decision = .rest }

        // --- State (scores never bluff).
        let state: ReadinessState
        if sick {
            state = .sick
        } else if calibrating {
            state = .calibrating(day: max(1, min(observedDays + 1, neededDays)), of: neededDays)
        } else if sparseNight {
            state = .sparseNight
        } else {
            state = .ok
        }

        // --- Contributions (the transparent breakdown).
        var contributions: [ScoreContribution] = []
        contributions.append(ScoreContribution(
            label: "HRV vs 60-day baseline",
            points: Int((50 * hrvWeight * clamp(zHrv, -1, 1)).rounded()),
            detail: lastHrv.map { "Last night \(Int($0.rounded())) ms · baseline \(Int(muHrv.rounded())) ms" }
        ))
        contributions.append(ScoreContribution(
            label: "Resting HR vs 60-day baseline",
            points: Int((50 * rhrWeight * clamp(zRhr, -1, 1)).rounded()),
            detail: lastRhr.map { "Last night \(Int($0.rounded())) bpm · baseline \(Int(muRhr.rounded())) bpm" }
        ))
        for penalty in penalties {
            contributions.append(ScoreContribution(
                label: "\(penalty.marker.replacingOccurrences(of: "_", with: " ")) — blood layer",
                points: -penalty.penalty,
                detail: penalty.note
            ))
        }
        if let phase = cyclePhase {
            contributions.append(ScoreContribution(
                label: "Cycle phase — \(phase.displayName.lowercased())",
                points: 0,
                detail: "Band adjusted, no false alarm."
            ))
        }

        // --- The one-line why. Calm, specific, never apologetic (§6 tones).
        let why = whyLine(
            state: state,
            decision: decision,
            penalties: penalties,
            vitalsFlag: vitalsFlag,
            feltContradicts: feltContradicts,
            cyclePhase: cyclePhase,
            weighted: weighted
        )

        return ReadinessResult(
            core: core,
            ceiling: ceiling,
            final: final,
            band: band,
            decision: decision,
            why: why,
            contributions: contributions,
            state: state,
            exertionCeiling: decision.exertionCeiling
        )
    }

    // MARK: - Daily score history (for the behaviour-impact model)

    /// Core-only readiness for each of the trailing `days` days, computed the
    /// same way as `compute` (baseline = the window before each day). Used to
    /// regress felt-check-in tags against next-day deltas (§1.5).
    static func dailyScores(
        hrv: [DailyPoint],
        rhr: [DailyPoint],
        calendar: Calendar = .current,
        days: Int = 30,
        now: Date = Date()
    ) -> [DatedScore] {
        let hrvDays = dedupedByDay(hrv, calendar: calendar, before: now)
        let rhrDays = dedupedByDay(rhr, calendar: calendar, before: now)
        let rhrByDay = Dictionary(uniqueKeysWithValues: rhrDays.map { (calendar.startOfDay(for: $0.date), $0.value) })

        var scores: [DatedScore] = []
        for point in hrvDays.suffix(days) {
            let day = calendar.startOfDay(for: point.date)
            guard let rhrValue = rhrByDay[day] else { continue }
            let hrvPrior = hrvDays.filter { $0.date < day }.suffix(60)
            let rhrPrior = rhrDays.filter { $0.date < day }.suffix(60)
            guard hrvPrior.count >= 7, rhrPrior.count >= 7 else { continue }
            let (muH, sdH) = meanAndSD(hrvPrior.map(\.value))
            let (muR, sdR) = meanAndSD(rhrPrior.map(\.value))
            let zH = zScore(value: point.value, mu: muH, sigma: sdH)
            let zR = zScore(value: muR + (muR - rhrValue), mu: muR, sigma: sdR)
            let core = Int((50 + 50 * clamp(hrvWeight * zH + rhrWeight * zR, -1, 1)).rounded())
            scores.append(DatedScore(date: day, score: core))
        }
        return scores
    }

    // MARK: - Target Exertion load (§1.6 — includes resistance work)

    /// Today's 0–10 load from HealthKit workouts. Resistance sessions carry a
    /// minimum intensity regardless of average HR, so lifting is never
    /// under-weighted vs cardio.
    static func currentLoad(workoutsToday: [WorkoutSummary], maxHR30d: Double? = nil) -> Double {
        let maxHR = maxHR30d ?? 190
        var load = 0.0
        for workout in workoutsToday {
            let hours = Double(workout.minutes) / 60
            let ratio = workout.avgHR.map { Double($0) / maxHR } ?? 0.6
            var intensity: Double
            switch ratio {
            case 0.85...: intensity = 9
            case 0.75...: intensity = 7
            case 0.65...: intensity = 5
            default: intensity = 3
            }
            if workout.isResistance { intensity = max(intensity, 5) }
            load += hours * intensity
        }
        return min(10, (load * 10).rounded() / 10)
    }

    // MARK: - Vitals flag

    struct VitalsFlag: Hashable {
        /// Last night left the personal band (widen band, gentle wording).
        var outOfBand: Bool
        /// Two+ consecutive out-of-band nights → sick-mode trigger (§1.7).
        var sustained: Bool
    }

    static func vitalsOutOfBand(_ vitals: VitalsSnapshot) -> VitalsFlag {
        // A night is out of band when respiratory rate or wrist temperature
        // sits > 2σ ABOVE baseline, or SpO₂ > 2σ below (bad directions only).
        func flags(_ series: [DailyPoint], badHigh: Bool) -> [Bool] {
            guard series.count >= 8 else { return [] }
            let baseline = Array(series.dropLast())
            let (mu, sigma) = meanAndSD(baseline.map(\.value))
            guard sigma > 0 else { return [] }
            return series.suffix(2).map { point in
                let z = (point.value - mu) / sigma
                return badHigh ? z > 2 : z < -2
            }
        }
        let nightly: [[Bool]] = [
            flags(vitals.respiratoryRate, badHigh: true),
            flags(vitals.wristTemp, badHigh: true),
            flags(vitals.spo2, badHigh: false),
        ]
        let lastNight = nightly.contains { $0.last == true }
        let sustained = nightly.contains { $0.count >= 2 && $0.allSatisfy { $0 } }
        return VitalsFlag(outOfBand: lastNight, sustained: sustained)
    }

    // MARK: - Why line

    private static func whyLine(
        state: ReadinessState,
        decision: ReadinessDecision,
        penalties: [BiomarkerPenalty],
        vitalsFlag: VitalsFlag,
        feltContradicts: Bool,
        cyclePhase: CyclePhase?,
        weighted: Double
    ) -> String {
        switch state {
        case .calibrating:
            return "Learning your normal. Check back — or upload old bloodwork to start sooner."
        case .sparseNight:
            return "No overnight read — wear the watch to sleep tonight."
        case .sick:
            return "Rest is the plan, not a failure. Experiments paused, nudges silenced — everything resumes when your signals come back to band."
        case .ok:
            var parts: [String] = []
            if let top = penalties.first {
                parts.append(top.note)
            } else if vitalsFlag.outOfBand {
                parts.append("Your overnight signals sat outside your band. Might be nothing — take today gently.")
            } else if feltContradicts {
                parts.append("Your signals look fine, but you don't feel it — trust the felt read today.")
            } else if weighted >= 0.2 {
                parts.append("HRV and resting heart rate both sit on the good side of your baseline.")
            } else if weighted <= -0.2 {
                parts.append("Your overnight signals dipped below your baseline band.")
            } else {
                parts.append("Within your baseline band. Nothing needs you today.")
            }
            if let phase = cyclePhase {
                parts.append("Cycle phase — \(phase.displayName.lowercased()) · band adjusted, no false alarm.")
            }
            return parts.joined(separator: " ")
        }
    }

    // MARK: - Small maths

    private static func dedupedByDay(_ points: [DailyPoint], calendar: Calendar, before now: Date) -> [DailyPoint] {
        var byDay: [Date: DailyPoint] = [:]
        for point in points where point.date <= now {
            let day = calendar.startOfDay(for: point.date)
            if let existing = byDay[day], existing.date >= point.date { continue }
            byDay[day] = point
        }
        return byDay.values.sorted { $0.date < $1.date }
    }

    private static func baselineWindow(
        _ points: [DailyPoint],
        excluding lastNight: DailyPoint?,
        calendar: Calendar,
        now: Date
    ) -> [DailyPoint] {
        let windowStart = now.addingTimeInterval(-60 * 86_400)
        return points.filter { $0.date >= windowStart && $0 != lastNight }
    }

    /// Population mean + SD. σ of a tiny/flat series returns 0 — the z-score
    /// guard treats that as "no deviation" rather than dividing by zero.
    static func meanAndSD(_ values: [Double]) -> (mu: Double, sigma: Double) {
        guard !values.isEmpty else { return (0, 0) }
        let mu = values.reduce(0, +) / Double(values.count)
        guard values.count > 1 else { return (mu, 0) }
        let variance = values.map { ($0 - mu) * ($0 - mu) }.reduce(0, +) / Double(values.count)
        return (mu, variance.squareRoot())
    }

    private static func zScore(value: Double?, mu: Double, sigma: Double) -> Double {
        guard let value, sigma > 0 else { return 0 }
        return (value - mu) / sigma
    }

    static func clamp(_ x: Double, _ lo: Double, _ hi: Double) -> Double {
        min(hi, max(lo, x))
    }
}
