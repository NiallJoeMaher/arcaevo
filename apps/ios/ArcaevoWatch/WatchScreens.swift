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

// MARK: - 2 · Today — readiness + decision + one-line why
// `data-screen-label="Watch today"` — ring, decision headline, why + ceiling.
// Amber at worst; degraded states render honestly (no fake number).

struct WatchTodayBaselineView: View {
    @Environment(WatchModel.self) private var model

    var body: some View {
        VStack(spacing: 0) {
            if model.showsScore {
                WatchBaselineRing(
                    score: model.score,
                    size: 88, lineWidth: 9, numberSize: 24,
                    tint: model.decision.wristTint
                )
                Text(model.decisionShort)
                    .font(.arcSerif(24))
                    .foregroundStyle(Color.arcCream)
                    .padding(.top, 9)
                Text(model.whyLine)
                    .font(.arcSans(10.5))
                    .foregroundStyle(Color.arcMutedOnDark)
                    .multilineTextAlignment(.center)
                    .lineSpacing(2)
                    .padding(.top, 4)
            } else {
                // §6 — calibrating / sparse: show the state, never a score.
                WatchBaselineRing(
                    score: 0, size: 88, lineWidth: 9, numberSize: 15,
                    tint: .arcHollowGold, glyph: "•••"
                )
                Text("Calibrating")
                    .font(.arcSerif(23))
                    .foregroundStyle(Color.arcCream)
                    .padding(.top, 9)
                Text("Building your baseline. A real read lands once there's enough overnight data.")
                    .font(.arcSans(10.5))
                    .foregroundStyle(Color.arcMutedOnDark)
                    .multilineTextAlignment(.center)
                    .lineSpacing(2)
                    .padding(.top, 4)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(.horizontal, 14)
        .background(Color.black)
    }
}

// MARK: - 2b · Energy — all-day gauge — `data-screen-label="Watch energy"`

struct WatchEnergyV3View: View {
    @Environment(WatchModel.self) private var model

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("ENERGY")
                .font(.arcMono(8))
                .kerning(0.8)
                .foregroundStyle(Color.arcMutedOnDark)

            if model.energyKnown {
                (Text("\(model.energyPercent)")
                    .font(.arcMono(30))
                    .foregroundColor(.arcCream)
                    + Text("%")
                    .font(.arcMono(13))
                    .foregroundColor(.arcMutedOnDark))
                    .padding(.top, 8)
                    .padding(.bottom, 6)

                // Ceiling bar — amber when the day's ceiling is pulled down.
                GeometryReader { geo in
                    ZStack(alignment: .leading) {
                        Capsule().fill(Color.white.opacity(0.12))
                        Capsule()
                            .fill(model.energyLowered ? Color.arcAmber : Color.arcPrimaryGreen)
                            .frame(width: geo.size.width * CGFloat(model.energyPercent) / 100)
                    }
                }
                .frame(height: 7)
                .padding(.bottom, 9)

                Text(model.energyBestWindow)
                    .font(.arcSans(10.5))
                    .foregroundStyle(Color.arcRailLight)
                    .lineSpacing(2)

                Spacer(minLength: 6)

                Text(model.energyCeilingNote)
                    .font(.arcSans(9))
                    .foregroundStyle(Color.arcRailDim)
                    .lineSpacing(2)
            } else {
                Text("Building")
                    .font(.arcSerif(22))
                    .foregroundStyle(Color.arcCream)
                    .padding(.top, 10)
                    .padding(.bottom, 6)
                Text("Your all-day energy appears once there's enough Watch data. Open iPhone for today's curve.")
                    .font(.arcSans(10.5))
                    .foregroundStyle(Color.arcMutedOnDark)
                    .lineSpacing(2)
                Spacer(minLength: 0)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .background(Color.black)
    }
}

// MARK: - 2c · Felt check-in — `data-screen-label="Watch check-in"`
// One tap → posts back into today's score (§1.5).

struct WatchCheckinV3View: View {
    @Environment(WatchModel.self) private var model

    var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                Text("HOW DO YOU FEEL?")
                    .font(.arcMono(8))
                    .kerning(0.8)
                    .foregroundStyle(Color.arcMutedOnDark)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.bottom, 10)

                VStack(spacing: 7) {
                    ForEach(model.feelChips) { chip in
                        let isPicked = model.selectedFeel == chip.id
                        Button {
                            model.pickFeel(chip.id)
                        } label: {
                            Text(isPicked ? "\(chip.label) ✓" : chip.label)
                                .font(.arcSans(12, weight: .semibold))
                                .foregroundStyle(isPicked ? Color.arcBrightGreen : Color(hex: 0xE8E4DA))
                                .frame(maxWidth: .infinity, minHeight: 44) // ≥44pt
                                .background(
                                    isPicked ? Color.arcPrimaryGreen.opacity(0.18) : Color.clear,
                                    in: Capsule()
                                )
                                .overlay(
                                    Capsule().strokeBorder(
                                        isPicked ? Color.arcPrimaryGreen.opacity(0.6) : Color.white.opacity(0.16)
                                    )
                                )
                        }
                        .buttonStyle(.plain)
                    }
                }

                Text(model.checkinDone ? "✓ Noted — tunes today's score" : "One tap. That's the whole job.")
                    .font(.arcSans(9.5))
                    .foregroundStyle(model.checkinDone ? Color.arcBrightGreen : Color.arcRailDim)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: .infinity)
                    .padding(.top, 10)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
        }
        .background(Color.black)
    }
}

// MARK: - 2d · Vitality glance — `data-screen-label="Watch vitality"`
// The slow score — age ± band.

struct WatchVitalityV3View: View {
    @Environment(WatchModel.self) private var model

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("VITALITY AGE")
                .font(.arcMono(8))
                .kerning(0.8)
                .foregroundStyle(Color.arcMutedOnDark)

