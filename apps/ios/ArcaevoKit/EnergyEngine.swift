import Foundation

// MARK: - Energy — the all-day 0–100 gauge (ALGORITHM §2)
//
// Drains with strain/stress, recharges with rest/sleep. The ceiling is
// blood-modulated by the same §1.3 penalty mechanism — "same walk, heavier
// legs: that's this number, not your effort." Deterministic; no AI.

/// Inputs for one day's energy curve. All on-device.
struct EnergyInputs {
    /// Last night's sleep — the overnight recharge. nil → conservative start.
    var sleepLastNight: SleepNight?
    /// The learned wake hour (WakeTimeModel), default 07:00.
    var wakeHour: Int
    /// Today's workouts (drain, incl. resistance).
    var workoutsToday: [WorkoutSummary]
    /// Learned personal afternoon-dip hour; nil → wake + 8h circadian default.
    var learnedDipHour: Int?

    init(
        sleepLastNight: SleepNight? = nil,
        wakeHour: Int = 7,
        workoutsToday: [WorkoutSummary] = [],
        learnedDipHour: Int? = nil
    ) {
        self.sleepLastNight = sleepLastNight
        self.wakeHour = wakeHour
        self.workoutsToday = workoutsToday
        self.learnedDipHour = learnedDipHour
    }
}

/// One point on the day's curve. Points after "now" are the forecast.
struct EnergySample: Codable, Hashable {
    var t: Date
    var value: Int
    /// The day's blood-modulated ceiling (repeated per §10 entity shape).
    var ceiling: Int
}

/// The full day: hourly points from wake to 23:00.
struct EnergyDay: Codable, Hashable {
    var points: [EnergySample]
    /// Blood-modulated max (100 − Σ §1.3 penalties, floor 55).
    var ceiling: Int
    /// Morning start — overnight recharge toward the ceiling, scaled by sleep
    /// duration + quality (design: started at 68, not 100).
    var start: Int
    /// Forecast personal afternoon dip (design: ~15:00); nil while calibrating.
    var forecastDipHour: Int?

    /// The current value (last non-forecast point at/before `now`).
    func value(at now: Date) -> Int? {
        points.last(where: { $0.t <= now })?.value ?? points.first?.value
    }
}

enum EnergyEngine {

    static let ceilingFloor = 55

    /// Builds today's energy curve. `samples` is the contract's label for the
    /// day's inputs.
    static func day(
        samples: EnergyInputs,
        penalties: [BiomarkerPenalty],
        now: Date = Date(),
        calendar: Calendar = .current
    ) -> EnergyDay {
        // Ceiling: the same blood mechanism as readiness (§1.3), same floor.
        let penaltySum = penalties.map(\.penalty).reduce(0, +)
        let ceiling = max(ceilingFloor, 100 - penaltySum)

        // Morning start: overnight recharge toward the ceiling, scaled by
        // sleep duration (target 8h) × stage quality. No sleep read → 70%.
        let rechargeFraction: Double
        if let night = samples.sleepLastNight {
            rechargeFraction = min(1, max(0, night.hours / 8)) * night.qualityFactor
        } else {
            rechargeFraction = 0.7
        }
        let start = max(0, min(ceiling, Int((Double(ceiling) * rechargeFraction).rounded())))

        // Personal circadian dip: learned, else ~8h after wake (07:00 → 15:00).
        let dipHour = samples.learnedDipHour ?? min(17, samples.wakeHour + 8)
        let forecastDip: Int? = samples.sleepLastNight == nil && samples.learnedDipHour == nil ? nil : dipHour

        // Hourly curve, wake → 23:00. Deterministic drain/recharge:
        //  · gentle morning build while fresh (rest recharges toward ceiling)
        //  · steady daytime drain, deeper around the circadian dip
        //  · workout hours drain by duration × HR intensity (resistance counts)
        //  · light evening wind-down drain
        let dayStart = calendar.startOfDay(for: now)
        let workoutDrainByHour = workoutDrain(samples.workoutsToday, calendar: calendar)

        var points: [EnergySample] = []
        var energy = Double(start)
        let wake = max(0, min(23, samples.wakeHour))
        for hour in wake...23 {
            guard let t = calendar.date(byAdding: .hour, value: hour, to: dayStart) else { continue }
            if hour > wake {
                var delta = 0.0
                switch hour {
                case ..<(wake + 4): delta += 1.5           // fresh morning build
                case ..<20: delta -= 2.2                   // steady daytime drain
                default: delta -= 1.0                      // evening wind-down
                }
                if abs(hour - dipHour) <= 1 { delta -= 2.5 } // circadian dip
                delta -= workoutDrainByHour[hour] ?? 0
                energy = min(Double(ceiling), max(0, energy + delta))
            }
            points.append(EnergySample(t: t, value: Int(energy.rounded()), ceiling: ceiling))
        }

        return EnergyDay(points: points, ceiling: ceiling, start: start, forecastDipHour: forecastDip)
    }

    /// Per-hour drain from today's workouts: duration × HR-band intensity;
    /// resistance sessions never under-count (§1.6 rationale).
    private static func workoutDrain(_ workouts: [WorkoutSummary], calendar: Calendar) -> [Int: Double] {
        var byHour: [Int: Double] = [:]
        for workout in workouts {
            let hour = calendar.component(.hour, from: workout.date)
            let hours = Double(workout.minutes) / 60
            var perHour: Double
            switch workout.avgHR ?? 100 {
            case 140...: perHour = 8
            case 120...: perHour = 5
            default: perHour = 3
            }
            if workout.isResistance { perHour = max(perHour, 5) }
            byHour[hour, default: 0] += hours * perHour
        }
        return byHour
    }
}
