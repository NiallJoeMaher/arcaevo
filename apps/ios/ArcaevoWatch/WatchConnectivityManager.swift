import Foundation
import WatchConnectivity

/// Watch side of the golden-watch-login handoff. Receives the device-scoped
/// watch token the iPhone pushes via `updateApplicationContext`, stores it in
/// the watch keychain, and asks `WatchAuthManager` to validate it.
///
/// `updateApplicationContext` delivers the LATEST state even if the token was
/// pushed while this app wasn't running, so we also read
/// `receivedApplicationContext` at activation to catch a token handed over
/// earlier.
final class WatchConnectivityManager: NSObject, WCSessionDelegate {
    static let shared = WatchConnectivityManager()

    /// Wired by `ArcaevoWatchApp` on launch (main actor).
    weak var auth: WatchAuthManager?

    private override init() { super.init() }

    func activate() {
        guard WCSession.isSupported() else { return }
        let session = WCSession.default
        session.delegate = self
        session.activate()
    }

    // MARK: - WCSessionDelegate

    func session(
        _ session: WCSession,
        activationDidCompleteWith activationState: WCSessionActivationState,
        error: Error?
    ) {
        guard activationState == .activated else { return }
        // Pick up a token the phone pushed while we were asleep / not running.
        let context = session.receivedApplicationContext
        if !context.isEmpty {
            Task { @MainActor in handle(context) }
        }
    }

    func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
        Task { @MainActor in handle(applicationContext) }
    }

    // MARK: - Context handling

    @MainActor
    private func handle(_ context: [String: Any]) {
        // Sign-out wins: clear the token and show the setup screen.
        if let signedOut = context["signedOut"] as? Bool, signedOut {
            auth?.markSignedOut()
            return
        }

        guard let token = context["watchSessionToken"] as? String, !token.isEmpty else { return }

        let expiresAt = (context["expiresAt"] as? String).flatMap { Self.iso.date(from: $0) }
        let rawName = context["memberName"] as? String
        let memberName = (rawName?.isEmpty == false) ? rawName : nil

        WatchSessionStore.store(token: token, expiresAt: expiresAt, memberName: memberName)
        Task { await auth?.onTokenReceived() }
    }

    private static let iso: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        return f
    }()
}
