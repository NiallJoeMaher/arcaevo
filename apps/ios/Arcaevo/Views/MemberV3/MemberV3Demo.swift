import Foundation
import SwiftUI

// MARK: - MemberV3 story data
//
// The member-app screens tell one coherent, deterministic story — the July
// panel narrative — verbatim from Prototype.dc.html's logic class (fusionDB,
// wearDB, chatQA, expSuggestions). It complements `DemoDataProvider` (which
// feeds the live model paths) so every screen demos offline exactly like the
// prototype.
//
// NOTE: `BiomarkerReading` (ArcaevoKit) has no `source` field yet, so the
// lab / self-reported distinction lives on `Mv3FusionPoint.source` here.
// Rule carried over regardless: self-reported = hollow gold, always.

// MARK: Fusion timeline

struct Mv3FusionPoint: Identifiable, Equatable {
    enum Source: Equatable { case lab, selfReported }

    /// Prototype SVG coordinates (viewBox 300×92) — kept as the chart's
    /// data space for pixel fidelity.
    let x: Double
    let y: Double
    let tag: String
    let value: String
    let note: String
    let source: Source

    var id: Double { x }
}

struct Mv3FusionMarker: Identifiable, Equatable {
    let key: String
    let chipLabel: String
    let unit: String
    /// Top edge of the 26pt-tall baseline band, in the 0–92 design space.
    let bandY: Double
    let headline: String
    let points: [Mv3FusionPoint]

    var id: String { key }
}

struct Mv3WearSeries: Identifiable {
    let key: String
    let chipLabel: String
    let caption: String
    /// Prototype polyline, viewBox 300×92.
    let line: [CGPoint]
    /// Real-world values at the line's first/last y — lets the scrubber
    /// show a plausible value at any x (linear map along the y range).
    let valueStart: Double
    let valueEnd: Double
    let format: (Double) -> String

    var id: String { key }

    /// Interpolated design-space y at design-space x.
    func designY(atX x: Double) -> Double {
        guard let first = line.first, let last = line.last else { return 0 }
        if x <= first.x { return first.y }
        if x >= last.x { return last.y }
        for i in 1..<line.count {
            let a = line[i - 1], b = line[i]
            if x <= b.x {
                let t = (x - a.x) / max(b.x - a.x, 0.001)
                return a.y + (b.y - a.y) * t
            }
        }
        return last.y
    }

    /// Mapped real-world value at design-space x.
    func value(atX x: Double) -> Double {
        guard let first = line.first, let last = line.last, first.y != last.y else { return valueStart }
        let y = designY(atX: x)
        return valueStart + (y - first.y) * (valueEnd - valueStart) / (last.y - first.y)
    }
}

// MARK: Chat

struct Mv3ChatQA: Identifiable {
    let key: String
    let question: String
    let answer: String
    let flagged: Bool

    var id: String { key }
}

struct Mv3ChatMessage: Identifiable, Equatable {
    let id = UUID()
    let text: String
    let isUser: Bool
    let flagged: Bool
}

// MARK: The data

enum MemberV3Demo {

    // MARK: Fusion timeline (prototype fusionDB — copy verbatim)

    static let fusionMarkers: [Mv3FusionMarker] = [
        Mv3FusionMarker(
            key: "apob", chipLabel: "APOB", unit: "g/L", bandY: 40,
            headline: "ApoB is falling as your resting heart rate falls.",
            points: [
                Mv3FusionPoint(x: 34, y: 24, tag: "FEB 25 · SELF-REPORTED", value: "1.21",
                               note: "Your first draw on file. Resting HR averaged 61 that month — before the walks started.",
                               source: .selfReported),
                Mv3FusionPoint(x: 150, y: 44, tag: "FEB 26 · ARCAEVO LAB", value: "1.12",
                               note: "Down 7% over a year of steady training. The watch line was already moving first.",
                               source: .lab),
                Mv3FusionPoint(x: 266, y: 58, tag: "JUL 26 · ARCAEVO LAB", value: "0.94",
                               note: "The walks block. ApoB fell almost week for week with your resting HR — this is the experiment working.",
                               source: .lab),
            ]
        ),
        Mv3FusionMarker(
            key: "ferritin", chipLabel: "FERRITIN", unit: "µg/L", bandY: 34,
            headline: "Ferritin drifted down as training load rose.",
            points: [
                Mv3FusionPoint(x: 34, y: 42, tag: "FEB 25 · SELF-REPORTED", value: "44",
                               note: "Comfortably mid-band. Nothing to do.",
                               source: .selfReported),
                Mv3FusionPoint(x: 150, y: 46, tag: "FEB 26 · ARCAEVO LAB", value: "41",
                               note: "Steady, while weekly training hours crept up.",
                               source: .lab),
                Mv3FusionPoint(x: 266, y: 70, tag: "JUL 26 · ARCAEVO LAB", value: "29",
                               note: "Just under your band. Food first — iron-rich meals 3×/week, recheck in January before supplementing.",
                               source: .lab),
            ]
        ),
        Mv3FusionMarker(
            key: "crp", chipLabel: "HS-CRP", unit: "mg/L", bandY: 32,
            headline: "Inflammation is quiet — and your HRV agrees.",
            points: [
                Mv3FusionPoint(x: 34, y: 44, tag: "FEB 25 · SELF-REPORTED", value: "1.1",
                               note: "Low. A quiet marker is good news you get to keep.",
                               source: .selfReported),
                Mv3FusionPoint(x: 150, y: 40, tag: "FEB 26 · ARCAEVO LAB", value: "0.9",
                               note: "Still low, with HRV steady across the winter.",
                               source: .lab),
                Mv3FusionPoint(x: 266, y: 38, tag: "JUL 26 · ARCAEVO LAB", value: "0.8",
                               note: "Low and steady all spring — matches the calm HRV line exactly.",
                               source: .lab),
            ]
        ),
    ]

