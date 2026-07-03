import SwiftUI
import WatchKit

// MARK: - 1 · Watch face entry — `data-screen-label="Watch face"`
//
// In-app stand-in for the complication: time, baseline ring, T−N next test.
// (The real watch-face complication is a WidgetKit accessory extension —
// a separate target; deferred, documented in BUILD_STATE.)

struct WatchFaceEntryView: View {
    @Environment(WatchModel.self) private var model

    var body: some View {
        TimelineView(.everyMinute) { context in
            VStack(alignment: .trailing, spacing: 0) {
                Text(Self.time.string(from: context.date))
                    .font(.arcMono(36))
                    .foregroundStyle(Color.arcBrightGreen)
                Text(Self.day.string(from: context.date).uppercased())
                    .font(.arcMono(9))
                    .kerning(0.9)
                    .foregroundStyle(Color.arcMutedOnDark)
                    .padding(.top, 5)

                Spacer(minLength: 0)

                HStack(alignment: .bottom) {
                    // Baseline mini-ring → Today (≥44pt target).
                    Button {
                        model.screen = .today
                    } label: {
                        VStack(spacing: 5) {
                            WatchBaselineRing(score: model.score, size: 52, lineWidth: 6, numberSize: 15)
                            Text("BASELINE")
                                .font(.arcMono(7.5))
                                .kerning(0.75)
                                .foregroundStyle(Color.arcMutedOnDark)
                        }
                        .frame(minWidth: 60, minHeight: 68)
                    }
                    .buttonStyle(.plain)

                    Spacer()

                    VStack(spacing: 4) {
                        Text("T−\(model.daysToNextTest)")
                            .font(.arcMono(22))
                            .foregroundStyle(Color.arcHollowGold)
                        Text("NEXT TEST")
                            .font(.arcMono(7.5))
                            .kerning(0.75)
                            .foregroundStyle(Color.arcMutedOnDark)
                    }
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topTrailing)
            .padding(.horizontal, 14)
            .padding(.vertical, 8)
        }
        .background(Color.black)
    }

    private static let time: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "H:mm"
        return f
    }()

    private static let day: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "EEE d MMM"
        return f
    }()
}

// MARK: - 2 · Today — baseline — `data-screen-label="Watch today"`

struct WatchTodayBaselineView: View {
    @Environment(WatchModel.self) private var model

    var body: some View {
        VStack(spacing: 0) {
            WatchBaselineRing(score: model.score, size: 92, lineWidth: 9, numberSize: 25)
            Text(model.statusTitle)
                .font(.arcSerif(25))
                .foregroundStyle(Color.arcCream)
                .padding(.top, 11)
            Text(model.statusBody)
                .font(.arcSans(11))
                .foregroundStyle(Color.arcMutedOnDark)
                .multilineTextAlignment(.center)
                .lineSpacing(2)
                .padding(.top, 4)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(.horizontal, 14)
        .background(Color.black)
    }
}

// MARK: - 3 · Biomarker glance — `data-screen-label="Watch glance"`
// Status + delta only — never a raw alarming value.

struct WatchGlanceV3View: View {
    @Environment(WatchModel.self) private var model

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(model.glanceEyebrow)
                .font(.arcMono(8))
                .kerning(0.8)
                .foregroundStyle(Color.arcHollowGold)

            (Text("\(model.hrvLatest) ")
                .font(.arcMono(28))
                .foregroundColor(.arcCream)
                + Text("ms")
                .font(.arcMono(12))
                .foregroundColor(.arcMutedOnDark))
                .padding(.top, 10)
                .padding(.bottom, 4)

            sparkline
                .frame(height: 28)

            Spacer(minLength: 6)

            Text(model.glanceCaption)
                .font(.arcSans(11))
                .foregroundStyle(Color.arcRailLight)
                .lineSpacing(2)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .padding(.horizontal, 14)
        .padding(.vertical, 8)
        .background(Color.black)
    }

    /// Gold HRV sparkline (design polyline, or the live demo series).
    private var sparkline: some View {
        GeometryReader { geo in
            let values = model.hrvSeries.isEmpty
                ? [22, 18, 20, 14, 15, 11, 12, 8, 9] // design fixture shape
                : model.hrvSeries
            let minV = values.min() ?? 0
            let maxV = values.max() ?? 1
            let span = max(maxV - minV, 0.001)
            let stepX = geo.size.width / CGFloat(max(values.count - 1, 1))

            Path { path in
                for (index, value) in values.enumerated() {
                    let x = CGFloat(index) * stepX
                    // Higher value → higher on screen.
                    let y = geo.size.height * (1 - CGFloat((value - minV) / span) * 0.75 - 0.12)
                    if index == 0 { path.move(to: CGPoint(x: x, y: y)) }
                    else { path.addLine(to: CGPoint(x: x, y: y)) }
                }
            }
            .stroke(Color.arcHollowGold, style: StrokeStyle(lineWidth: 2, lineCap: .round, lineJoin: .round))
        }
    }
}

// MARK: - 4 · Quick-log — `data-screen-label="Watch quick-log"`
// One tap per item, haptic confirm, `wlogged` state.

struct WatchQuickLogV3View: View {
    @Environment(WatchModel.self) private var model

    private let columns = [GridItem(.flexible(), spacing: 7), GridItem(.flexible(), spacing: 7)]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                Text("QUICK-LOG · ONE TAP")
                    .font(.arcMono(8))
                    .kerning(0.8)
                    .foregroundStyle(Color.arcMutedOnDark)
                    .padding(.bottom, 10)

