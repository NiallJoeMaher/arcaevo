import Foundation

/// Runtime, DEBUG-only gate for the offline/demo experience.
///
/// DEFAULT **false**: the app runs the REAL end-to-end flow — real magic-link
/// sign-in, real `/api/v1` data, real phone→watch handoff. Demo is an OPT-IN
/// runtime toggle (Account → "Demo mode", DEBUG only) backed by UserDefaults,
/// so flipping it re-routes every demo-fallback site without a rebuild.
///
/// In a Release (production) build this is a compile-time `false`, so no demo
/// bearer token, demo session, or fabricated member/health data can ever be
/// sent to — or shown against — a real backend, and there is no toggle. See
/// docs/MOCKED_APIS.md §4 (demo token / ATS / base-URL prod requirements).
enum DemoMode {
    #if DEBUG
    static let defaultsKey = "arcaevo.demoMode"
    static var isEnabled: Bool {
        get { UserDefaults.standard.object(forKey: defaultsKey) as? Bool ?? false }
        set { UserDefaults.standard.set(newValue, forKey: defaultsKey) }
    }
    #else
    static let isEnabled = false
    #endif
}

/// Thin async/await URLSession client for the Arcaevo web backend
/// (`apps/web` — `/api/v1`).
///
/// Auth ladder:
///  1. explicit `token` override passed to `init`
///  2. keychain session token (`SessionStore`) from magic-link verification
///  3. (DEBUG only) legacy `demo-member-token` — a documented mock, see
///     docs/MOCKED_APIS.md §4 — so everything still demos signed out.
///
/// In Release, an unauthenticated request carries NO `Authorization` header
/// (never the demo token), so the backend returns 401 and the app routes to
/// real magic-link sign-in rather than a demo member.
struct APIClient {
    enum APIError: Error, LocalizedError {
        case badURL
        case badStatus(Int)
        /// Structured backend error (`{ error, message }` bodies).
        case server(status: Int, code: String?, message: String?)

        var errorDescription: String? {
            switch self {
            case .badURL: return "Bad URL"
            case .badStatus(let status): return "Request failed (\(status))"
            case .server(let status, _, let message):
                return message ?? "Request failed (\(status))"
            }
        }
    }

    /// Base URL, configured per build configuration via the `ARCAEVO_API_BASE_URL`
    /// Info.plist key (Debug → http://localhost:3000/api/v1,
    /// Release → https://arcaevo.com/api/v1; see project.yml + the per-config
    /// Info.plist files). Falls back to production HTTPS — never plaintext HTTP.
    static let defaultBaseURL: URL = {
        if let raw = Bundle.main.object(forInfoDictionaryKey: "ARCAEVO_API_BASE_URL") as? String {
            let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
            if let url = URL(string: trimmed), url.scheme != nil, url.host != nil {
                return url
            }
        }
        // Safe fallback: production HTTPS. Never plaintext HTTP in Release.
        return URL(string: "https://arcaevo.com/api/v1")!
    }()

    static let demoToken = "demo-member-token"

    let baseURL: URL
    /// Explicit token override; nil → SessionStore, then demo token.
    let tokenOverride: String?
    private let session: URLSession

    init(baseURL: URL = APIClient.defaultBaseURL, token: String? = nil) {
        self.baseURL = baseURL
        self.tokenOverride = token
        let config = URLSessionConfiguration.ephemeral
        // Fail fast so the demo-data fallback kicks in quickly when the
        // local backend isn't running.
        config.timeoutIntervalForRequest = 3
        config.timeoutIntervalForResource = 5
        self.session = URLSession(configuration: config)
    }

    /// Bearer resolved per request so signing in/out takes effect immediately.
    /// `nil` when there is no real session — in Release that means no
    /// `Authorization` header at all (the demo token is DEBUG-only).
    var bearerToken: String? {
        if let tokenOverride { return tokenOverride }
        if let session = SessionStore.token { return session }
        return DemoMode.isEnabled ? Self.demoToken : nil
    }

    /// The web app's origin (base URL minus `/api/v1`) — used for link-outs.
    var webBaseURL: URL {
        var components = URLComponents(url: baseURL, resolvingAgainstBaseURL: false)!
        components.path = ""
        components.query = nil
        return components.url ?? baseURL
    }

    // MARK: - Endpoints