            if model.vitalityKnown {
                (Text("\(model.vitalityAge) ")
                    .font(.arcMono(30))
                    .foregroundColor(.arcCream)
                    + Text("±\(model.vitalityBand)")
                    .font(.arcMono(12))
                    .foregroundColor(.arcMutedOnDark))
                    .padding(.top, 8)
                    .padding(.bottom, 4)

                // Gentle downward vitality line (design polyline).
                GeometryReader { geo in
                    let pts: [CGFloat] = [8, 12, 14, 18, 20]
                    let stepX = geo.size.width / CGFloat(pts.count - 1)
                    Path { path in
                        for (i, y) in pts.enumerated() {
                            let x = CGFloat(i) * stepX
                            let yy = geo.size.height * (y / 28)
                            if i == 0 { path.move(to: CGPoint(x: x, y: yy)) }
                            else { path.addLine(to: CGPoint(x: x, y: yy)) }
                        }
                    }
                    .stroke(Color.arcPrimaryGreen, style: StrokeStyle(lineWidth: 2, lineCap: .round, lineJoin: .round))
                }
                .frame(height: 26)

                Text(model.vitalityDelta)
                    .font(.arcSans(10.5))
                    .foregroundStyle(Color.arcRailLight)
                    .padding(.top, 8)
            } else {
                Text("Warming up")
                    .font(.arcSerif(21))
                    .foregroundStyle(Color.arcCream)
                    .padding(.top, 8)
                    .padding(.bottom, 4)
                Text(model.vitalityDelta)
                    .font(.arcSans(10.5))
                    .foregroundStyle(Color.arcMutedOnDark)
                    .lineSpacing(2)
            }

            Spacer(minLength: 6)

            Text(model.vitalityFootnote)
                .font(.arcSans(9))
                .foregroundStyle(Color.arcRailDim)
                .lineSpacing(2)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .background(Color.black)
    }
}

// MARK: - 2e · Live workout — `data-screen-label="Watch workout"`
// Current HR + zone bar + live "today's ceiling" buffer + ease-off cue.
// Stays a wrist-down glance — the in-workout readiness-buffer pattern.

struct WatchWorkoutV3View: View {
    @Environment(WatchModel.self) private var model

    private var ceilingFraction: CGFloat {
        CGFloat(model.workoutCeilingUsed / model.workoutCeilingMax)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Text(model.workoutTitle)
                    .font(.arcMono(8))
                    .kerning(0.8)
                    .foregroundStyle(Color.arcBrightGreen)
                Spacer()
                Text(model.workoutElapsed)
                    .font(.arcMono(8))
                    .foregroundStyle(Color.arcMutedOnDark)
            }

            (Text("\(model.workoutHR) ")
                .font(.arcMono(30))
                .foregroundColor(.arcCream)
                + Text("bpm")
                .font(.arcMono(10))
                .foregroundColor(.arcMutedOnDark))
                .padding(.top, 8)
                .padding(.bottom, 2)

            Text(model.workoutZoneLabel)
                .font(.arcMono(8))
                .kerning(0.8)
                .foregroundStyle(Color.arcHollowGold)
                .padding(.bottom, 8)

            // 5-segment zone bar — the active zone lit green.
            HStack(spacing: 3) {
                ForEach(1...5, id: \.self) { zone in
                    Capsule()
                        .fill(zone == model.workoutZoneIndex ? Color.arcPrimaryGreen : Color.white.opacity(0.16))
                        .frame(height: 6)
                }
            }
            .padding(.bottom, 12)

            Text("TODAY'S CEILING · \(model.workoutCeilingUsed, specifier: "%.1f") / \(model.workoutCeilingMax, specifier: "%.1f")")
                .font(.arcMono(8))
                .kerning(0.8)
                .foregroundStyle(Color.arcMutedOnDark)
                .padding(.bottom, 5)

            // Ceiling buffer bar — amber as it fills toward the day's ceiling.
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule().fill(Color.white.opacity(0.12))
                    Capsule().fill(Color.arcAmber)
                        .frame(width: geo.size.width * ceilingFraction)
                }
            }
            .frame(height: 6)
            .padding(.bottom, 8)

            Spacer(minLength: 0)

            Text(model.workoutEaseOff)
                .font(.arcSans(9.5))
                .foregroundStyle(Color.arcRailLight)
                .lineSpacing(2)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
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

            if model.hrvLatest > 0 {
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
            } else {
                Text("Building your HRV baseline")
                    .font(.arcSerif(19))
                    .foregroundStyle(Color.arcCream)
                    .lineSpacing(1)
                    .padding(.top, 10)
                Spacer(minLength: 6)
                Text("Wear the Watch to sleep — your recovery trend appears on iPhone.")
                    .font(.arcSans(10.5))
                    .foregroundStyle(Color.arcRailLight)
                    .lineSpacing(2)
            }
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

            Text("When your bloods are reviewed, this lets you know — calmly, no red numbers. The full story lives on iPhone.")
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
#Preview("Energy") { WatchEnergyV3View().environment(WatchModel()) }
#Preview("Check-in") { WatchCheckinV3View().environment(WatchModel()) }
#Preview("Vitality") { WatchVitalityV3View().environment(WatchModel()) }
#Preview("Glance") { WatchGlanceV3View().environment(WatchModel()) }
#Preview("Quick-log") { WatchQuickLogV3View().environment(WatchModel()) }
#Preview("Workout") { WatchWorkoutV3View().environment(WatchModel()) }
#Preview("Experiment") { WatchExperimentV3View().environment(WatchModel()) }
#Preview("Result ready") { WatchResultReadyV3View().environment(WatchModel()) }
#endif
