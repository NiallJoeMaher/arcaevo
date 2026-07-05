import WidgetKit
import SwiftUI

// MARK: - Home Screen "Today" widget (readiness + energy + next test)
// The one Home Screen surface that carries the whole morning read.

struct TodayWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "ArcaevoToday", provider: GlanceProvider()) { entry in
            TodayWidgetView(glance: entry.glance)
                .containerBackground(for: .widget) { WColor.ink }
        }
        .configurationDisplayName("Today")
        .description("Readiness, energy and your next test — the whole morning read.")
        .supportedFamilies([.systemMedium])
    }
}

struct TodayWidgetView: View {
    let glance: GlanceDTO

    var body: some View {
        HStack(spacing: 16) {
            VStack(spacing: 6) {
                GlanceRing(glance: glance, lineWidth: 8, glyphSize: 26)
                    .frame(width: 66, height: 66)
                    .foregroundStyle(WColor.cream)
                Text("READINESS")
                    .font(.system(size: 8, weight: .semibold, design: .monospaced))
                    .kerning(0.7)
                    .foregroundStyle(WColor.mutedOnDark)
            }

            VStack(alignment: .leading, spacing: 8) {
                Text(glance.statusLine)
                    .font(.system(size: 17, weight: .bold))
                    .foregroundStyle(WColor.cream)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)

                if !glance.isCalibrating && !glance.isSparse {
                    Text("Exertion ceiling \(glance.decisionModel.ceiling) of 10")
                        .font(.system(size: 12))
                        .foregroundStyle(WColor.mutedOnDark)
                }

                HStack(spacing: 14) {
                    stat(title: "ENERGY", value: glance.energy.map { "\($0)%" } ?? "—")
                    stat(title: "NEXT TEST", value: glance.nextTestDays.map { "T−\($0)" } ?? "—", tone: WColor.gold)
                }
                .padding(.top, 2)
            }
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .accessibilityLabel(glance.accessibilityLabel)
    }

    private func stat(title: String, value: String, tone: Color = WColor.brightGreen) -> some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(title)
                .font(.system(size: 8, weight: .semibold, design: .monospaced))
                .foregroundStyle(WColor.mutedOnDark)
            Text(value)
                .font(.system(size: 16, weight: .medium, design: .monospaced))
                .foregroundStyle(tone)
        }
    }
}
