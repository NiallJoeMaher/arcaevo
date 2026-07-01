import Foundation
import HealthKit

/// Real HealthKit reads: HRV (SDNN), resting heart rate, sleep analysis and
/// VO₂ max, aggregated to one value per day.
final class HealthKitProvider: HealthDataProviding {
    private let store = HKHealthStore()

    private var readTypes: Set<HKObjectType> {
        [
            HKQuantityType(.heartRateVariabilitySDNN),
            HKQuantityType(.restingHeartRate),
            HKQuantityType(.vo2Max),
            HKCategoryType(.sleepAnalysis),
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

    func dailySeries(for metric: WearableMetric, days: Int) async -> [WearableSignal] {
        switch metric {
        case .hrv:
            return await quantityDailyAverage(
                .heartRateVariabilitySDNN,
                unit: .secondUnit(with: .milli),
                metric: .hrv,
                days: days
            )
        case .restingHeartRate:
            return await quantityDailyAverage(
                .restingHeartRate,
                unit: HKUnit.count().unitDivided(by: .minute()),
                metric: .restingHeartRate,
                days: days
            )
        case .vo2max:
            return await quantityDailyAverage(
                .vo2Max,
                unit: HKUnit.literUnit(with: .milli)
                    .unitDivided(by: HKUnit.gramUnit(with: .kilo).unitMultiplied(by: .minute())),
                metric: .vo2max,
                days: days
            )
        case .sleepHours:
            return await sleepDailyHours(days: days)
        }
    }

    // MARK: - Quantity metrics (daily average)

    private func quantityDailyAverage(
        _ identifier: HKQuantityTypeIdentifier,
        unit: HKUnit,
        metric: WearableMetric,
        days: Int
    ) async -> [WearableSignal] {
        let type = HKQuantityType(identifier)
        let calendar = Calendar.current
        let endOfToday = calendar.startOfDay(for: Date()).addingTimeInterval(86_400)
        guard let start = calendar.date(byAdding: .day, value: -days, to: endOfToday) else { return [] }
        let predicate = HKQuery.predicateForSamples(withStart: start, end: endOfToday, options: .strictStartDate)

        return await withCheckedContinuation { continuation in
            let query = HKStatisticsCollectionQuery(
                quantityType: type,
                quantitySamplePredicate: predicate,
                options: .discreteAverage,
                anchorDate: calendar.startOfDay(for: start),
                intervalComponents: DateComponents(day: 1)
            )
            query.initialResultsHandler = { _, collection, _ in
                var signals: [WearableSignal] = []
                collection?.enumerateStatistics(from: start, to: endOfToday) { stats, _ in
                    guard let average = stats.averageQuantity() else { return }
                    signals.append(
                        WearableSignal(
                            id: "hk-\(metric.rawValue)-\(Int(stats.startDate.timeIntervalSince1970))",
                            metric: metric,
                            value: average.doubleValue(for: unit),
                            date: stats.startDate
                        )
                    )
                }
                continuation.resume(returning: signals.sorted { $0.date < $1.date })
            }
            store.execute(query)
        }
    }

    // MARK: - Sleep (asleep hours per night)

    private func sleepDailyHours(days: Int) async -> [WearableSignal] {
        let type = HKCategoryType(.sleepAnalysis)
        let calendar = Calendar.current
        let end = Date()
        guard let start = calendar.date(byAdding: .day, value: -days, to: end) else { return [] }
        let predicate = HKQuery.predicateForSamples(withStart: start, end: end, options: [])
        let asleepValues = Set(HKCategoryValueSleepAnalysis.allAsleepValues.map(\.rawValue))

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

        // Sum asleep time per night, attributed to the day the sleep ended.
        var hoursByDay: [Date: Double] = [:]
        for sample in samples where asleepValues.contains(sample.value) {
            let day = calendar.startOfDay(for: sample.endDate)
            hoursByDay[day, default: 0] += sample.endDate.timeIntervalSince(sample.startDate) / 3600
        }

        return hoursByDay
            .sorted { $0.key < $1.key }
            .map { day, hours in
                WearableSignal(
                    id: "hk-sleep-\(Int(day.timeIntervalSince1970))",
                    metric: .sleepHours,
                    value: (hours * 10).rounded() / 10,
                    date: day
                )
            }
    }
}
