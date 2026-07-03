import SwiftUI

/// Arcaevo watch app v3 — Prototype.dc.html APPLE WATCH group (6 screens):
/// face entry → today (baseline) → biomarker glance → quick-log →
/// active experiment → result ready. Status + deltas only, never raw
/// alarming values; results push the member to the phone.
@main
struct ArcaevoWatchApp: App {
    @State private var model = WatchModel()
    @State private var auth = WatchAuthManager()

    var body: some Scene {
        WindowGroup {
            WatchRootView()
                .environment(model)
                .environment(auth)
                .task {
                    // Golden watch login: activate WatchConnectivity to receive
                    // the token the iPhone hands over, then validate whatever we
                    // already have on disk.
                    WatchConnectivityManager.shared.auth = auth
                    WatchConnectivityManager.shared.activate()
                    await auth.refresh()
                }
        }
    }
}
