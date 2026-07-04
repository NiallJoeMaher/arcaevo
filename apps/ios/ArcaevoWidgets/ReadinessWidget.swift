import WidgetKit
import SwiftUI

// MARK: - Readiness widget
// Lock Screen: accessoryCircular (ring), accessoryRectangular (ring + decision),
// accessoryInline (one line). Home Screen: systemSmall (the morning read).

struct ReadinessWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "ArcaevoReadiness", provider: GlanceProvider()) { entry in
            ReadinessWidgetView(glance: entry.glance)
                .containerBackground(for: .widget) { WColor.ink }
        }
        .configurationDisplayName("Readiness")
        .description("Your blood-recalibrated morning readiness — one glance, zero taps.")
        .supportedFamilies([
            .accessoryCircular,
            .accessoryRectangular,
            .accessoryInline,
            .systemSmall,
        ])
    }
}

struct ReadinessWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let glance: GlanceDTO

    var body: some View {
        switch family {
        case .accessoryCircular:
            GlanceRing(glance: glance, lineWidth: 5, glyphSize: 16)
                .widgetAccentable()
                .accessibilityLabel(glance.accessibilityLabel)

        case .accessoryInline:
            // Inline widgets are monochrome one-liners.
            Label {
                Text(glance.isCalibrating ? "Calibrating" : "\(glance.readiness.map(String.init) ?? "—") · \(glance.decisionModel.short)")
            } icon: {
                Image(systemName: "circle.dotted")
            }
            .accessibilityLabel(glance.accessibilityLabel)

        case .accessoryRectangular:
            HStack(spacing: 10) {
                GlanceRing(glance: glance, lineWidth: 4, glyphSize: 13)
                    .frame(width: 34, height: 34)
                    .widgetAccentable()
                VStack(alignment: .leading, spacing: 1) {
                    Text("READINESS")
                        .font(.system(size: 9, weight: .semibold, design: .monospaced))
                        .foregroundStyle(.secondary)
                    Text(glance.statusLine)
                        .font(.system(size: 14, weight: .semibold))
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)
                    if !glance.isCalibrating && !glance.isSparse {
                        Text("Ceiling \(glance.decisionModel.ceiling) of 10")
                            .font(.system(size: 11))
                            .foregroundStyle(.secondary)
                    }
                }
                Spacer(minLength: 0)
            }
            .accessibilityLabel(glance.accessibilityLabel)

        default: // systemSmall (Home Screen)
            VStack(alignment: .leading, spacing: 0) {
                Text("READINESS")
                    .font(.system(size: 9, weight: .semibold, design: .monospaced))
                    .kerning(0.8)
                    .foregroundStyle(WColor.mutedOnDark)
                Spacer(minLength: 0)
                GlanceRing(glance: glance, lineWidth: 8, glyphSize: 30)
                    .frame(width: 74, height: 74)
                    .foregroundStyle(WColor.cream)
                Spacer(minLength: 0)
                Text(glance.statusLine)
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(WColor.cream)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                if !glance.isCalibrating && !glance.isSparse {
                    Text("Ceiling \(glance.decisionModel.ceiling) of 10")
                        .font(.system(size: 11))
                        .foregroundStyle(WColor.mutedOnDark)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
            .accessibilityLabel(glance.accessibilityLabel)
        }
    }
}
