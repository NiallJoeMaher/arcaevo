import Foundation

/// Deterministic seeded health data — used automatically in the simulator or
/// when HealthKit authorization is denied/empty, so the app always demos.
final class MockHealthStore: HealthDataProviding {
    func requestAuthorization() async -> Bool {
        true
    }

    /// The separate cycle ask always "completes" in the mock. The phase is
    /// still gated on the Data & privacy toggle, like the real provider.
    func requestCycleAccess() async -> Bool {
        true
    }

    func dailySeries(for metric: WearableMetric, days: Int) async -> [WearableSignal] {
        DemoDataProvider.wearableSeries(metric: metric, days: days)
    }

    func workouts(days: Int) async -> [WorkoutSummary] {
        DemoDataProvider.workouts(days: days)
    }

    func sleepNights(days: Int) async -> [SleepNight] {
        DemoDataProvider.sleepNights(days: days)
    }

    func cyclePhase(now: Date) async -> CyclePhase? {
        // Only when the member opted in — mirrors the real gate so the
        // simulator demos the cycle-aware band note honestly.
        CyclePreferences.isEnabled ? .luteal : nil
    }

    // MARK: - Background delivery (no-op)

    /// The mock never drives background refresh — there is no real overnight
    /// data to wake on, and we must never recompute a score off seeded series
    /// in the background.
    var supportsBackgroundDelivery: Bool { false }

    func enableBackgroundDelivery(onUpdate: @escaping @Sendable () async -> Void) async {
        // Intentionally empty — simulator / denied has nothing to observe.
    }
}
