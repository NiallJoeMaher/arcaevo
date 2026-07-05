import WidgetKit
import SwiftUI

// MARK: - Next-test countdown widget (the T−N complication on the Lock Screen)

struct NextTestWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "ArcaevoNextTest", provider: GlanceProvider()) { entry in
            NextTestWidgetView(glance: entry.glance)
                .containerBackground(for: .widget) { WColor.ink }
        }
        .configurationDisplayName("Next test")
        .description("Days to your next expected blood draw.")
        .supportedFamilies([.accessoryCircular, .accessoryInline, .accessoryRectangular])
    }
}

struct NextTestWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let glance: GlanceDTO

    private var label: String { glance.nextTestDays.map { "T−\($0)" } ?? "—" }
    private var a11y: String {
        glance.nextTestDays.map { "Next test in \($0) days" } ?? "No test scheduled"
    }

    var body: some View {
        switch family {
        case .accessoryCircular:
            ZStack {
                AccessoryWidgetBackground()
                VStack(spacing: 1) {
                    Text(label)
                        .font(.system(size: 15, weight: .medium, design: .monospaced))
                        .minimumScaleFactor(0.6)
                        .foregroundStyle(WColor.gold)
                    Text("TEST")
                        .font(.system(size: 8, weight: .semibold, design: .monospaced))
                        .foregroundStyle(.secondary)
                }
            }
            .accessibilityLabel(a11y)

        case .accessoryInline:
            Text("Next test \(label)")

        default: // accessoryRectangular
            HStack(spacing: 10) {
                Text(label)
                    .font(.system(size: 24, weight: .medium, design: .monospaced))
                    .foregroundStyle(WColor.gold)
                VStack(alignment: .leading, spacing: 1) {
                    Text("NEXT TEST")
                        .font(.system(size: 9, weight: .semibold, design: .monospaced))
                        .foregroundStyle(.secondary)
                    Text(glance.nextTestDays == nil ? "Nothing scheduled" : "days to your next draw")
                        .font(.system(size: 12))
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)
                }
                Spacer(minLength: 0)
            }
            .accessibilityLabel(a11y)
        }
    }
}
