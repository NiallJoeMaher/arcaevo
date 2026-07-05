import WidgetKit
import SwiftUI

// MARK: - Energy gauge widget (all-day energy %, blood-modulated ceiling)

struct EnergyWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "ArcaevoEnergy", provider: GlanceProvider()) { entry in
            EnergyWidgetView(glance: entry.glance)
                .containerBackground(for: .widget) { WColor.ink }
        }
        .configurationDisplayName("Energy")
        .description("Where your energy sits right now against today's ceiling.")
        .supportedFamilies([.accessoryCircular, .accessoryRectangular, .accessoryInline])
    }
}

struct EnergyWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let glance: GlanceDTO

    private var energy: Int? { glance.energy }
    private var fraction: Double { Double(energy ?? 0) / 100 }
    /// Amber gauge when the day's ceiling is pulled down; green otherwise.
    private var tone: Color { glance.decisionModel == .goEasy || glance.decisionModel == .rest ? WColor.amber : WColor.green }

    var body: some View {
        switch family {
        case .accessoryCircular:
            Gauge(value: fraction) {
                Text("E")
            } currentValueLabel: {
                Text(energy.map { "\($0)" } ?? "—")
                    .font(.system(size: 15, weight: .medium, design: .monospaced))
            }
            .gaugeStyle(.accessoryCircularCapacity)
            .tint(tone)
            .widgetAccentable()
            .accessibilityLabel(energy.map { "Energy \($0) percent" } ?? "Energy unavailable")

        case .accessoryInline:
            Text("Energy \(energy.map { "\($0)%" } ?? "—")")

        default: // accessoryRectangular
            VStack(alignment: .leading, spacing: 3) {
                HStack {
                    Text("ENERGY")
                        .font(.system(size: 9, weight: .semibold, design: .monospaced))
                        .foregroundStyle(.secondary)
                    Spacer()
                    Text(energy.map { "\($0)%" } ?? "—")
                        .font(.system(size: 13, weight: .semibold, design: .monospaced))
                }
                ProgressView(value: fraction)
                    .tint(tone)
                Text(energy == nil ? "Building today's curve." : "Right now vs today's ceiling.")
                    .font(.system(size: 11))
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
            }
            .accessibilityLabel(energy.map { "Energy \($0) percent of today's ceiling" } ?? "Energy unavailable")
        }
    }
}