    /// `GET /config` (public, no auth) — server-controlled feature gates.
    /// The web side owns this endpoint; the app reads `bloodTiersEnabled` to
    /// decide whether the paid blood-testing tiers are offered. FAIL-SAFE:
    /// callers default `bloodTiersEnabled` to `false` on any failure, so the
    /// blood tiers are never shown as purchasable on an unknown flag.
    func appConfig() async throws -> AppConfig {
        try await get("config")
    }

    /// `GET /biomarker-rules` (public, no auth) — the CANONICAL RCV thresholds.
    /// The web side owns these numbers; the app prefers them over its hardcoded
    /// `BiomarkerRuleLite.defaults` so web ↔ iOS can't disagree on what counts
    /// as a "real" change. FAIL-SAFE: callers fall back to the matching
    /// hardcoded defaults on any failure (offline / unreachable / bad payload).
    func biomarkerRules() async throws -> BiomarkerRulesResponse {
        try await get("biomarker-rules")
    }

    /// Convenience: the canonical rule table with server RCV % merged onto the
    /// hardcoded defaults, or the pure defaults if the fetch fails. Never
    /// throws — safe to call unconditionally before running the Vitality engine.
    func biomarkerRulesOrDefaults() async -> [BiomarkerRuleLite] {
        guard let response = try? await biomarkerRules() else {
            return BiomarkerRuleLite.defaults
        }
        return BiomarkerRuleLite.merging(serverRcvPercent: response.rcvPercentByCode)
    }

    func me() async throws -> User {
        try await get("members/me")
    }

    /// Authed activation check for the post-checkout return path. Decodes ONLY
    /// the membership `status` from `GET /members/me` (backend shape:
    /// `{ member, membership: { status, … } }`), so it works independently of
    /// the fuller `me()` decode. Returns the raw status string — `"active"`
    /// means a backend-confirmed *paid* membership; `nil` means the member has
    /// no membership row yet (checkout not completed / webhook not landed).
    /// The client-side plan is only ever flipped when this returns `"active"`.
    func membershipStatus() async throws -> String? {
        struct MeResponse: Decodable {
            struct MembershipStatus: Decodable { var status: String? }
            var membership: MembershipStatus?
        }
        let response: MeResponse = try await get("members/me")
        return response.membership?.status
    }

    func results() async throws -> [BiomarkerReading] {
        try await get("results")
    }

    func insights() async throws -> [Insight] {
        try await get("insights")
    }

    func orders() async throws -> [TestOrder] {
        try await get("orders")
    }

    func createOrder(_ request: CreateOrderRequest) async throws -> TestOrder {
        try await post("orders", body: request)
    }

    /// Pushes locally-read Apple Health daily signals to the backend.
    /// Best-effort; callers may ignore failures.
    func syncWearables(_ signals: [WearableSignal]) async throws {
        let _: SyncAck = try await post("sync/wearables", body: SyncRequest(source: "apple_health", signals: signals))
    }

    private struct SyncRequest: Codable {
        var source: String
        var signals: [WearableSignal]
    }

    private struct SyncAck: Codable {
        var ok: Bool?
        var received: Int?
    }

    // MARK: - v2 endpoints — auth (email + magic link ONLY; no social/SIWA)

    /// `POST /auth/magic-link` — request a sign-in/verify link. 202 whether
    /// or not the email exists (non-revealing). 429 when throttled (60s).
    ///
    /// DEV NOTE: with the local backend the email lands in the Mongo outbox
    /// (`emails` collection) — the app can't read that, so the verify screen
    /// offers a dev-only "paste link/token" affordance.
    func requestMagicLink(email: String, purpose: String = "signin") async throws -> MagicLinkRequested {
        try await post("auth/magic-link", body: ["email": email, "purpose": purpose])
    }

    /// `POST /auth/magic-link/verify` — redeem a token (from the universal
    /// link `https://arcaevo.com/verify?token=…` or `arcaevo://verify`).
    /// The caller stores `sessionToken` via `SessionStore.store(_:)`.
    func verifyMagicLink(token: String) async throws -> Session {
        try await post("auth/magic-link/verify", body: ["token": token])
    }

    /// `POST /auth/magic-link/verify` via the prefetch-safe CODE path — the
    /// human types the short code from the email when a security appliance ate
    /// their universal link. Same endpoint, same `Session` result; the code is
    /// scoped to `email`. Works in Release (no DEBUG gate).
    func verifyMagicLinkCode(email: String, code: String) async throws -> Session {
        try await post("auth/magic-link/verify", body: ["email": email, "code": code])
    }

    // MARK: - v2 endpoints — consents (GDPR Art. 9)

