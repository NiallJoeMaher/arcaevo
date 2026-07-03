import Foundation

/// Runtime, DEBUG-only demo toggle for the WATCH app.
///
/// The watch is a SEPARATE process with its OWN UserDefaults (no shared
/// container / App Group with the phone), so it carries its own key — flipping
/// the phone's `DemoMode` does NOT affect the watch.
///
/// DEFAULT **false**: the watch runs the REAL golden-watch-login flow — the
/// phone hands over a device-scoped token (WatchConnectivity), the watch
/// refreshes it against `/auth/session/refresh` and fetches live member data.
/// When ON it falls back to the seeded demo experience (with the DEMO badge).
///
/// In Release this is a compile-time `false`: no demo data, no token
/// fabrication, and no toggle.
enum WatchDemoMode {
    #if DEBUG
    static let defaultsKey = "arcaevo.watchDemoMode"
    static var isEnabled: Bool {
        get { UserDefaults.standard.object(forKey: defaultsKey) as? Bool ?? false }
        set { UserDefaults.standard.set(newValue, forKey: defaultsKey) }
    }
    #else
    static let isEnabled = false
    #endif
}
