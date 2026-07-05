import Foundation
import HealthKit

/// Real HealthKit reads: HRV (SDNN), resting heart rate, VO₂ max, steps,
/// active energy, respiratory rate, SpO₂, sleeping wrist temperature, sleep
/// analysis with stages, and workouts with per-workout heart rate —
/// aggregated to engine-friendly daily shapes.
///
/// Cycle access is a SEPARATE authorization (`requestCycleAccess`) — the
/// menstrual types must never appear in the first HealthKit sheet.
final class HealthKitProvider: HealthDataProviding {
    private let store = HKHealthStore()

    /// Retained observer queries — HealthKit stops delivering the moment these
    /// are released, so they must outlive `enableBackgroundDelivery`.
    private var observerQueries: [HKObserverQuery] = []

    /// The MAIN read set — everything the primer screen enumerates, and
    /// nothing else. No cycle types here, ever.
    private var readTypes: Set<HKObjectType> {
        [
            HKQuantityType(.heartRateVariabilitySDNN),
            HKQuantityType(.restingHeartRate),
            HKQuantityType(.heartRate),
            HKQuantityType(.vo2Max),
            HKQuantityType(.stepCount),
            HKQuantityType(.activeEnergyBurned),
            HKQuantityType(.respiratoryRate),
            HKQuantityType(.oxygenSaturation),
            HKQuantityType(.appleSleepingWristTemperature),
            HKCategoryType(.sleepAnalysis),
            HKObjectType.workoutType(),
        ]
    }

    func requestAuthorization() async -> Bool {
        guard HKHealthStore.isHealthDataAvailable() else { return false }
        do {
            try await store.requestAuthorization(toShare: [], read: readTypes)
            return true
        } catch {
            return false
        }
    }

    /// GDPR Art. 9 + App Review: cycle tracking is its own, later sheet,
    /// requested only from the Data & privacy cycle-aware toggle.
    func requestCycleAccess() async -> Bool {
        guard HKHealthStore.isHealthDataAvailable() else { return false }
        do {
            try await store.requestAuthorization(toShare: [], read: [HKCategoryType(.menstrualFlow)])
            return true
        } catch {
            return false
        }
    }

    // MARK: - Daily series

    func dailySeries(for metric: WearableMetric, days: Int) async -> [WearableSignal] {
        switch metric {
        case .hrv:
            return await quantityDaily(
                .heartRateVariabilitySDNN,
                unit: .secondUnit(with: .milli),
                metric: .hrv, days: days, aggregate: .average
            )
        case .restingHeartRate:
            return await quantityDaily(
                .restingHeartRate,
                unit: HKUnit.count().unitDivided(by: .minute()),
                metric: .restingHeartRate, days: days, aggregate: .average
            )
        case .vo2max:
            return await quantityDaily(
                .vo2Max,
                unit: HKUnit.literUnit(with: .milli)
                    .unitDivided(by: HKUnit.gramUnit(with: .kilo).unitMultiplied(by: .minute())),
                metric: .vo2max, days: days, aggregate: .average
            )
        case .sleepHours:
            let nights = await sleepNights(days: days)
            return nights.map { night in
                WearableSignal(
                    id: "hk-sleep-\(Int(night.date.timeIntervalSince1970))",
                    metric: .sleepHours,
                    value: (night.hours * 10).rounded() / 10,
                    date: night.date
                )
            }
        case .steps:
            return await quantityDaily(.stepCount, unit: .count(), metric: .steps, days: days, aggregate: .sum)
        case .activeEnergy:
            return await quantityDaily(.activeEnergyBurned, unit: .kilocalorie(), metric: .activeEnergy, days: days, aggregate: .sum)
        case .respiratoryRate:
            return await quantityDaily(
                .respiratoryRate,
                unit: HKUnit.count().unitDivided(by: .minute()),
                metric: .respiratoryRate, days: days, aggregate: .average
            )
        case .spo2:
            // HealthKit stores SpO₂ as a 0–1 fraction; surface it as %.
            return await quantityDaily(.oxygenSaturation, unit: .percent(), metric: .spo2, days: days, aggregate: .average)
                .map { signal in
                    var s = signal
                    s.value = (s.value * 1000).rounded() / 10
                    return s
                }
        case .wristTemp:
            return await quantityDaily(
                .appleSleepingWristTemperature,
                unit: .degreeCelsius(),
                metric: .wristTemp, days: days, aggregate: .average
            )
        }
    }

