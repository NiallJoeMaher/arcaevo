import SwiftUI

// MARK: - Glance snapshot DTO (App-Group read-only mirror)
//
// The iOS app (AppModel) writes `GlanceSnapshot` (ArcaevoKit/SnapshotStore) to
// the shared App-Group container after every readiness/energy compute. This
// extension is deliberately lightweight — it does NOT link ArcaevoKit — so it
// carries a local Codable mirror with the SAME field names + ISO-8601 dates,
// which decodes the identical JSON. If the schema ever changes, keep this in
// sync (owner of the schema: Wave 1a's SnapshotStore).

struct GlanceDTO: Codable, Hashable {
    var readiness: Int?
    var state: String
    var decision: String
    var energy: Int?
    var nextTestDays: Int?
    var updatedAt: Date
    var calibrationDay: Int?
    var calibrationOf: Int?
}

enum GlanceReader {
    static let appGroupID = "group.co.arcaevo.app"
    static let fileName = "glance-snapshot.json"

    private static let decoder: JSONDecoder = {
        let d = JSONDecoder()
        d.dateDecodingStrategy = .iso8601
        return d
    }()

    static func read() -> GlanceDTO? {
        guard
            let container = FileManager.default.containerURL(
                forSecurityApplicationGroupIdentifier: appGroupID
            )
        else { return nil }
        let url = container.appendingPathComponent(fileName)
        guard let data = try? Data(contentsOf: url) else { return nil }
        return try? decoder.decode(GlanceDTO.self, from: data)
    }

    /// Placeholder / gallery / no-data snapshot — honest calibration state,
    /// never a fabricated score.
    static let placeholder = GlanceDTO(
        readiness: 62,
        state: "ok",
        decision: "goEasy",
        energy: 54,
        nextTestDays: 12,
        updatedAt: Date(),
        calibrationDay: nil,
        calibrationOf: nil
    )
}

// MARK: - Decision → copy + colour (amber at worst, never red)

enum Decision: String {
    case trainHard, trainAsPlanned, goEasy, rest

    init(_ raw: String) { self = Decision(rawValue: raw) ?? .rest }

    var short: String {
        switch self {
        case .trainHard: return "Train hard today"
        case .trainAsPlanned: return "Train as planned"
        case .goEasy: return "Go easy today"
        case .rest: return "Rest today"
        }
    }

    var ceiling: Int {
        switch self {
        case .trainHard: return 9
        case .trainAsPlanned: return 7
        case .goEasy: return 4
        case .rest: return 1
        }
    }

    /// Ring / accent tone. Positive decisions read green; easy/rest read amber
    /// — the deliberate ceiling on alarm (no red anywhere on a glance surface).
    var accent: Color {
        switch self {
        case .trainHard, .trainAsPlanned: return WColor.green
        case .goEasy, .rest: return WColor.amber
        }
    }
}

// MARK: - Brand colours (inlined so the extension links nothing heavy)

enum WColor {
    static func hex(_ hex: UInt32) -> Color {
        Color(
            .sRGB,
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255,
            opacity: 1
        )
    }
    static let green = hex(0x34A07C)
    static let brightGreen = hex(0x7FD3AE)
    static let amber = hex(0xD99A4E)
    static let gold = hex(0xD9C9A4)
    static let ink = hex(0x1C2620)
    static let cream = hex(0xF4F1EA)
    static let mutedOnDark = hex(0x8FA89A)
}

// MARK: - Glance helpers shared by the widget views

extension GlanceDTO {
    var isCalibrating: Bool { state == "calibrating" }
    var isSparse: Bool { state == "sparseNight" }
    var decisionModel: Decision { Decision(decision) }

    /// Ring accent: gold while calibrating (no number), decision tone otherwise.
    var ringAccent: Color { isCalibrating ? WColor.gold : decisionModel.accent }

    /// Fraction 0…1 for the readiness ring; calibration progress while calibrating.
    var ringFraction: Double {
        if isCalibrating, let d = calibrationDay, let of = calibrationOf, of > 0 {
            return Double(d) / Double(of)
        }
        return Double(readiness ?? 0) / 100
    }

    /// The centred glyph — the score, "•••" while calibrating, "—" when sparse.
    var ringGlyph: String {
        if isCalibrating { return "\(calibrationDay ?? 0)/\(calibrationOf ?? 28)" }
        if isSparse || readiness == nil { return "—" }
        return "\(readiness!)"
    }

    /// One-line status honouring the degraded states (§6).
    var statusLine: String {
        if isCalibrating { return "Calibrating your baseline" }
        if isSparse { return "No read last night" }
        if state == "sick" { return "Rest — recover first" }
        return decisionModel.short
    }
}
