import WidgetKit
import SwiftUI

// MARK: - Shared readiness ring (amber at worst; gold while calibrating)

struct ComplicationRing: View {
    let glance: GlanceDTO
    var lineWidth: CGFloat = 5
    var glyphSize: CGFloat = 15

    var body: some View {
        ZStack {
            Circle().stroke(Color.white.opacity(0.18), lineWidth: lineWidth)
            Circle()
                .trim(from: 0, to: max(0.001, min(1, glance.ringFraction)))
                .stroke(glance.ringAccent, style: StrokeStyle(lineWidth: lineWidth, lineCap: .round))
                .rotationEffect(.degrees(-90))
            Text(glance.ringGlyph)
                .font(.system(size: glyphSize, weight: .medium, design: .monospaced))
                .minimumScaleFactor(0.5)
                .lineLimit(1)
        }
    }
}

// MARK: - Readiness complication (circular / corner / rectangular / inline)

struct WatchReadinessComplication: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "ArcaevoWatchReadiness", provider: WatchGlanceProvider()) { entry in
            ReadinessComplicationView(glance: entry.glance)
                .containerBackground(for: .widget) { Color.black }
        }
        .configurationDisplayName("Readiness")
        .description("Your morning readiness on any watch face.")
        .supportedFamilies([
            .accessoryCircular,
            .accessoryCorner,
            .accessoryRectangular,
            .accessoryInline,
        ])
    }
}

struct ReadinessComplicationView: View {
    @Environment(\.widgetFamily) private var family
    let glance: GlanceDTO

    var body: some View {
        switch family {
        case .accessoryCircular:
            ComplicationRing(glance: glance, lineWidth: 5, glyphSize: 16)
                .widgetAccentable()
                .accessibilityLabel(glance.accessibilityLabel)

        case .accessoryCorner:
            Text(glance.ringGlyph)
                .font(.system(size: 17, weight: .medium, design: .monospaced))
                .widgetLabel {
                    Text(glance.statusLine)
                }
                .accessibilityLabel(glance.accessibilityLabel)

        case .accessoryInline:
            Text(glance.isCalibrating ? "Calibrating" : "\(glance.readiness.map(String.init) ?? "—") · \(glance.decisionModel.short)")

        default: // accessoryRectangular
            HStack(spacing: 8) {
                ComplicationRing(glance: glance, lineWidth: 4, glyphSize: 13)
                    .frame(width: 30, height: 30)
                    .widgetAccentable()
                VStack(alignment: .leading, spacing: 0) {
                    Text("READINESS")
                        .font(.system(size: 8, weight: .semibold, design: .monospaced))
                        .foregroundStyle(.secondary)
                    Text(glance.statusLine)
                        .font(.system(size: 13, weight: .semibold))
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)
                    if !glance.isCalibrating && !glance.isSparse {
                        Text("Ceiling \(glance.decisionModel.ceiling) of 10")
                            .font(.system(size: 10))
                            .foregroundStyle(.secondary)
                    }
                }
                Spacer(minLength: 0)
            }
            .accessibilityLabel(glance.accessibilityLabel)
        }
    }
}

// MARK: - Energy complication (circular gauge / corner / inline)

struct WatchEnergyComplication: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "ArcaevoWatchEnergy", provider: WatchGlanceProvider()) { entry in
            EnergyComplicationView(glance: entry.glance)
                .containerBackground(for: .widget) { Color.black }
        }
        .configurationDisplayName("Energy")
        .description("All-day energy against today's ceiling.")
        .supportedFamilies([.accessoryCircular, .accessoryCorner, .accessoryInline])
    }
}

struct EnergyComplicationView: View {
    @Environment(\.widgetFamily) private var family
    let glance: GlanceDTO

    private var fraction: Double { Double(glance.energy ?? 0) / 100 }
    private var tone: Color {
        glance.decisionModel == .goEasy || glance.decisionModel == .rest ? WColor.amber : WColor.green
    }
    private var a11y: String { glance.energy.map { "Energy \($0) percent" } ?? "Energy unavailable" }

    var body: some View {
        switch family {
        case .accessoryCorner:
            Text(glance.energy.map { "\($0)%" } ?? "—")
                .font(.system(size: 15, weight: .medium, design: .monospaced))
                .widgetLabel {
                    Gauge(value: fraction) { Text("Energy") }
                        .tint(tone)
                }
                .accessibilityLabel(a11y)

        case .accessoryInline:
            Text("Energy \(glance.energy.map { "\($0)%" } ?? "—")")

        default: // accessoryCircular
            Gauge(value: fraction) {
                Text("E")
            } currentValueLabel: {
                Text(glance.energy.map { "\($0)" } ?? "—")
                    .font(.system(size: 14, weight: .medium, design: .monospaced))
            }
            .gaugeStyle(.accessoryCircularCapacity)
            .tint(tone)
            .widgetAccentable()
            .accessibilityLabel(a11y)
        }
    }
}

// MARK: - Next-test complication (circular / inline)

struct WatchNextTestComplication: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "ArcaevoWatchNextTest", provider: WatchGlanceProvider()) { entry in
            NextTestComplicationView(glance: entry.glance)
                .containerBackground(for: .widget) { Color.black }
        }
        .configurationDisplayName("Next test")
        .description("Days to your next blood draw.")
        .supportedFamilies([.accessoryCircular, .accessoryCorner, .accessoryInline])
    }
}

struct NextTestComplicationView: View {
    @Environment(\.widgetFamily) private var family
    let glance: GlanceDTO

    private var label: String { glance.nextTestDays.map { "T−\($0)" } ?? "—" }
    private var a11y: String { glance.nextTestDays.map { "Next test in \($0) days" } ?? "No test scheduled" }

    var body: some View {
        switch family {
        case .accessoryInline:
            Text("Next test \(label)")

        case .accessoryCorner:
            Text(label)
                .font(.system(size: 16, weight: .medium, design: .monospaced))
                .foregroundStyle(WColor.gold)
                .widgetLabel { Text("Next test") }
                .accessibilityLabel(a11y)

        default: // accessoryCircular
            ZStack {
                AccessoryWidgetBackground()
                VStack(spacing: 1) {
                    Text(label)
                        .font(.system(size: 14, weight: .medium, design: .monospaced))
                        .minimumScaleFactor(0.5)
                        .foregroundStyle(WColor.gold)
                    Text("TEST")
                        .font(.system(size: 8, weight: .semibold, design: .monospaced))
                        .foregroundStyle(.secondary)
                }
            }
            .accessibilityLabel(a11y)
        }
    }
}
