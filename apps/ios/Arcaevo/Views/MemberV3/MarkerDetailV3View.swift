import SwiftUI
import Charts

/// MEMBER APP · marker detail — the ApoB screen ("Marker detail" in
/// Prototype.dc.html). History chart with the optimal band, plain-language
/// "what it is", the blood + Watch explanation, and a route back into the
/// experiment. Amber "watch" tint, never red.
struct MarkerDetailV3View: View {
    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss

    init() {}

    /// Prototype chart coordinates (viewBox 300×80): band top y=46, three
    /// draws — FEB 25 self-reported (hollow gold), FEB 26 + JUL 26 lab.
    private struct Draw: Identifiable {
        let x: Double
        let y: Double
        let radius: CGFloat
        let selfReported: Bool
        var id: Double { x }
    }

    private let draws: [Draw] = [
        Draw(x: 30, y: 18, radius: 5, selfReported: true),
        Draw(x: 150, y: 30, radius: 5, selfReported: false),
        Draw(x: 268, y: 40, radius: 6, selfReported: false),
    ]

    var body: some View {
        ZStack {
            Color.arcDarkSurface.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    Mv3BackLink(title: "Results") { dismiss() }
                        .padding(.bottom, 4)

                    Mv3Eyebrow(text: "APOB · CARDIOVASCULAR")
                        .padding(.bottom, 6)

                    HStack(alignment: .firstTextBaseline, spacing: 10) {
                        Text("0.94")
                            .font(.arcMono(38, weight: .medium))
                            .foregroundStyle(Color.arcCream)
                        Text("g/L")
                            .font(.arcSans(13))
                            .foregroundStyle(Color.arcMutedOnDark)
                        Text("↓ from 1.12")
                            .font(.arcMono(12, weight: .regular))
                            .foregroundStyle(Color.arcBrightGreen)
                    }
                    .padding(.bottom, 8)

                    // Verdict chip — amber "watch" tone, moving the right way.
                    Text("ABOVE OPTIMAL — MOVING THE RIGHT WAY")
                        .font(.arcMono(10.5, weight: .regular))
                        .foregroundStyle(Mv3.watchAmber)
                        .padding(.vertical, 6)
                        .padding(.horizontal, 12)
                        .background(Mv3.amber.opacity(0.14), in: Capsule())
                        .padding(.bottom, 14)

                    chartCard

                    infoCard(
                        eyebrow: "WHAT IT IS",
                        eyebrowColor: .arcMutedOnDark,
                        body: "The count of particles that carry cholesterol into artery walls — a better predictor of heart risk than LDL alone."
                    )
                    .padding(.bottom, 10)

                    infoCard(
                        eyebrow: "WHAT MOVED IT · BLOOD + WATCH",
                        eyebrowColor: .arcBrightGreen,
                        body: "Your Watch logged 46 evening walks since February — the drop tracks them almost week for week. This is your experiment working."
                    )
                    .padding(.bottom, 12)

                    Mv3CreamCTA(title: "Keep the plan — see the experiment") {
                        appState.selectedTab = .experiments
                        dismiss()
                    }
                }
                .padding(.horizontal, 24)
                .padding(.top, 8)
                .padding(.bottom, 20)
            }
        }
        .toolbar(.hidden, for: .navigationBar)
    }

    // MARK: History chart — baseline band + three draws

    private var chartCard: some View {
        VStack(alignment: .leading, spacing: 0) {
            historyChart
                .frame(height: 92)
            HStack {
                Text("FEB 25 · 1.21")
                Spacer()
                Text("FEB 26 · 1.12")
                Spacer()
                Text("JUL 26 · 0.94")
            }
            .font(.arcMono(9, weight: .regular))
            .foregroundStyle(Color.arcMutedOnDark)
            .padding(.top, 4)
        }
        .padding(14)
        .background(Mv3.cardFill, in: RoundedRectangle(cornerRadius: 15, style: .continuous))
        .padding(.bottom, 10)
    }

    /// Data space = the prototype SVG viewBox (300×80), y flipped.
    private var historyChart: some View {
        Chart {
            // "OPTIMAL < 1.00" band along the bottom.
            RectangleMark(
                xStart: .value("x", 0.0),
                xEnd: .value("x", 300.0),
                yStart: .value("y", 80 - 46.0),
                yEnd: .value("y", 80 - 76.0)
            )
            .foregroundStyle(Color.arcPrimaryGreen.opacity(0.1))

            ForEach(draws) { d in
                LineMark(x: .value("x", d.x), y: .value("y", 80 - d.y))
                    .foregroundStyle(Color.arcPrimaryGreen)
                    .lineStyle(StrokeStyle(lineWidth: 2.5, lineCap: .round))
            }
        }
        .chartXScale(domain: 0...300)
        .chartYScale(domain: 0...80)
        .chartXAxis(.hidden)
        .chartYAxis(.hidden)
        .chartLegend(.hidden)
        .chartOverlay { proxy in
            GeometryReader { geo in
                if let anchor = proxy.plotFrame {
                    let plot = geo[anchor]
                    let toScreen: (Double, Double) -> CGPoint = { x, y in
                        CGPoint(x: plot.minX + x / 300 * plot.width,
                                y: plot.minY + y / 80 * plot.height)
                    }

                    Text("OPTIMAL < 1.00")
                        .font(.arcMono(9, weight: .regular))
                        .kerning(0.4)
                        .foregroundStyle(Color.arcRailDim)
                        .position(x: toScreen(6, 72).x + 38, y: toScreen(6, 72).y)

                    ForEach(draws) { d in
                        // Self-reported = hollow gold, always; lab = solid.
                        Circle()
                            .fill(d.selfReported ? Color.arcDarkSurface : Color.arcPrimaryGreen)
                            .overlay {
                                if d.selfReported {
                                    Circle().strokeBorder(Color.arcHollowGold, lineWidth: 2.5)
                                }
                            }
                            .frame(width: d.radius * 2, height: d.radius * 2)
                            .position(toScreen(d.x, d.y))
                    }
                }
            }
        }
    }

    private func infoCard(eyebrow: String, eyebrowColor: Color, body: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Mv3Eyebrow(text: eyebrow, size: 9, color: eyebrowColor, kerning: 0.9)
            Text(body)
                .font(.arcSans(12.5))
                .lineSpacing(4)
                .foregroundStyle(Mv3.bodyOnDark)
        }
        .padding(.horizontal, 15)
        .padding(.vertical, 13)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Mv3.cardFill, in: RoundedRectangle(cornerRadius: 15, style: .continuous))
    }
}