    func getConsents() async throws -> ConsentsState {
        try await get("consents")
    }

    /// Records grants/withdrawals — append-only, versioned. Surface is
    /// always "ios" from this client.
    func postConsents(_ grants: [ConsentGrant], surface: String = "ios") async throws -> ConsentsState {
        struct Body: Encodable {
            var surface: String
            var grants: [ConsentGrant]
        }
        return try await post("consents", body: Body(surface: surface, grants: grants))
    }

    // MARK: - v2 endpoints — eligibility gate + waitlist

    /// `POST /eligibility/check` — routing-key-only Eircode gate. Throws
    /// `.server(status: 422, …)` for malformed Eircodes.
    func checkEligibility(eircode: String) async throws -> EligibilityResult {
        try await post("eligibility/check", body: ["eircode": eircode])
    }

    /// `POST /waitlist` — join the early-access list (idempotent per email).
    func joinWaitlist(email: String, eircode: String) async throws -> WaitlistJoined {
        try await post("waitlist", body: ["email": email, "eircode": eircode])
    }

    func waitlistPosition(email: String? = nil) async throws -> WaitlistPosition {
        var path = "waitlist"
        if let email, var comps = URLComponents(string: path) {
            comps.queryItems = [URLQueryItem(name: "email", value: email)]
            path = comps.string ?? path
        }
        return try await get(path)
    }

    // MARK: - v2 endpoints — bloodwork upload → confirm (self-reported)

    /// `POST /uploads/bloodwork` — upload → AI extraction. Nothing enters
    /// the timeline until `confirmBloodwork`; low-confidence values block.
    /// MOCK: no file bytes travel — the backend fabricates the extraction
    /// from `fileName` (docs/MOCKED_APIS.md §11).
    func uploadBloodwork(
        kind: BloodworkUploadKind,
        fileName: String? = nil,
        manualValues: [ManualBloodworkValue]? = nil
    ) async throws -> BloodworkExtraction {
        struct Body: Encodable {
            var kind: BloodworkUploadKind
            var fileName: String?
            var manualValues: [ManualBloodworkValue]?
        }
        return try await post(
            "uploads/bloodwork",
            body: Body(kind: kind, fileName: fileName, manualValues: manualValues)
        )
    }

    /// `POST /uploads/bloodwork/confirm` — "Looks right — add all N".
    /// Every flagged marker must appear in `values`; `takenAt` is YYYY-MM-DD.
    func confirmBloodwork(
        uploadId: String,
        values: [ConfirmedBloodworkValue],
        takenAt: String
    ) async throws -> BloodworkConfirmed {
        struct Body: Encodable {
            var uploadId: String
            var values: [ConfirmedBloodworkValue]
            var takenAt: String
        }
        return try await post(
            "uploads/bloodwork/confirm",
            body: Body(uploadId: uploadId, values: values, takenAt: takenAt)
        )
    }

    // MARK: - v2 endpoints — GP share links

    func shareLinks() async throws -> [ShareLinkInfo] {
        let list: ShareLinkList = try await get("share")
        return list.links
    }

    func createShareLink(expiresInDays: Int = 30) async throws -> ShareLinkCreated {
        try await post("share", body: ["expiresInDays": expiresInDays])
    }

    func revokeShareLink(token: String) async throws -> ShareLinkRevoked {
        try await delete("share/\(token)")
    }

    // MARK: - v2 — checkout link-out (payments are ALWAYS web; no IAP)

    /// The web checkout URL for a tier — the app opens this in the browser
    /// (`SITE_URL/checkout?tier=…`; Fusion included for one consistent path,
    /// even though Fusion is never Eircode-gated).
    func checkoutURL(tier: Membership.Tier) -> URL {
        var comps = URLComponents(url: webBaseURL, resolvingAgainstBaseURL: false)!
        comps.path = "/checkout"
        comps.queryItems = [URLQueryItem(name: "tier", value: tier.rawValue)]
        return comps.url ?? webBaseURL
    }

    // MARK: - v3 endpoints — golden watch login (device-scoped watch session)

    /// `POST /auth/watch-session` — PHONE-authed (this client resolves the
    /// member session token). Mints a device-scoped, independently-revocable
    /// watch token; the phone hands it to the watch over WatchConnectivity.
    func mintWatchSession() async throws -> WatchSessionMinted {
        try await post("auth/watch-session", body: EmptyRequestBody())
    }

