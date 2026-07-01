import Foundation

/// Thin async/await URLSession client for the Arcaevo web backend
/// (`apps/web` — `/api/v1`).
///
/// Auth is a static demo bearer token (`demo-member-token`) — a documented
/// mock, see docs/MOCKED_APIS.md §4. Production replaces this with
/// Sign in with Apple + real token issuance.
struct APIClient {
    enum APIError: Error {
        case badURL
        case badStatus(Int)
    }

    static let defaultBaseURL = URL(string: "http://localhost:3000/api/v1")!
    static let demoToken = "demo-member-token"

    let baseURL: URL
    let token: String
    private let session: URLSession

    init(baseURL: URL = APIClient.defaultBaseURL, token: String = APIClient.demoToken) {
        self.baseURL = baseURL
        self.token = token
        let config = URLSessionConfiguration.ephemeral
        // Fail fast so the demo-data fallback kicks in quickly when the
        // local backend isn't running.
        config.timeoutIntervalForRequest = 3
        config.timeoutIntervalForResource = 5
        self.session = URLSession(configuration: config)
    }

    // MARK: - Endpoints

    func me() async throws -> User {
        try await get("members/me")
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

    private func request(for path: String, method: String) -> URLRequest {
        var req = URLRequest(url: baseURL.appendingPathComponent(path))
        req.httpMethod = method
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        req.setValue("application/json", forHTTPHeaderField: "Accept")
        return req
    }

    private func send<T: Decodable>(_ request: URLRequest) async throws -> T {
        let (data, response) = try await session.data(for: request)
        if let http = response as? HTTPURLResponse, !(200...299).contains(http.statusCode) {
            throw APIError.badStatus(http.statusCode)
        }
        return try Self.decodeFlexible(data)
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