    // MARK: Wearable overlays (prototype wearDB — lines + captions verbatim)

    static let wearSeries: [Mv3WearSeries] = [
        Mv3WearSeries(
            key: "rhr", chipLabel: "RESTING HR",
            caption: "61 → 54 bpm over the same 17 months. The continuous line often moves before the blood does.",
            line: points("0,24 28,28 56,26 84,32 112,36 140,34 168,42 196,46 224,50 252,54 280,56 300,58"),
            valueStart: 61, valueEnd: 54,
            format: { "\(Int($0.rounded())) BPM" }
        ),
        Mv3WearSeries(
            key: "hrv", chipLabel: "HRV",
            caption: "38 → 52 ms over the same period — recovery improving alongside the blood trend.",
            line: points("0,64 28,58 56,60 84,52 112,50 140,46 168,44 196,40 224,38 252,34 280,32 300,30"),
            valueStart: 38, valueEnd: 52,
            format: { "\(Int($0.rounded())) MS" }
        ),
        Mv3WearSeries(
            key: "sleep", chipLabel: "SLEEP",
            caption: "6h 40m → 7h 15m average. Sleep lifted first; the markers followed.",
            line: points("0,56 28,52 56,58 84,50 112,48 140,52 168,46 196,44 224,46 252,42 280,40 300,38"),
            valueStart: 6.0 + 40.0 / 60.0, valueEnd: 7.25,
            format: { hours in
                let total = Int((hours * 60).rounded())
                return "\(total / 60)H \(String(format: "%02d", total % 60))M"
            }
        ),
    ]

    private static func points(_ svg: String) -> [CGPoint] {
        svg.split(separator: " ").compactMap { pair in
            let xy = pair.split(separator: ",")
            guard xy.count == 2, let x = Double(xy[0]), let y = Double(xy[1]) else { return nil }
            return CGPoint(x: x, y: y)
        }
    }

    /// x-axis of the fusion chart spans FEB 25 → JUL 26 (17 months).
    static func monthLabel(atX x: Double) -> String {
        let months = Int((x / 300 * 17).rounded())
        var components = DateComponents()
        components.year = 2025
        components.month = 2
        components.day = 1
        let calendar = Calendar(identifier: .gregorian)
        guard let base = calendar.date(from: components),
              let date = calendar.date(byAdding: .month, value: months, to: base)
        else { return "" }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_IE")
        formatter.dateFormat = "MMM yy"
        return formatter.string(from: date).uppercased()
    }

    // MARK: Chat (prototype chatQA — copy verbatim)

    static let chatQA: [Mv3ChatQA] = [
        Mv3ChatQA(key: "focus", question: "What should I focus on?",
                  answer: "Keep the evening walks — ApoB is answering them, down 16% since February. The one thing to nudge is ferritin: iron-rich food three times a week, recheck in January.",
                  flagged: false),
        Mv3ChatQA(key: "ferritin", question: "Explain my ferritin",
                  answer: "Ferritin is your iron store. Yours is 29 µg/L — just under your usual band of 38–52. It drifted down while training load rose. Food first; if January's recheck hasn't moved it, we'll talk supplements.",
                  flagged: false),
        Mv3ChatQA(key: "caffeine", question: "Did my caffeine experiment work?",
                  answer: "Yes. Over 14 weeks your deep sleep rose 22 minutes a night and you fell asleep 18 minutes faster. CRP didn't move — that one was about sleep, not inflammation.",
                  flagged: false),
        Mv3ChatQA(key: "flagged", question: "What about my flagged value?",
                  answer: "That one is with Dr. Nolan — she'll call today between 14:00 and 17:00. I don't coach on flagged results; a person reads them with you first.",
                  flagged: true),
    ]