    /// `POST /auth/session/refresh` — WATCH-authed. Construct this client with
    /// the watch token (`APIClient(token:)`) so the Bearer is the watch's own
    /// credential. 200 slides expiry; 401 → the token is dead.
    func refreshWatchSession() async throws -> WatchSessionRefreshed {
        try await post("auth/session/refresh", body: EmptyRequestBody())
    }

    /// `POST /auth/watch-session/revoke` — PHONE-authed. Logs the watch out on
    /// sign-out. Best-effort; the response body (if any) is ignored.
    func revokeWatchSession() async throws {
        try await postNoContent("auth/watch-session/revoke", body: EmptyRequestBody())
    }

    private struct EmptyRequestBody: Encodable {}

    // MARK: - Plumbing

    private func get<T: Decodable>(_ path: String) async throws -> T {
        try await send(request(for: path, method: "GET"))
    }

    private func post<T: Decodable, Body: Encodable>(_ path: String, body: Body) async throws -> T {
        var req = request(for: path, method: "POST")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try Self.encoder.encode(body)
        return try await send(req)
    }

    private func delete<T: Decodable>(_ path: String) async throws -> T {
        try await send(request(for: path, method: "DELETE"))
    }

    /// POST that ignores the response body — for endpoints whose success shape
    /// is empty or irrelevant (e.g. watch-session revoke). Still surfaces the
    /// backend's structured error on a non-2xx.
    private func postNoContent<Body: Encodable>(_ path: String, body: Body) async throws {
        var req = request(for: path, method: "POST")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try Self.encoder.encode(body)
        let (data, response) = try await session.data(for: req)
        if let http = response as? HTTPURLResponse, !(200...299).contains(http.statusCode) {
            if let bodyErr = try? JSONDecoder().decode(ServerErrorBody.self, from: data) {
                throw APIError.server(status: http.statusCode, code: bodyErr.error, message: bodyErr.message)
            }
            throw APIError.badStatus(http.statusCode)
        }
    }

    private func request(for path: String, method: String) -> URLRequest {
        // appendingPathComponent percent-escapes "?" — resolve query'd paths
        // against the base instead.
        let url = URL(string: path, relativeTo: baseURL.appendingPathComponent("")) ?? baseURL.appendingPathComponent(path)
        var req = URLRequest(url: path.contains("?") ? url : baseURL.appendingPathComponent(path))
        req.httpMethod = method
        // Only attach auth when we actually have a token. In Release with no
        // real session this is nil, so no demo token is ever sent.
        if let bearer = bearerToken {
            req.setValue("Bearer \(bearer)", forHTTPHeaderField: "Authorization")
        }
        req.setValue("application/json", forHTTPHeaderField: "Accept")
        return req
    }

    private func send<T: Decodable>(_ request: URLRequest) async throws -> T {
        let (data, response) = try await session.data(for: request)
        if let http = response as? HTTPURLResponse, !(200...299).contains(http.statusCode) {
            // Surface the backend's `{ error, message }` shape when present
            // (throttle copy, eligibility messages, blocked confirms, …).
            if let body = try? JSONDecoder().decode(ServerErrorBody.self, from: data) {
                throw APIError.server(status: http.statusCode, code: body.error, message: body.message)
            }
            throw APIError.badStatus(http.statusCode)
        }
        return try Self.decodeFlexible(data)
    }

    private struct ServerErrorBody: Decodable {
        var error: String?
        var message: String?
    }

    /// Accepts either a bare payload or a `{ "data": ... }` envelope, so the
    /// client keeps working whichever shape the backend settles on.
    private static func decodeFlexible<T: Decodable>(_ data: Data) throws -> T {
        if let direct = try? decoder.decode(T.self, from: data) {
            return direct
        }
        return try decoder.decode(Envelope<T>.self, from: data).data
    }

    private struct Envelope<T: Decodable>: Decodable {
        let data: T
    }

    // MARK: - Coding

    private static let isoWithFractional: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()

    private static let iso: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        return f
    }()

    static let decoder: JSONDecoder = {
        let d = JSONDecoder()
        d.dateDecodingStrategy = .custom { decoder in
            let container = try decoder.singleValueContainer()
            let raw = try container.decode(String.self)
            if let date = isoWithFractional.date(from: raw) ?? iso.date(from: raw) {
                return date
            }
            throw DecodingError.dataCorruptedError(
                in: container,
                debugDescription: "Unrecognised date format: \(raw)"
            )
        }
        return d
    }()

    static let encoder: JSONEncoder = {
        let e = JSONEncoder()
        e.dateEncodingStrategy = .iso8601
        return e
    }()
}
