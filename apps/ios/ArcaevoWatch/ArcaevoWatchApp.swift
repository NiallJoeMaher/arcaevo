import SwiftUI

/// Arcaevo watch app v3 — Prototype.dc.html APPLE WATCH group (6 screens):
/// face entry → today (baseline) → biomarker glance → quick-log →
/// active experiment → result ready. Status + deltas only, never raw
/// alarming values; results push the member to the phone.
@main
struct ArcaevoWatchApp: App {
    @State private var model = WatchModel()

    var body: some Scene {
        WindowGroup {
            WatchRootView()
                .environment(model)
        }
    }
}