    private enum DailyAggregate {
        case average
        case sum
    }

    private func quantityDaily(
        _ identifier: HKQuantityTypeIdentifier,
        unit: HKUnit,
        metric: WearableMetric,
        days: Int,
        aggregate: DailyAggregate
    ) async -> [WearableSignal] {
        let type = HKQuantityType(identifier)
        let calendar = Calendar.current
        let endOfToday = calendar.startOfDay(for: Date()).addingTimeInterval(86_400)
        guard let start = calendar.date(byAdding: .day, value: -days, to: endOfToday) else { return [] }
        let predicate = HKQuery.predicateForSamples(withStart: start, end: endOfToday, options: .strictStartDate)
        let options: HKStatisticsOptions = aggregate == .sum ? .cumulativeSum : .discreteAverage

        return await withCheckedContinuation { continuation in
            let query = HKStatisticsCollectionQuery(
                quantityType: type,
                quantitySamplePredicate: predicate,
                options: options,
                anchorDate: calendar.startOfDay(for: start),
                intervalComponents: DateComponents(day: 1)
            )
            query.initialResultsHandler = { _, collection, _ in
                var signals: [WearableSignal] = []
                collection?.enumerateStatistics(from: start, to: endOfToday) { stats, _ in
                    let quantity = aggregate == .sum ? stats.sumQuantity() : stats.averageQuantity()
                    guard let quantity else { return }
                    signals.append(
                        WearableSignal(
                            id: "hk-\(metric.rawValue)-\(Int(stats.startDate.timeIntervalSince1970))",
                            metric: metric,
                            value: quantity.doubleValue(for: unit),
                            date: stats.startDate
                        )
                    )
                }
                continuation.resume(returning: signals.sorted { $0.date < $1.date })
            }
            store.execute(query)
        }
    }

    // MARK: - Sleep nights with stages (HKCategoryValueSleepAnalysis stages)

    func sleepNights(days: Int) async -> [SleepNight] {
        let type = HKCategoryType(.sleepAnalysis)
        let calendar = Calendar.current
        let end = Date()
        guard let start = calendar.date(byAdding: .day, value: -days, to: end) else { return [] }
        let predicate = HKQuery.predicateForSamples(withStart: start, end: end, options: [])

        let samples: [HKCategorySample] = await withCheckedContinuation { continuation in
            let query = HKSampleQuery(
                sampleType: type,
                predicate: predicate,
                limit: HKObjectQueryNoLimit,
                sortDescriptors: [NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: true)]
            ) { _, results, _ in
                continuation.resume(returning: (results as? [HKCategorySample]) ?? [])
            }
            store.execute(query)
        }

        struct NightAccumulator {
            var deep = 0.0, rem = 0.0, core = 0.0, unspecified = 0.0
            var awakenings = 0
        }
        var byNight: [Date: NightAccumulator] = [:]
        for sample in samples {
            // Attribute to the morning the sleep ended.
            let night = calendar.startOfDay(for: sample.endDate)
            let hours = sample.endDate.timeIntervalSince(sample.startDate) / 3600
            var acc = byNight[night] ?? NightAccumulator()
            switch HKCategoryValueSleepAnalysis(rawValue: sample.value) {
            case .asleepDeep: acc.deep += hours
            case .asleepREM: acc.rem += hours
            case .asleepCore: acc.core += hours
            case .asleepUnspecified: acc.unspecified += hours
            case .awake: acc.awakenings += 1
            default: break // inBed / none — not asleep time
            }
            byNight[night] = acc
        }

