import Foundation
import HealthKit

/// Abstraction over health data so the app runs identically off a real
/// `HKHealthStore` or the seeded mock (simulator / authorization denied).
protocol HealthDataProviding {
    /// Requests read access. Returns true if the prompt completed
    /// (HealthKit never reveals per-type read grants).
    func requestAuthorization() async -> Bool

    /// One value per day for the trailing `days` days, oldest first.
    func dailySeries(for metric: WearableMetric, days: Int) async -> [WearableSignal]
}

enum HealthProviderFactory {
    /// Mock in the simulator; real HealthKit on device (with the model
    /// falling back to mock series if reads come back empty).
    static func make() -> HealthDataProviding {
        #if targetEnvironment(simulator)
        return MockHealthStore()
        #else
        if HKHealthStore.isHealthDataAvailable() {
            return HealthKitProvider()
        }
        return MockHealthStore()
        #endif
    }
}
