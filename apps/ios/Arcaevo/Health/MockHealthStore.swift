import Foundation

/// Deterministic seeded health data — used automatically in the simulator or
/// when HealthKit authorization is denied/empty, so the app always demos.
final class MockHealthStore: HealthDataProviding {
    func requestAuthorization() async -> Bool {
        true
    }

    func dailySeries(for metric: WearableMetric, days: Int) async -> [WearableSignal] {
        DemoDataProvider.wearableSeries(metric: metric, days: days)
    }
}
