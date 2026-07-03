import Foundation
import Observation

/// Watch-side auth state machine for the golden watch login.
///
/// The watch signs in silently: the phone hands over a device-scoped token
/// (`WatchConnectivityManager`), which we store in the watch keychain and
/// validate against `POST /auth/session/refresh`. Once validated the watch
/// works independently of the phone (over LTE/Wi-Fi with the phone away).
///
/// States: `.unknown` (before the first refresh) → `.authenticated(member)`
/// (a live token) or `.signedOut` (no token, or the token is dead).
@MainActor
@Observable
final class WatchAuthManager {
    enum State: Equatable {
        case unknown
        case authenticated(name: String?)
        case signedOut
    }

    var state: State = .unknown

    /// True only when a real server refresh has succeeded — data calls fetch
    /// live member data. In DEBUG demo mode (no token) this stays false and
    /// callers fall back to seeded demo data.
    private(set) var isLive = false

    /// Drives the root view: show the 6 authenticated screens, or the
    /// "Finish setup on your iPhone" screen?
    /// - `.authenticated` → real (or DEBUG-demo) screens.
    /// - `.signedOut` → setup screen.
    /// - `.unknown` (transient, before first refresh): DEBUG shows demo
    ///   screens; Release shows setup until the refresh resolves.
    var showsAuthenticatedExperience: Bool {
        switch state {
        case .authenticated: return true
        case .signedOut: return false
        case .unknown:
            #if DEBUG
            return true
            #else
            return false
            #endif
        }
    }

    /// Member's display name once known (context hint, then authoritative from
    /// refresh).
    var memberName: String? {
        if case .authenticated(let name) = state { return name }
        return nil
    }

    // MARK: - Lifecycle entry points (launch + foreground)

    /// On launch and on every foreground: validate the stored token (if any).
    func refresh() async {
        guard WatchSessionStore.hasToken else {
            // No token yet — the phone hasn't handed one over.
            #if DEBUG
            state = .authenticated(name: WatchSessionStore.memberName) // demo
            isLive = false
            #else
            state = .signedOut
            isLive = false
            #endif
            return
        }

        if await performRefresh() { return }

        // performRefresh returned false. If it hit a 401 it already cleared the
        // token and set `.signedOut`, so a token still present here means a
        // transient network failure (e.g. brief LTE drop) — stay authenticated
        // optimistically using the last known name; a later data-call 401 will
        // correct us if the token is genuinely dead. This is what keeps the
        // watch working with the phone in a drawer.
        if WatchSessionStore.hasToken {
            state = .authenticated(name: WatchSessionStore.memberName)
            isLive = false
        }
    }

    /// Called from `WatchConnectivityManager` when a fresh token arrives.
    func onTokenReceived() async {
        await refresh()
    }

    /// Called from `WatchConnectivityManager` on a `{signedOut: true}` context.
    func markSignedOut() {
        WatchSessionStore.clear()
        state = .signedOut
        isLive = false
    }

    // MARK: - Data calls (Bearer = watch token; one silent refresh on 401)

    /// Runs a data call with the watch token. On 401 it attempts exactly ONE
    /// silent refresh and retries; if the refresh (or the retry) also 401s the
    /// token is dead → `.signedOut`. Never loops. Returns nil on any failure
    /// (callers fall back to demo/empty state).
    func authedDataCall<T>(_ call: (APIClient) async throws -> T) async -> T? {
        guard let token = WatchSessionStore.token else { return nil }
        do {
            return try await call(APIClient(token: token))
        } catch {
            guard Self.isUnauthorized(error) else { return nil }
            // One silent refresh, then one retry.
            guard await performRefresh(), let fresh = WatchSessionStore.token else {
                return nil // performRefresh already handled a 401 → signedOut
            }
            do {
                return try await call(APIClient(token: fresh))
            } catch {
                if Self.isUnauthorized(error) { markSignedOut() }
                return nil
            }
        }
    }

    // MARK: - Private

    /// Calls `POST /auth/session/refresh` once. Returns true on success.
    /// A 401 clears the token and sets `.signedOut`; other errors leave state
    /// untouched (caller decides).
    @discardableResult
    private func performRefresh() async -> Bool {
        guard let token = WatchSessionStore.token else { return false }
        do {
            let refreshed = try await APIClient(token: token).refreshWatchSession()
            WatchSessionStore.updateExpiry(refreshed.expiresAt, memberName: refreshed.member.name)
            state = .authenticated(name: refreshed.member.name ?? WatchSessionStore.memberName)
            isLive = true
            return true
        } catch {
            if Self.isUnauthorized(error) {
                markSignedOut()
            }
            #if DEBUG
            // Offline dev with a token present: don't bounce to setup — demo.
            if !Self.isUnauthorized(error) {
                state = .authenticated(name: WatchSessionStore.memberName)
                isLive = false
            }
            #endif
            return false
        }
    }

    private static func isUnauthorized(_ error: Error) -> Bool {
        if case APIClient.APIError.server(let status, _, _) = error, status == 401 { return true }
        if case APIClient.APIError.badStatus(401) = error { return true }
        return false
    }
}