                LazyVGrid(columns: columns, spacing: 7) {
                    ForEach(model.quickLogTags, id: \.self) { tag in
                        let isLogged = model.logged.contains(tag)
                        Button {
                            model.toggleTag(tag)
                        } label: {
                            Text(isLogged ? "\(tag) ✓" : tag)
                                .font(.arcSans(10.5, weight: .semibold))
                                .foregroundStyle(isLogged ? Color.arcBrightGreen : Color(hex: 0xE8E4DA))
                                .lineLimit(1)
                                .minimumScaleFactor(0.8)
                                .frame(maxWidth: .infinity, minHeight: 44) // ≥44pt
                                .background(
                                    isLogged ? Color.arcPrimaryGreen.opacity(0.18) : Color.clear,
                                    in: RoundedRectangle(cornerRadius: 12, style: .continuous)
                                )
                                .overlay(
                                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                                        .strokeBorder(
                                            isLogged
                                                ? Color.arcPrimaryGreen.opacity(0.6)
                                                : Color.white.opacity(0.16)
                                        )
                                )
                        }
                        .buttonStyle(.plain)
                    }
                }

                Text(model.quickLogCaption)
                    .font(.arcSans(9))
                    .foregroundStyle(Color.arcRailDim)
                    .multilineTextAlignment(.center)
                    .lineSpacing(2)
                    .frame(maxWidth: .infinity)
                    .padding(.top, 12)
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
        }
        .background(Color.black)
    }
}

// MARK: - 5 · Active experiment — `data-screen-label="Watch experiment"`

struct WatchExperimentV3View: View {
    @Environment(WatchModel.self) private var model

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("ACTIVE · \(model.experimentName)")
                .font(.arcMono(8))
                .kerning(0.8)
                .foregroundStyle(Color.arcBrightGreen)

            Text("Day \(model.experimentDay) of \(model.experimentLength)")
                .font(.arcSerif(23))
                .foregroundStyle(Color.arcCream)
                .padding(.top, 8)
                .padding(.bottom, 10)

            // Progress bar.
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule().fill(Color.white.opacity(0.12))
                    Capsule()
                        .fill(Color.arcPrimaryGreen)
                        .frame(width: geo.size.width * CGFloat(model.experimentDay) / CGFloat(model.experimentLength))
                }
            }
            .frame(height: 6)
            .padding(.bottom, 9)

            Text("Adherence \(model.adherencePercent)% — read from your Watch.")
                .font(.arcSans(10.5))
                .foregroundStyle(Color.arcMutedOnDark)
                .lineSpacing(2)

            Spacer(minLength: 8)

            if model.experimentLogged {
                Text("✓ Logged — \(model.experimentDay + 1) of \(model.experimentLength)")
                    .font(.arcSans(12, weight: .bold))
                    .foregroundStyle(Color.arcBrightGreen)
                    .frame(maxWidth: .infinity, minHeight: 44)
                    .overlay(Capsule().strokeBorder(Color.arcPrimaryGreen.opacity(0.5)))
            } else {
                Button {
                    model.logExperimentDay()
                } label: {
                    Text("Log today's walk")
                        .font(.arcSans(12, weight: .bold))
                        .foregroundStyle(Color(hex: 0x04130D))
                        .frame(maxWidth: .infinity, minHeight: 44) // ≥44pt
                        .background(Color.arcPrimaryGreen, in: Capsule())
                }
                .buttonStyle(.plain)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .padding(.horizontal, 14)
        .padding(.vertical, 8)
        .background(Color.black)
    }
}

// MARK: - 6 · Result ready — `data-screen-label="Watch result"`
// Calm. No values, no red numbers — the phone tells the story.

struct WatchResultReadyV3View: View {
    @Environment(WatchModel.self) private var model

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 7) {
                Circle()
                    .fill(Color.arcPrimaryGreen)
                    .frame(width: 8, height: 8)
                Text("ARCAEVO · NOW")
                    .font(.arcMono(8))
                    .kerning(0.8)
                    .foregroundStyle(Color.arcBrightGreen)
            }
            .padding(.bottom, 11)

            Text("Results in.")
                .font(.arcSerif(24))
                .foregroundStyle(Color.arcCream)
                .padding(.bottom, 7)

            Text("Vitamin D is up since winter. One marker worth a look — no red numbers here.")
                .font(.arcSans(11.5))
                .foregroundStyle(Color.arcRailLight)
                .lineSpacing(2)
                .padding(.bottom, 15)

            // The story lives on the phone — this just acknowledges.
            Button {
                WKInterfaceDevice.current().play(.click)
                model.screen = .today
            } label: {
                Text("Read on iPhone")
                    .font(.arcSans(11.5, weight: .semibold))
                    .foregroundStyle(Color.arcDarkSurface)
                    .frame(maxWidth: .infinity, minHeight: 44) // ≥44pt
                    .background(Color.arcCream, in: Capsule())
            }
            .buttonStyle(.plain)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .padding(.horizontal, 14)
        .padding(.vertical, 8)
        .background(Color.black)
    }
}

// MARK: - DEBUG previews (all six screens reachable)

#if DEBUG
#Preview("Face") { WatchFaceEntryView().environment(WatchModel()) }
#Preview("Today") { WatchTodayBaselineView().environment(WatchModel()) }
#Preview("Glance") { WatchGlanceV3View().environment(WatchModel()) }
#Preview("Quick-log") { WatchQuickLogV3View().environment(WatchModel()) }
#Preview("Experiment") { WatchExperimentV3View().environment(WatchModel()) }
#Preview("Result ready") { WatchResultReadyV3View().environment(WatchModel()) }
#endif
