import SwiftUI

/// YOUR DATA · "Timeline" — `data-screen-label="Timeline"` (dark screen).
/// All data events on one line: Arcaevo lab values are SOLID GREEN dots,
/// self-reported (uploaded/typed) values are HOLLOW GOLD — visually
/// distinct forever.
struct DataTimelineV3View: View {
    struct DataEvent: Identifiable, Hashable {
        enum Source: Hashable { case lab, selfReported }

        let id = UUID()
        var axisLabel: String   // "FEB 25 · 5.4"
        var source: Source
        /// Normalised chart position (design viewBox 300×96).
        var x: CGFloat
        var y: CGFloat
    }

    var eyebrow = "TOTAL CHOLESTEROL · 2 YEARS"
    var headline = "Trending the right way."
    /// Design fixture: two self-reported historical draws + the Arcaevo lab
    /// value, trending down.
    var events: [DataEvent] = [
        DataEvent(axisLabel: "FEB 25 · 5.4", source: .selfReported, x: 20, y: 34),
        DataEvent(axisLabel: "FEB 26 · 5.1", source: .selfReported, x: 130, y: 46),
        DataEvent(axisLabel: "JUL 26 · 4.8", source: .lab, x: 252, y: 60),
    ]

    @State private var pushShare = false

    var body: some View {
        DataV3DarkScreen {
            Text(eyebrow)
                .font(.arcMono(10, weight: .medium))
                .kerning(1)
                .foregroundStyle(Color.arcMutedOnDark)
                .padding(.bottom, 6)
                .padding(.top, 34)

            Text(headline)
                .font(.arcSerif(24))
                .foregroundStyle(Color.arcCream)
                .padding(.bottom, 18)

            chartCard
                .padding(.bottom, 12)

            legend
                .padding(.bottom, 14)

            unlockCard
                .padding(.bottom, 18)

            Button { pushShare = true } label: {
                Text("Share with your GP")
                    .font(.arcSans(14, weight: .semibold))
                    .foregroundStyle(Color.arcDarkSurface)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(Color.arcCream, in: Capsule())
            }
            .buttonStyle(.plain)
            .padding(.top, 12)
        }
        .navigationDestination(isPresented: $pushShare) { GPShareV3View() }
    }

    // MARK: Chart

    private var chartCard: some View {
        VStack(spacing: 8) {
            GeometryReader { geo in
                let sx = geo.size.width / 300
                let sy = geo.size.height / 96
                let pts = events.map { CGPoint(x: $0.x * sx, y: $0.y * sy) }

                ZStack {
                    // Segments: solid green when the segment ends on a lab
                    // value, dashed muted white between self-reported points.
                    ForEach(Array(events.dropFirst().enumerated()), id: \.element.id) { index, event in
                        let from = pts[index]
                        let to = pts[index + 1]
                        Path { p in
                            p.move(to: from)
                            p.addLine(to: to)
                        }
                        .stroke(
                            event.source == .lab ? Color.arcPrimaryGreen : Color.white.opacity(0.35),
                            style: StrokeStyle(
                                lineWidth: event.source == .lab ? 2.5 : 2,
                                lineCap: .round,
                                dash: event.source == .lab ? [] : [5, 5]
                            )
                        )
                    }

                    // Dots: hollow gold = self-reported, solid green = lab.
                    ForEach(Array(events.enumerated()), id: \.element.id) { index, event in
                        if event.source == .lab {
                            Circle()
                                .fill(Color.arcPrimaryGreen)
                                .frame(width: 12, height: 12)
                                .position(pts[index])
                        } else {
                            Circle()
                                .strokeBorder(Color.arcHollowGold, lineWidth: 2.5)
                                .frame(width: 13, height: 13)
                                .position(pts[index])
                        }
                    }
                }
            }
            .frame(height: 88)

            HStack {
                ForEach(events) { event in
                    Text(event.axisLabel)
                        .font(.arcMono(9.5))
                        .foregroundStyle(Color.arcMutedOnDark)
                    if event.id != events.last?.id { Spacer() }
                }
            }
        }
        .padding(16)
        .background(Color.white.opacity(0.06), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    private var legend: some View {
        HStack(spacing: 9) {
            Circle()
                .strokeBorder(Color.arcHollowGold, lineWidth: 2)
                .frame(width: 11, height: 11)
            Text("Self-reported")
                .font(.arcSans(12))
                .foregroundStyle(Color.arcRailLight)
            Circle()
                .fill(Color.arcPrimaryGreen)
                .frame(width: 11, height: 11)
                .padding(.leading, 10)
            Text("Arcaevo lab")
                .font(.arcSans(12))
                .foregroundStyle(Color.arcRailLight)
        }
    }

    private var unlockCard: some View {
        VStack(alignment: .leading, spacing: 7) {
            Text("WHAT THIS UNLOCKS")
                .font(.arcMono(9.5, weight: .medium))
                .kerning(1)
                .foregroundStyle(Color.arcBrightGreen)
            Text("Two years of history means your baseline starts today, not in six months. Trend verdicts now reach back to Feb 2025.")
                .font(.arcSans(13))
                .foregroundStyle(Color.arcRailLight)
                .lineSpacing(4)
        }
        .padding(.vertical, 15)
        .padding(.horizontal, 16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.white.opacity(0.06), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
    }
}

#if DEBUG
#Preview("Timeline") {
    NavigationStack { DataTimelineV3View() }
        .environment(AppState())
        .environment(AppModel())
}
#endif
