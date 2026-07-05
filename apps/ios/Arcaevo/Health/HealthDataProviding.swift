import Foundation
import HealthKit

/// Abstraction over health data so the app runs identically off a real
/// `HKHealthStore` or the seeded mock (simulator / authorization denied).
protocol HealthDataProviding {
    /// Requests read access to the MAIN read set (sleep & stages, heart rate,
    /// HRV, VO₂max, workouts, active energy, steps, respiratory rate, SpO₂,
    /// wrist temperature). Cycle types are NEVER in this sheet — see
    /// `requestCycleAccess()`. Returns true if the prompt completed
    /// (HealthKit never reveals per-type read grants).
    func requestAuthorization() async -> Bool

    /// SEPARATE, later ask for menstrual-cycle read access (GDPR Art. 9 /
    /// App Review requirement): only fired when the member turns on
    /// cycle-aware baselines in Data & privacy — never bundled into the
    /// first HealthKit sheet.
    func requestCycleAccess() async -> Bool

    /// One value per day for the trailing `days` days, oldest first.
    func dailySeries(for metric: WearableMetric, days: Int) async -> [WearableSignal]

    /// Workouts in the trailing `days` days, oldest first, with per-workout
    /// heart rate so resistance work counts toward load (ALGORITHM §1.6).
    func workouts(days: Int) async -> [WorkoutSummary]

    /// Nights with stage breakdown (deep/REM/core) + awakenings, oldest
    /// first. Sleep is shown, not scored (ALGORITHM §1.4).
    func sleepNights(days: Int) async -> [SleepNight]

    /// Current cycle phase from HealthKit menstrualFlow, or nil when the
    /// member hasn't opted in / no cycle data exists. Callers must gate on
    /// `CyclePreferences.isEnabled`.
    func cyclePhase(now: Date) async -> CyclePhase?
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
