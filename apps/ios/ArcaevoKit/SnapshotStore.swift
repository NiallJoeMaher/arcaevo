import Foundation

// MARK: - Glance snapshot (widgets / complications / Smart Stack)
//
// The iOS app writes this after every readiness/energy compute; the widget
// and watch-complication extensions read it (read-only). Sub-10-second
// glance rule: everything a Lock Screen surface needs, zero taps.

/// The ten-second-rule payload. `state` gates honesty: extensions must show
/// the calibration ring — never a fake score — while `state == "calibrating"`.
struct GlanceSnapshot: Codable, Hashable {
    /// Blood-recalibrated readiness; nil when the state says not to show one.
    var readiness: Int?
    /// `ReadinessState.key`: "calibrating" | "ok" | "sparseNight" | "sick".
    var state: String
    /// `ReadinessDecision.rawValue`, e.g. "goEasy".
    var decision: String
    /// Current energy value; nil when unknown.
    var energy: Int?
    /// Days to the next expected draw (the T−12 complication); nil unknown.
    var nextTestDays: Int?
    var updatedAt: Date
    /// Calibration progress for the fill ring (additive; set while calibrating).
    var calibrationDay: Int?
    var calibrationOf: Int?

    init(
        readiness: Int?,
        state: String,
        decision: String,
        energy: Int?,
        nextTestDays: Int?,
        updatedAt: Date,
        calibrationDay: Int? = nil,
        calibrationOf: Int? = nil
    ) {
        self.readiness = readiness
        self.state = state
        self.decision = decision
        self.energy = energy
        self.nextTestDays = nextTestDays
        self.updatedAt = updatedAt
        self.calibrationDay = calibrationDay
        self.calibrationOf = calibrationOf
    }
}

/// JSON store in the shared App Group container so extension targets can
/// read what the app computed. Falls back to Application Support when the
/// app-group entitlement isn't present (e.g. simulator dev builds before the
/// widget target lands), so writes never crash and the app keeps working.
enum SnapshotStore {

    static let appGroupID = "group.co.arcaevo.app"
    static let fileName = "glance-snapshot.json"

    static var fileURL: URL? {
        if let container = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroupID) {
            return container.appendingPathComponent(fileName)
        }
        // Fallback: private Application Support (app-only; widgets won't see
        // it, but nothing crashes while the entitlement is pending).
        guard let support = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first
        else { return nil }
        try? FileManager.default.createDirectory(at: support, withIntermediateDirectories: true)
        return support.appendingPathComponent(fileName)
    }

    private static let encoder: JSONEncoder = {
        let e = JSONEncoder()
        e.dateEncodingStrategy = .iso8601
        e.outputFormatting = [.sortedKeys]
        return e
    }()

    private static let decoder: JSONDecoder = {
        let d = JSONDecoder()
        d.dateDecodingStrategy = .iso8601
        return d
    }()

    /// Atomic best-effort write — glance data must never take the app down.
    static func write(_ snapshot: GlanceSnapshot) {
        guard let url = fileURL, let data = try? encoder.encode(snapshot) else { return }
        try? data.write(to: url, options: .atomic)
    }

    static func read() -> GlanceSnapshot? {
        guard let url = fileURL, let data = try? Data(contentsOf: url) else { return nil }
        return try? decoder.decode(GlanceSnapshot.self, from: data)
    }
}

extension GlanceSnapshot {
    /// Builds the snapshot from the engines' outputs, honouring the
    /// scores-never-bluff rule (no number while calibrating/sparse).
    init(readiness: ReadinessResult?, energy: EnergyDay?, nextTestDays: Int?, now: Date = Date()) {
        var calibrationDay: Int?
        var calibrationOf: Int?
        if case let .calibrating(day, of) = readiness?.state {
            calibrationDay = day
            calibrationOf = of
        }
        self.init(
            readiness: (readiness?.state.showsScore ?? false) ? readiness?.final : nil,
            state: readiness?.state.key ?? "calibrating",
            decision: readiness?.decision.rawValue ?? ReadinessDecision.rest.rawValue,
            energy: energy?.value(at: now),
            nextTestDays: nextTestDays,
            updatedAt: now,
            calibrationDay: calibrationDay,
            calibrationOf: calibrationOf
        )
    }
}
