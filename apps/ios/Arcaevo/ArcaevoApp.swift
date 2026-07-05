import SwiftUI

@main
struct ArcaevoApp: App {
    @State private var model = AppModel()
    @State private var appState = AppState()

    init() {
        // Privacy-first crash/error observability — no-op unless SENTRY_DSN is
        // configured (health app: never a HealthKit value or PII in telemetry).
        Telemetry.start()
        // Register the BGAppRefreshTask handler BEFORE the app finishes
        // launching (BGTaskScheduler requirement). No-ops on the mock later.
        HealthBackgroundManager.shared.registerLaunchHandlers()
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(model)
                .environment(appState)
                .tint(.forest)
                .task {
                    // Activate WatchConnectivity so the golden-watch-login
                    // token can be handed to the paired watch (re-pushes the
                    // current token on activation if already signed in).
                    PhoneWatchConnectivity.shared.activate()
                    await model.loadAll()
                    // Turn on background HealthKit delivery + schedule the
                    // refresh so widgets/complications stay fresh without an
                    // open (real device only; no-ops on the simulator/mock).
                    HealthBackgroundManager.shared.start(model: model)
                    // Re-arm the one-time first-reading nudge for a member who
                    // onboarded previously but never opened their score.
                    FirstReadingNudge.scheduleIfNeeded(appState: appState)
                }
                // Magic-link entry points:
                //  - https://arcaevo.com/verify?token=…  (universal link —
                //    requires the associated-domains entitlement, commented
                //    in project.yml until a real team/AASA exists)
                //  - arcaevo://verify?token=…            (custom scheme, live now)
                .onOpenURL { url in
                    appState.handleIncomingURL(url)
                }
        }
    }
}
