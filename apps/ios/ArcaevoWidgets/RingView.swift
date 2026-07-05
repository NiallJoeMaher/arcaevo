import SwiftUI

// MARK: - Shared readiness ring (amber at worst, gold while calibrating)

struct GlanceRing: View {
    let glance: GlanceDTO
    var lineWidth: CGFloat = 6
    var glyphSize: CGFloat = 15

    var body: some View {
        ZStack {
            Circle()
                .stroke(Color.primary.opacity(0.16), lineWidth: lineWidth)
            Circle()
                .trim(from: 0, to: max(0.001, min(1, glance.ringFraction)))
                .stroke(
                    glance.ringAccent,
                    style: StrokeStyle(lineWidth: lineWidth, lineCap: .round)
                )
                .rotationEffect(.degrees(-90))
            Text(glance.ringGlyph)
                .font(.system(size: glyphSize, weight: .medium, design: .monospaced))
                .minimumScaleFactor(0.6)
                .lineLimit(1)
        }
    }
}

// MARK: - Small accessibility-friendly label helpers

extension GlanceDTO {
    /// VoiceOver line — spoken, honest, never a raw alarming value.
    var accessibilityLabel: String {
        if isCalibrating { return "Readiness calibrating, day \(calibrationDay ?? 0) of \(calibrationOf ?? 28)" }
        if isSparse { return "Readiness unavailable, no reading last night" }
        if let r = readiness { return "Readiness \(r). \(decisionModel.short)." }
        return statusLine
    }
}
