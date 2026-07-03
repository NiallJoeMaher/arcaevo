import Foundation
import WatchConnectivity

/// Phone side of the "golden watch login" handoff.
///
/// The watch never shows a login field. Instead the iPhone, once its member is
/// signed in, mints a device-scoped watch token (`POST /auth/watch-session`,
/// phone-authed) and hands it to the watch via
/// `WCSession.updateApplicationContext`. `updateApplicationContext` is the
/// correct transfer here: latest-state-wins and delivered whenever the watch
/// next wakes even if it's currently unreachable — NOT `sendMessage`
/// (needs reachability) or `transferUserInfo` (a queue, not a single latest
/// state). On sign-out the phone revokes the watch token and pushes
/// `{signedOut: true}` so the wrist clears and shows the "open iPhone" state.
///
/// No WatchConnectivity entitlement is required; the pairing exists because the
/// watch app is embedded in the iOS app (see project.yml).
final class PhoneWatchConnectivity: NSObject, WCSessionDelegate {
    static let shared = PhoneWatchConnectivity()

    /// Set by `AppState` so the manager can react to WCSession lifecycle events
    /// (activation, reachability, pairing) even without a fresh sign-in — e.g.
    /// re-pushing the token when the watch first becomes reachable. Returns the
    /// signed-in member's display name, or nil.
    var currentMemberName: (() -> String?)?

    private let api = APIClient()

    private override init() { super.init() }

    /// Call once on app launch (from `ArcaevoApp`).
    func activate() {
        guard WCSession.isSupported() else { return }
        let session = WCSession.default
        session.delegate = self
        session.activate()
    }

    /// Mint a fresh watch token and push it to the watch. Safe to call
    /// repeatedly — latest-state-wins. No-ops when the phone isn't signed in.
    func syncWatchSession(memberName: String?) {
        guard SessionStore.hasSession else { return }
        Task { await pushToken(memberName: memberName) }
    }

    /// On phone sign-out: revoke the watch token server-side, then tell the
    /// watch to forget its own copy and show the setup screen.
    func signOutWatch() {
        Task {
            try? await api.revokeWatchSession()
            pushContext(["signedOut": true])
        }
    }

    // MARK: - Private

    private func pushToken(memberName: String?) async {
        do {
            let minted = try await api.mintWatchSession()
            pushContext([
                "watchSessionToken": minted.watchSessionToken,
                "expiresAt": Self.iso.string(from: minted.expiresAt),
                "memberName": memberName ?? "",
            ])
        } catch {
            #if DEBUG
            // Lone simulator / offline dev: no backend to mint against. Push a
            // demo token so a paired debug watch can still exercise the handoff.
            // (In Release this branch doesn't exist — no token is fabricated.)
            pushContext([
                "watchSessionToken": DemoDataProvider.demoWatchSessionToken,
                "expiresAt": Self.iso.string(from: Date().addingTimeInterval(3600)),
                "memberName": memberName ?? "",
            ])
            #endif
        }
    }

    private func pushContext(_ context: [String: Any]) {
        guard WCSession.isSupported() else { return }
        let session = WCSession.default
        guard session.activationState == .activated else { return }
        // updateApplicationContext throws only on encoding errors; our payload
        // is plist-safe strings/bools.
        try? session.updateApplicationContext(context)
    }

    private func reSyncIfSignedIn() {
        Task { @MainActor in
            guard SessionStore.hasSession else { return }
            syncWatchSession(memberName: currentMemberName?())
        }
    }

    private static let iso: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        return f
    }()

    // MARK: - WCSessionDelegate

    func session(
        _ session: WCSession,
        activationDidCompleteWith activationState: WCSessionActivationState,
        error: Error?
    ) {
        guard activationState == .activated else { return }
        // Already signed in on relaunch? Push the current token now.
        reSyncIfSignedIn()
    }

    // iOS-only lifecycle: the phone can switch between paired watches.
    func sessionDidBecomeInactive(_ session: WCSession) {}

    func sessionDidDeactivate(_ session: WCSession) {
        // Reactivate so a newly-paired watch is handled.
        WCSession.default.activate()
    }

    func sessionReachabilityDidChange(_ session: WCSession) {
        reSyncIfSignedIn()
    }

    func sessionWatchStateDidChange(_ session: WCSession) {
        reSyncIfSignedIn()
    }
}
