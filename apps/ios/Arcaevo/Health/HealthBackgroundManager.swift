import Foundation
import BackgroundTasks

// MARK: - Background HealthKit refresh coordinator
//
// The daily readiness/energy hook currently only refreshes when the app is
// opened. This coordinator closes that gap with TWO mechanisms, both feeding
// the same `AppModel.refreshForBackground()` (re-pull series → recompute
// engines → write the App-Group GlanceSnapshot for widgets/complications):
//
//   1. HKObserverQuery + enableBackgroundDelivery (in HealthKitProvider) —
//      iOS wakes us the moment new overnight HRV / resting HR / sleep lands, so
//      the morning score is "locked at wake" (ALGORITHM §1/§4) without an open.
//   2. BGAppRefreshTask — a scheduled belt-and-braces refresh for the case
//      where no observer fired (e.g. the watch synced late).
//
// Everything no-ops cleanly on the mock (simulator / HealthKit unavailable):
// `AppModel.supportsBackgroundHealth` is false there, so we never fabricate a
// score off seeded data in the background.

@MainActor
final class HealthBackgroundManager {
    static let shared = HealthBackgroundManager()

    /// Must match the `BGTaskSchedulerPermittedIdentifiers` entry in the
    /// per-config Info.plist files (Info-Debug.plist / Info-Release.plist).
    static let refreshTaskIdentifier = "co.arcaevo.app.health.refresh"

    private weak var model: AppModel?
    private var didRegister = false
    private var didStartObservers = false

    private init() {}

    /// Registers the BGAppRefreshTask handler. MUST run before the app finishes
    /// launching (called from `ArcaevoApp.init`). Registering an identifier not
    /// in `BGTaskSchedulerPermittedIdentifiers` would trap, so the plist keys
    /// are added alongside this. Idempotent.
    func registerLaunchHandlers() {
        guard !didRegister else { return }
        didRegister = true
        BGTaskScheduler.shared.register(
            forTaskWithIdentifier: Self.refreshTaskIdentifier,
            using: nil
        ) { task in
            // The handler is delivered on a background queue; hop to the main
            // actor where the model lives.
            guard let refresh = task as? BGAppRefreshTask else {
                task.setTaskCompleted(success: false)
                return
            }
            Task { @MainActor in
                HealthBackgroundManager.shared.handleAppRefresh(refresh)
            }
        }
    }

    /// Wire the live model, enable observer-query background delivery, and
    /// schedule the first BGAppRefreshTask. Call after `loadAll()`. No-ops when
    /// the provider can't do real background health (simulator / mock / denied).
    func start(model: AppModel) {
        self.model = model
        guard model.supportsBackgroundHealth else { return }
        scheduleAppRefresh()
        guard !didStartObservers else { return }
        didStartObservers = true
        Task { await model.enableHealthBackgroundDelivery() }
    }

    // MARK: BGAppRefreshTask

    private func handleAppRefresh(_ task: BGAppRefreshTask) {
        // Always queue the next one so the chain keeps going.
        scheduleAppRefresh()

        let work = Task { @MainActor in
            await self.model?.refreshForBackground()
            task.setTaskCompleted(success: true)
        }
        task.expirationHandler = { work.cancel() }
    }

    /// Submit a refresh request. iOS decides the actual timing; overnight data
    /// has usually landed by early morning, so we ask for ~4h out.
    func scheduleAppRefresh() {
        let request = BGAppRefreshTaskRequest(identifier: Self.refreshTaskIdentifier)
        request.earliestBeginDate = Date(timeIntervalSinceNow: 4 * 3600)
        try? BGTaskScheduler.shared.submit(request)
    }
}
