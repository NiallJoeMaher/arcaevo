import SwiftUI

@main
struct ArcaevoWatchApp: App {
    var body: some Scene {
        WindowGroup {
            WatchTodayView()
                .tint(.vitality)
        }
    }
}
