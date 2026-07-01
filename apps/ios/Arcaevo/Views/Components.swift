import SwiftUI
import Charts

// MARK: - Typography helpers (calm, editorial)

extension Text {
    /// Instrument-Serif-style display type using the system serif design.
    func displaySerif(_ size: CGFloat) -> Text {
        font(.system(size: size, weight: .regular, design: .serif))
    }
}

/// Mono uppercase kicker label, per the Geist Mono kickers in the designs.
struct Kicker: View {
    let text: String
    var color: Color = .forest

    var body: some View {
        Text(text.uppercased())
            .font(.system(size: 11, weight: .medium, design: .monospaced))
            .kerning(1.4)
            .foregroundStyle(color)
    }
}

// MARK: - Cards

struct SurfaceCard<Content: View>: View {
    @ViewBuilder var content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            content
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(20)
        .background(Color.surface)
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .strokeBorder(Color.ink.opacity(0.08), lineWidth: 1)
        )
    }
}

struct InkCard<Content: View>: View {
    @ViewBuilder var content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            content
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(20)
        .background(Color.ink)
        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
        .shadow(color: Color.ink.opacity(0.35), radius: 22, y: 14)
    }
}

// MARK: - Verdict pill

struct VerdictPill: View {
    let verdict: RCVVerdict

    var body: some View {
        Text(verdict.displayName)
            .font(.system(size: 11, weight: .semibold))
            .foregroundStyle(verdict == .noRealChange ? Color.mutedInk : .white)
            .padding(.horizontal, 10)
            .padding(.vertical, 5)
            .background(verdict == .noRealChange ? Color.ink.opacity(0.08) : verdict.tint)
            .clipShape(Capsule())
    }
}

// MARK: - Sparkline (Swift Charts)

struct SparklineChart: View {
    let series: [WearableSignal]
    var color: Color = .vitality

    var body: some View {
        Chart(series) { signal in
            LineMark(
                x: .value("Day", signal.date),
                y: .value("Value", signal.value)
            )
            .interpolationMethod(.catmullRom)
            .foregroundStyle(color)
            .lineStyle(StrokeStyle(lineWidth: 2.5, lineCap: .round))

            AreaMark(
                x: .value("Day", signal.date),
                yStart: .value("Min", minValue),
                yEnd: .value("Value", signal.value)
            )
            .interpolationMethod(.catmullRom)
            .foregroundStyle(
                LinearGradient(
                    colors: [color.opacity(0.22), color.opacity(0.02)],
                    startPoint: .top,
                    endPoint: .bottom
                )
            )
        }
        .chartXAxis(.hidden)
        .chartYAxis(.hidden)
        .chartYScale(domain: yDomain)
    }

    private var minValue: Double {
        series.map(\.value).min() ?? 0
    }

    private var yDomain: ClosedRange<Double> {
        let values = series.map(\.value)
        guard let min = values.min(), let max = values.max(), min < max else {
            return 0...1
        }
        let pad = (max - min) * 0.15
        return (min - pad)...(max + pad)
    }
}

// MARK: - Disclaimer footer

struct DisclaimerFooter: View {
    var body: some View {
        Text(Brand.disclaimer)
            .font(.system(size: 11, weight: .medium, design: .monospaced))
            .kerning(0.6)
            .foregroundStyle(Color.caption)
            .frame(maxWidth: .infinity)
            .multilineTextAlignment(.center)
            .padding(.vertical, 16)
    }
}

// MARK: - Demo-mode banner

struct DemoModeBadge: View {
    var body: some View {
        HStack(spacing: 6) {
            Circle().fill(Color.amber).frame(width: 6, height: 6)
            Text("DEMO DATA — API OFFLINE")
                .font(.system(size: 9, weight: .medium, design: .monospaced))
                .kerning(1)
        }
        .foregroundStyle(Color.mutedInk)
        .padding(.horizontal, 10)
        .padding(.vertical, 5)
        .background(Color.amber.opacity(0.14))
        .clipShape(Capsule())
    }
}
