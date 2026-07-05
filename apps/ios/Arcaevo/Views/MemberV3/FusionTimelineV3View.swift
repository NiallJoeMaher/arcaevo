import SwiftUI
import Charts

/// MEMBER APP · fusion timeline ("Fusion timeline" in Prototype.dc.html).
/// Marker × wearable-signal picker chips over one chart: the continuous
/// gold Watch line against the member's baseline band, with blood draws as
/// tappable points — lab draws solid green, self-reported hollow gold —
/// plus a drag scrubber that reads the Watch value at any point in time.
struct FusionTimelineV3View: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(AppModel.self) private var model

    @State private var markerKey = "apob"
    @State private var wearKey = "rhr"
    @State private var selectedPoint = 2
    /// Design-space x (0–300) while the finger is down; nil otherwise.
    @State private var scrubX: Double?
    @State private var snapTick = 0

    init() {}

    private var marker: Mv3FusionMarker {
        MemberV3Demo.fusionMarkers.first { $0.key == markerKey } ?? MemberV3Demo.fusionMarkers[0]
    }

    private var wear: Mv3WearSeries {
        MemberV3Demo.wearSeries.first { $0.key == wearKey } ?? MemberV3Demo.wearSeries[0]
    }

    private var point: Mv3FusionPoint {
        marker.points[min(selectedPoint, marker.points.count - 1)]
    }

    var body: some View {
        ZStack {
            Color.arcDarkSurface.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    Mv3BackLink(title: "Today") { dismiss() }

                    if model.showsBloodSample {
                        Mv3SampleBanner(detail: "An example fusion timeline — the blood draws shown are not yours. The real chart fills in as your tests and Watch history build.")
                            .padding(.bottom, 12)
                    }

                    Mv3Eyebrow(text: "FUSION TIMELINE · BLOOD × WATCH")
                        .padding(.bottom, 6)
                    Text(marker.headline)
                        .font(.arcSerif(21))
                        .foregroundStyle(Color.arcCream)
                        .lineSpacing(2)
                        .padding(.bottom, 14)

                    markerChips
                    wearChips
                    chartCard
                    legend
                    pointCard
                    wearCard

                    Text("Shown against your own baseline · population range off by default\nNot a medical device. Not a diagnosis.")
                        .font(.arcSans(9.5))
                        .lineSpacing(2)
                        .foregroundStyle(Color.arcRailDim)
                        .multilineTextAlignment(.center)
                        .frame(maxWidth: .infinity)
                        .padding(.top, 6)
                }
                .padding(.horizontal, 24)
                .padding(.top, 8)
                .padding(.bottom, 20)
            }
        }
        .toolbar(.hidden, for: .navigationBar)
        .sensoryFeedback(.selection, trigger: markerKey)
        .sensoryFeedback(.selection, trigger: wearKey)
        .sensoryFeedback(.selection, trigger: selectedPoint)
        .sensoryFeedback(.impact(weight: .light), trigger: snapTick)
    }

    // MARK: Picker chips — marker × wearable signal

    private var markerChips: some View {
        HStack(spacing: 7) {
            ForEach(MemberV3Demo.fusionMarkers) { m in
                Mv3Chip(label: m.chipLabel, isOn: markerKey == m.key, accent: .green) {
                    markerKey = m.key
                    selectedPoint = 2 // prototype resets to the latest draw
                }
            }
        }
        .padding(.bottom, 8)
    }

    private var wearChips: some View {
        HStack(spacing: 7) {
            Text("×")
                .font(.arcMono(10, weight: .regular))
                .foregroundStyle(Color.arcRailDim)
            ForEach(MemberV3Demo.wearSeries) { w in
                Mv3Chip(
                    label: w.chipLabel,
                    isOn: wearKey == w.key,
                    accent: .gold,
                    font: .arcMono(9.5, weight: .regular),
                    hPad: 12, vPad: 6
                ) {
                    wearKey = w.key
                }
            }
        }
        .padding(.bottom, 13)
    }

    // MARK: Chart — baseline band + gold Watch line + blood points + scrubber

    private var chartCard: some View {
        VStack(alignment: .leading, spacing: 2) {
            fusionChart
                .frame(height: 108)
            HStack {
                Text("FEB 25")
                Spacer()
                Text("FEB 26")
                Spacer()
                Text("JUL 26")
            }
            .font(.arcMono(9, weight: .regular))
            .foregroundStyle(Color.arcMutedOnDark)
            .padding(.top, 2)
        }
        .padding(.top, 14)
        .padding(.horizontal, 14)
        .padding(.bottom, 10)
        .background(Mv3.cardFill, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .padding(.bottom, 9)
    }

    /// Data space = the prototype's SVG viewBox (300×92) so every band edge,
    /// line vertex and blood point lands exactly where the design put it.
    /// (y is flipped: plotted value = 92 − designY.)
    private var fusionChart: some View {
        Chart {
            // Baseline band — "YOUR BASELINE BAND", 26pt tall.
            RectangleMark(
                xStart: .value("x", 0.0),
                xEnd: .value("x", 300.0),
                yStart: .value("y", 92 - marker.bandY),
                yEnd: .value("y", 92 - (marker.bandY + 26))
            )
            .foregroundStyle(Color.arcPrimaryGreen.opacity(0.12))

            // Continuous wearable line (gold).
            ForEach(Array(wear.line.enumerated()), id: \.offset) { _, p in
                LineMark(x: .value("x", Double(p.x)), y: .value("y", 92 - Double(p.y)))
                    .foregroundStyle(Color.arcHollowGold.opacity(0.85))
                    .lineStyle(StrokeStyle(lineWidth: 2, lineCap: .round))
            }
        }
        .chartXScale(domain: 0...300)
        .chartYScale(domain: 0...92)
        .chartXAxis(.hidden)
        .chartYAxis(.hidden)
        .chartLegend(.hidden)
        .chartOverlay { proxy in
            GeometryReader { geo in
                if let anchor = proxy.plotFrame {
                    let plot = geo[anchor]
                    chartChrome(in: plot)
                }
            }
        }
        .animation(.easeInOut(duration: 0.18), value: markerKey)
        .animation(.easeInOut(duration: 0.18), value: wearKey)
    }

    /// Band label, blood points, scrub rule + value bubble — drawn in the
    /// design's coordinate space mapped onto the live plot rect.
    @ViewBuilder
    private func chartChrome(in plot: CGRect) -> some View {
        let toScreen: (Double, Double) -> CGPoint = { x, y in
            CGPoint(
                x: plot.minX + x / 300 * plot.width,
                y: plot.minY + y / 92 * plot.height
            )
        }

        ZStack(alignment: .topLeading) {
            // Scrub surface (below the tappable points).
            Rectangle()
                .fill(Color.clear)
                .contentShape(Rectangle())
                .frame(width: plot.width, height: plot.height)
                .position(x: plot.midX, y: plot.midY)
                .gesture(
                    DragGesture(minimumDistance: 0)
                        .onChanged { drag in
                            let x = min(300, max(0, (drag.location.x - plot.minX) / plot.width * 300))
                            scrubX = x
                            // Snap-select the nearest blood draw when close.
                            if let nearest = marker.points.enumerated().min(by: { abs($0.element.x - x) < abs($1.element.x - x) }),
                               abs(nearest.element.x - x) < 14,
                               selectedPoint != nearest.offset {
                                selectedPoint = nearest.offset
                                snapTick += 1
                            }
                        }
                        .onEnded { _ in scrubX = nil }
                )

            // "YOUR BASELINE BAND"
            Text("YOUR BASELINE BAND")
                .font(.arcMono(8, weight: .regular))
                .kerning(0.5)
                .foregroundStyle(Color.arcRailDim)
                .position(x: toScreen(6, marker.bandY + 17).x + 44, y: toScreen(6, marker.bandY + 17).y)

            // Blood draws — lab solid green, self-reported hollow gold.
            ForEach(Array(marker.points.enumerated()), id: \.offset) { index, p in
                let selected = index == selectedPoint
                let radius: CGFloat = selected ? 7 : 5
                let center = toScreen(p.x, p.y)
                bloodDot(point: p, selected: selected, radius: radius)
                    .frame(width: 44, height: 44) // ≥44px hit target
                    .contentShape(Circle())
                    .position(center)
                    .onTapGesture { selectedPoint = index }
            }

            // Scrubber — vertical rule + the Watch value at that moment.
            if let sx = scrubX {
                let rule = toScreen(sx, 0)
                Rectangle()
                    .fill(Color.white.opacity(0.25))
                    .frame(width: 1, height: plot.height)
                    .position(x: rule.x, y: plot.midY)
                VStack(spacing: 1) {
                    Text(MemberV3Demo.monthLabel(atX: sx))
                        .font(.arcMono(8, weight: .regular))
                        .foregroundStyle(Color.arcMutedOnDark)
                    Text(wear.format(wear.value(atX: sx)))
                        .font(.arcMono(10.5, weight: .medium))
                        .foregroundStyle(Color.arcHollowGold)
                }
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(Color.arcTabBarSurface, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                        .strokeBorder(Color.white.opacity(0.15), lineWidth: 1)
                )
                .position(
                    x: min(max(rule.x, plot.minX + 34), plot.maxX - 34),
                    y: plot.minY + 12
                )
            }
        }
    }

    @ViewBuilder
    private func bloodDot(point p: Mv3FusionPoint, selected: Bool, radius: CGFloat) -> some View {
        switch p.source {
        case .lab:
            // Lab draw: green; filled when selected, outlined otherwise.
            Circle()
                .fill(selected ? Color.arcPrimaryGreen : Color.arcDarkSurface)
                .overlay(Circle().strokeBorder(Color.arcPrimaryGreen, lineWidth: 2.5))
                .frame(width: radius * 2, height: radius * 2)
        case .selfReported:
            // Self-reported = hollow gold, always. Never filled.
            Circle()
                .fill(Color.arcDarkSurface)
                .overlay(Circle().strokeBorder(Color.arcHollowGold, lineWidth: 2.5))
                .frame(width: radius * 2, height: radius * 2)
        }
    }

    // MARK: Legend

    private var legend: some View {
        HStack(spacing: 8) {
            Rectangle()
                .fill(Color.arcHollowGold)
                .frame(width: 14, height: 2)
            Text("\(wear.chipLabel.lowercased()) · continuous")
                .font(.arcSans(10.5))
                .foregroundStyle(Color.arcMutedOnDark)
            Circle()
                .fill(Color.arcPrimaryGreen)
                .frame(width: 9, height: 9)
                .padding(.leading, 8)
            Text("blood draws · tap one")
                .font(.arcSans(10.5))
                .foregroundStyle(Color.arcMutedOnDark)
        }
        .padding(.bottom, 10)
    }

    // MARK: Selected blood-draw card

    private var pointCard: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Mv3Eyebrow(text: point.tag, size: 9, color: point.source == .selfReported ? .arcHollowGold : .arcBrightGreen, kerning: 0.9)
                Spacer()
                Text("\(point.value) \(marker.unit)")
                    .font(.arcMono(12.5, weight: .regular))
                    .foregroundStyle(Color.arcCream)
            }
            Text(point.note)
                .font(.arcSans(12.5))
                .lineSpacing(4)
                .foregroundStyle(Mv3.bodyOnDark)
        }
        .padding(.horizontal, 15)
        .padding(.vertical, 13)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Mv3.cardFill, in: RoundedRectangle(cornerRadius: 15, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 15, style: .continuous)
                .strokeBorder(
                    point.source == .selfReported
                        ? Color.arcHollowGold.opacity(0.3)
                        : Color.arcPrimaryGreen.opacity(0.3),
                    lineWidth: 1
                )
        )
        .padding(.bottom, 9)
        .animation(.easeInOut(duration: 0.15), value: selectedPoint)
    }

    // MARK: Wearable "same period" card (gold family)

    private var wearCard: some View {
        VStack(alignment: .leading, spacing: 5) {
            Mv3Eyebrow(text: "\(wear.chipLabel) · SAME PERIOD", size: 9, color: .arcHollowGold, kerning: 0.9)
            Text(wear.caption)
                .font(.arcSans(12))
                .lineSpacing(3)
                .foregroundStyle(Mv3.bodyOnDark)
        }
        .padding(.horizontal, 15)
        .padding(.vertical, 12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.arcHollowGold.opacity(0.08), in: RoundedRectangle(cornerRadius: 15, style: .continuous))
        .padding(.bottom, 12)
    }
}
