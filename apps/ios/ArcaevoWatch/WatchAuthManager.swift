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

    /// What the root view should present.
    enum Presentation {
        case loading        // transient, before the first refresh resolves
        case authenticated  // the 6 watch screens (real data, or demo when on)
        case setup          // "Finish setup on your iPhone"
    }

    /// Drives the root view:
    /// - `.authenticated` → real (or demo, when `WatchDemoMode` is on) screens.
    /// - `.signedOut` → setup screen.
    /// - `.unknown` (before first refresh): demo mode shows the seeded screens;
    ///   otherwise a brief loading state (never demo) until `refresh()` flips
    ///   us to authenticated or setup.
    var presentation: Presentation {
        switch state {
        case .authenticated: return .authenticated
        case .signedOut: return .setup
        case .unknown:
            return WatchDemoMode.isEnabled ? .authenticated : .loading
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
            if WatchDemoMode.isEnabled {
                state = .authenticated(name: WatchSessionStore.memberName) // demo
            } else {
                // Real path: nothing to sign in with → finish setup on iPhone.
                state = .signedOut
            }
            isLive = false
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
            } else if WatchDemoMode.isEnabled {
                // Offline dev in demo mode with a token present: don't bounce to
                // setup — keep the seeded screens up. (On the real path a
                // transient failure is handled by `refresh()`, which stays
                // authenticated optimistically off the still-present token.)
                state = .authenticated(name: WatchSessionStore.memberName)
                isLive = false
            }
            return false
        }
    }

    private static func isUnauthorized(_ error: Error) -> Bool {
        if case APIClient.APIError.server(let status, _, _) = error, status == 401 { return true }
        if case APIClient.APIError.badStatus(401) = error { return true }
        return false
    }
}
