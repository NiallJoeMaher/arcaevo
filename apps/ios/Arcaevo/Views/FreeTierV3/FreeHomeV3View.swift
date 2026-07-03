import SwiftUI

/// FREE TIER — Home (dark #1C2620).
/// Fusion-lite: real (or mock) Watch data cards + exactly ONE locked
/// members card, then the upgrade CTA card. Data comes from AppModel's
/// HealthKit provider (MockHealthStore/demo series offline).
struct FreeHomeV3View: View {
    @Environment(AppState.self) private var appState
    @Environment(AppModel.self) private var model
    @Environment(JourneyFlow.self) private var flow

    var body: some View {
        ZStack {
            Color.arcDarkSurface.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    ArcEyebrow(text: greeting, onDark: true, size: 11)
                        .padding(.bottom, 18)

                    // Apple Health summary card (real/mock Watch data).
                    VStack(alignment: .leading, spacing: 7) {
                        ArcEyebrow(text: "Apple Health · Connected", size: 9.5, color: .arcBrightGreen)
                        Text(healthSummary)
                            .font(.arcSans(14, weight: .semibold))
                            .lineSpacing(14 * 0.3)
                            .foregroundStyle(Color.arcCream)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(EdgeInsets(top: 15, leading: 16, bottom: 15, trailing: 16))
                    .background(Color.arcPrimaryGreen.opacity(0.12), in: RoundedRectangle(cornerRadius: 16))
                    .overlay(
                        RoundedRectangle(cornerRadius: 16)
                            .stroke(Color.arcPrimaryGreen.opacity(0.3), lineWidth: 1)
                    )
                    .padding(.bottom, 12)

                    // Resting HR trend card (real/mock series sparkline).
                    VStack(alignment: .leading, spacing: 0) {
                        ArcEyebrow(text: "Resting HR · \(rhrSeries.count) days", size: 9.5, color: .arcMutedOnDark)
                            .padding(.bottom, 10)
                        SparklinePath(values: rhrValues)
                            .stroke(
                                Color.arcPrimaryGreen,
                                style: StrokeStyle(lineWidth: 2.5, lineCap: .round, lineJoin: .round)
                            )
                            .frame(height: 48)
                        Text(rhrCaption)
                            .font(.arcSans(12))
                            .foregroundStyle(Color.arcMutedOnDark)
                            .padding(.top, 6)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(EdgeInsets(top: 15, leading: 16, bottom: 15, trailing: 16))
                    .background(Color.white.opacity(0.06), in: RoundedRectangle(cornerRadius: 16))
                    .padding(.bottom, 12)

                    // THE locked card — the one members-only tease.
                    VStack(alignment: .leading, spacing: 0) {
                        HStack {
                            ArcEyebrow(text: "What's driving it?", size: 9.5, color: .arcMutedOnDark)
                            Spacer()
                            Text("🔒 MEMBERS")
                                .font(.arcMono(9.5, weight: .medium))
                                .kerning(0.5)
                                .foregroundStyle(Color.arcAmber)
                        }
                        .padding(.bottom, 7)
                        Text("Bloods would tell us whether this is fitness — or something to check.")
                            .font(.arcSans(13))
                            .lineSpacing(13 * 0.35)
                            .foregroundStyle(Color.arcMutedOnDark)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(EdgeInsets(top: 15, leading: 16, bottom: 15, trailing: 16))
                    .background(Color.white.opacity(0.06), in: RoundedRectangle(cornerRadius: 16))
                    .padding(.bottom, 16)

                    Spacer(minLength: 24)

                    // Upgrade CTA card (cream on dark).
                    VStack(alignment: .leading, spacing: 0) {
                        Text("Your watch is talking. Add bloods to hear the whole story.")
                            .font(.arcSans(15, weight: .bold))
                            .lineSpacing(15 * 0.2)
                            .foregroundStyle(Color.arcDarkSurface)
                            .padding(.bottom, 12)
                        ArcPillButton(title: "See plans — from €119/yr", fontSize: 13.5, verticalPadding: 12) {
                            flow.push(.plans)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(18)
                    .background(Color.arcCream, in: RoundedRectangle(cornerRadius: 18))
                }
                .padding(EdgeInsets(top: 14, leading: 24, bottom: 24, trailing: 24))
            }
        }
        .task {
            if model.user == nil { await model.loadAll() }
        }
    }

    // MARK: Data

    private var greeting: String {
        let hour = Calendar.current.component(.hour, from: .now)
        let part = hour < 12 ? "Good morning" : (hour < 18 ? "Good afternoon" : "Good evening")
        let first = (model.user?.name ?? "Aoife").split(separator: " ").first.map(String.init) ?? "Aoife"
        return "\(part), \(first)"
    }

    private var rhrSeries: [WearableSignal] {
        (model.wearableSeries[.restingHeartRate] ?? []).sorted { $0.date < $1.date }
    }

    private var rhrValues: [Double] { rhrSeries.map(\.value) }

    private var healthSummary: String {
        let rhr = rhrSeries.last.map { "\(Int($0.value.rounded()))" }
        let sleep = (model.wearableSeries[.sleepHours] ?? []).sorted { $0.date < $1.date }.last.map { signal -> String in
            let mins = Int((signal.value * 60).rounded())
            return "\(mins / 60)h \(String(format: "%02d", mins % 60))m"
        }
        let hrv = (model.wearableSeries[.hrv] ?? []).sorted { $0.date < $1.date }.last.map { "\(Int($0.value.rounded())) ms" }
        guard let rhr, let sleep, let hrv else {
            // Series still loading — the design's demo line.
            return "Resting HR 54 · Sleep 7h 12m · 8,940 steps"
        }
        return "Resting HR \(rhr) · Sleep \(sleep) · HRV \(hrv)"
    }

    private var rhrCaption: String {
        guard let first = rhrValues.first, let last = rhrValues.last, rhrValues.count > 3 else {
            return "Down 4 bpm since April — a good sign."
        }
        let delta = Int((last - first).rounded())
        let monthFormatter = DateFormatter()
        monthFormatter.dateFormat = "MMMM"
        let since = rhrSeries.first.map { monthFormatter.string(from: $0.date) } ?? "April"
        if delta <= -1 { return "Down \(-delta) bpm since \(since) — a good sign." }
        if delta >= 1 { return "Up \(delta) bpm since \(since) — worth watching." }
        return "Steady since \(since)."
    }
}

/// Simple polyline sparkline (design: stroke #34A07C, width 2.5, round caps).
struct SparklinePath: Shape {
    var values: [Double]

    func path(in rect: CGRect) -> Path {
        var path = Path()
        guard values.count > 1 else { return path }
        let minV = values.min() ?? 0
        let maxV = values.max() ?? 1
        let span = max(maxV - minV, 0.0001)
        let stepX = rect.width / CGFloat(values.count - 1)
        // ~12% vertical inset so round caps don't clip.
        let inset = rect.height * 0.12
        let usable = rect.height - inset * 2
        for (i, v) in values.enumerated() {
            let x = rect.minX + CGFloat(i) * stepX
            let y = rect.minY + inset + usable * (1 - CGFloat((v - minV) / span))
            if i == 0 { path.move(to: CGPoint(x: x, y: y)) } else { path.addLine(to: CGPoint(x: x, y: y)) }
        }
        return path
    }
}