    // MARK: Experiment pickers (prototype expSel spec — options verbatim)

    static let experimentWhats = ["Iron-rich breakfasts", "Screens off by 23:00", "Creatine 5g daily", "No alcohol", "More zone-2"]
    static let experimentDurations = ["2 weeks", "4 weeks", "6 weeks"]
    static let experimentWatchedMarkers = ["Ferritin", "Deep sleep", "ApoB", "HRV"]

    /// "START NEXT · SUGGESTED BY YOUR DATA" rows (verbatim).
    static let experimentSuggestions: [(name: String, why: String)] = [
        ("Iron-rich breakfasts, 3×/week", "Ferritin 29 — food first, recheck in January"),
        ("Screens off by 23:00, two weeks", "Deep sleep drops 31 min on late nights"),
    ]
}

// MARK: - Mock AI narrator

// MOCK: AI chat — no model is called anywhere. This is a deterministic local
// narrator: it keyword-routes the member's question to plain-language copy
// grounded in their seeded demo data (the July-panel story above), exactly
// the way the production narration endpoint will ground answers in the
// member's real results + Watch trends. It is called "AI" in the UI, it only
// narrates — deterministic rules decide — and it never diagnoses; flagged
// values are always routed to the clinician, never coached on.
enum Mv3Narrator {

    static func answer(to question: String) -> (text: String, flagged: Bool) {
        let q = question.lowercased()

        // Exact matches for the designed prompt chips first.
        if let qa = MemberV3Demo.chatQA.first(where: { $0.question.lowercased() == q }) {
            return (qa.answer, qa.flagged)
        }

        // Flagged / critical values → hand off to the clinician, always.
        if q.contains("flag") || q.contains("critical") || q.contains("nolan") || q.contains("doctor") || q.contains("worried") {
            let qa = MemberV3Demo.chatQA[3]
            return (qa.answer, true)
        }
        // ApoB — narrate the seeded story (1.21 → 1.12 → 0.94, the walks).
        if q.contains("apob") || q.contains("cholesterol") || q.contains("lipid") {
            return ("ApoB counts the particles that carry cholesterol into artery walls — a better predictor of heart risk than LDL alone. Yours has gone 1.21 → 1.12 → 0.94 g/L since February 2025, and the drop tracks your 46 logged evening walks almost week for week. Still above your optimal line, but moving the right way.", false)
        }
        if q.contains("ferritin") || q.contains("iron") {
            return (MemberV3Demo.chatQA[1].answer, false)
        }
        if q.contains("caffeine") || q.contains("coffee") {
            return (MemberV3Demo.chatQA[2].answer, false)
        }
        if q.contains("sleep") || q.contains("screen") {
            return ("Your sleep average lifted from 6h 40m to 7h 15m since February 2025 — it moved before the blood markers did. The one pattern that still costs you: on nights with screens after 23:00, deep sleep drops 31 minutes against your own baseline. Worth a two-week experiment once the walks are settled.", false)
        }
        if q.contains("hrv") || q.contains("recovery") || q.contains("inflammation") || q.contains("crp") {
            return ("Your HRV went 38 → 52 ms over the last 17 months — recovery improving alongside the blood trend. Inflammation agrees: hs-CRP is 0.8 mg/L, low and steady all spring. A quiet marker is good news you get to keep.", false)
        }
        if q.contains("heart") || q.contains("rhr") || q.contains("resting") {
            return ("Resting heart rate fell 61 → 54 bpm over the same 17 months your ApoB fell. The continuous line often moves before the blood does — that's the fusion timeline's whole point.", false)
        }
        if q.contains("walk") || q.contains("experiment") || q.contains("focus") || q.contains("should i") {
            return (MemberV3Demo.chatQA[0].answer, false)
        }
        if q.contains("score") {
            return ("Your health score is 74 — up 3 since June. Sleep and ApoB did the lifting. It follows your data, not your effort: it only moves when your baselines do.", false)
        }

        // Honest fallback — never invent, never diagnose.
        return ("I can only narrate what's in your own data — your results, your Watch trends and your experiments. Try asking about ApoB, ferritin, sleep or your caffeine experiment. For anything clinical, Dr. Nolan is the right reader, not me.", false)
    }
}