        return byNight
            .sorted { $0.key < $1.key }
            .compactMap { night, acc in
                let hours = acc.deep + acc.rem + acc.core + acc.unspecified
                guard hours > 0 else { return nil }
                let hasStages = acc.deep + acc.rem + acc.core > 0
                return SleepNight(
                    date: night,
                    hours: (hours * 10).rounded() / 10,
                    deep: hasStages ? (acc.deep * 10).rounded() / 10 : nil,
                    rem: hasStages ? (acc.rem * 10).rounded() / 10 : nil,
                    core: hasStages ? (acc.core * 10).rounded() / 10 : nil,
                    awakenings: acc.awakenings > 0 ? acc.awakenings : nil
                )
            }
    }

    // MARK: - Workouts (with per-workout heart rate — resistance counts)

    func workouts(days: Int) async -> [WorkoutSummary] {
        let calendar = Calendar.current
        let end = Date()
        guard let start = calendar.date(byAdding: .day, value: -days, to: end) else { return [] }
        let predicate = HKQuery.predicateForSamples(withStart: start, end: end, options: [])

        let hkWorkouts: [HKWorkout] = await withCheckedContinuation { continuation in
            let query = HKSampleQuery(
                sampleType: .workoutType(),
                predicate: predicate,
                limit: HKObjectQueryNoLimit,
                sortDescriptors: [NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: true)]
            ) { _, results, _ in
                continuation.resume(returning: (results as? [HKWorkout]) ?? [])
            }
            store.execute(query)
        }

        var summaries: [WorkoutSummary] = []
        for workout in hkWorkouts {
            let (avgHR, maxHR) = await heartRate(for: workout)
            let kcal = workout.statistics(for: HKQuantityType(.activeEnergyBurned))?
                .sumQuantity()?
                .doubleValue(for: .kilocalorie())
            summaries.append(
                WorkoutSummary(
                    type: Self.displayName(for: workout.workoutActivityType),
                    minutes: Int((workout.duration / 60).rounded()),
                    avgHR: avgHR.map { Int($0.rounded()) },
                    maxHR: maxHR.map { Int($0.rounded()) },
                    kcal: kcal.map { Int($0.rounded()) },
                    date: workout.startDate
                )
            )
        }
        return summaries
    }

    private func heartRate(for workout: HKWorkout) async -> (avg: Double?, max: Double?) {
        let type = HKQuantityType(.heartRate)
        let unit = HKUnit.count().unitDivided(by: .minute())
        let predicate = HKQuery.predicateForSamples(
            withStart: workout.startDate, end: workout.endDate, options: []
        )
        return await withCheckedContinuation { continuation in
            let query = HKStatisticsQuery(
                quantityType: type,
                quantitySamplePredicate: predicate,
                options: [.discreteAverage, .discreteMax]
            ) { _, stats, _ in
                continuation.resume(returning: (
                    stats?.averageQuantity()?.doubleValue(for: unit),
                    stats?.maximumQuantity()?.doubleValue(for: unit)
                ))
            }
            store.execute(query)
        }
    }

    private static func displayName(for type: HKWorkoutActivityType) -> String {
        switch type {
        case .running: return "Run"
        case .walking: return "Walk"
        case .cycling: return "Cycle"
        case .swimming: return "Swim"
        case .traditionalStrengthTraining, .functionalStrengthTraining: return "Strength"
        case .highIntensityIntervalTraining: return "HIIT"
        case .yoga: return "Yoga"
        case .pilates: return "Pilates"
        case .rowing: return "Row"
        case .hiking: return "Hike"
        case .elliptical: return "Elliptical"
        case .coreTraining: return "Core"
        default: return "Workout"
        }
    }

    // MARK: - Background delivery (HKObserverQuery + enableBackgroundDelivery)
    //
    // The daily hook can't wait for an app open: overnight HRV / resting HR /
    // sleep land while the phone is on the charger. We register an observer for
    // each key type and ask HealthKit to wake us (frequency .hourly — the
    // finest allowed for these types) so the readiness/energy snapshot is fresh
    // by the time the member glances at a widget or complication (ALGORITHM
    // §1/§4: "readiness locked at wake"). Real device only — see the mock.

    var supportsBackgroundDelivery: Bool { HKHealthStore.isHealthDataAvailable() }

    /// The types worth waking for — the overnight acute drivers of the score.
    private var backgroundTypes: [HKSampleType] {
        [
            HKQuantityType(.heartRateVariabilitySDNN),
            HKQuantityType(.restingHeartRate),
            HKCategoryType(.sleepAnalysis),
        ]
    }

    func enableBackgroundDelivery(onUpdate: @escaping @Sendable () async -> Void) async {
        guard HKHealthStore.isHealthDataAvailable() else { return }
        guard observerQueries.isEmpty else { return } // idempotent

        for type in backgroundTypes {
            let query = HKObserverQuery(sampleType: type, predicate: nil) { _, completionHandler, _ in
                // New overnight data (or an initial delivery). Recompute, then
                // ALWAYS tell HealthKit we're done so background wake-ups keep
                // being delivered — even if the refresh threw or was skipped.
                Task {
                    await onUpdate()
                    completionHandler()
                }
            }
            store.execute(query)
            observerQueries.append(query)

            // Ask iOS to wake us in the background when this type gets new data.
            // Failure here (e.g. entitlement missing) is non-fatal: the observer
            // still fires while the app is foregrounded.
            store.enableBackgroundDelivery(for: type, frequency: .hourly) { _, _ in }
        }
    }

    // MARK: - Cycle phase (opt-in; read only after requestCycleAccess)

    func cyclePhase(now: Date) async -> CyclePhase? {
        let type = HKCategoryType(.menstrualFlow)
        let calendar = Calendar.current
        guard let start = calendar.date(byAdding: .day, value: -60, to: now) else { return nil }
        let predicate = HKQuery.predicateForSamples(withStart: start, end: now, options: [])

        let samples: [HKCategorySample] = await withCheckedContinuation { continuation in
            let query = HKSampleQuery(
                sampleType: type,
                predicate: predicate,
                limit: HKObjectQueryNoLimit,
                sortDescriptors: [NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: true)]
            ) { _, results, _ in
                continuation.resume(returning: (results as? [HKCategorySample]) ?? [])
            }
            store.execute(query)
        }

        // Prefer explicit cycle-start metadata; fall back to the first day of
        // the latest run of flow days.
        let flowDays = samples
            .filter { $0.value != HKCategoryValueMenstrualFlow.none.rawValue }
            .map { calendar.startOfDay(for: $0.startDate) }
        let cycleStart = samples
            .last { ($0.metadata?[HKMetadataKeyMenstrualCycleStart] as? Bool) == true }
            .map { calendar.startOfDay(for: $0.startDate) }
            ?? latestRunStart(of: flowDays, calendar: calendar)
        guard let cycleStart else { return nil }
        let days = calendar.dateComponents([.day], from: cycleStart, to: calendar.startOfDay(for: now)).day ?? 0
        // A "latest start" older than a long cycle means no usable signal.
        guard days >= 0, days <= 45 else { return nil }
        return CyclePhase.from(daysSinceCycleStart: days)
    }

    /// First day of the most recent consecutive run of flow days.
    private func latestRunStart(of days: [Date], calendar: Calendar) -> Date? {
        let sorted = Array(Set(days)).sorted()
        guard var runStart = sorted.last else { return nil }
        for day in sorted.reversed().dropFirst() {
            guard let expected = calendar.date(byAdding: .day, value: -1, to: runStart) else { break }
            if calendar.isDate(day, inSameDayAs: expected) {
                runStart = day
            } else {
                break
            }
        }
        return runStart
    }
}
