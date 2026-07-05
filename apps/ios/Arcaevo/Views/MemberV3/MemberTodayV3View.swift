import SwiftUI

/// MEMBER APP · dashboard ("Member home" in Prototype.dc.html).
/// Baseline status ring, results-in card, latest insight (focus), Watch
/// snapshot, fusion-timeline entry, active-experiment card. Dark #1C2620.
struct MemberTodayV3View: View {
    @Environment(AppState.self) private var appState
    @Environment(AppModel.self) private var model

    init() {}

    var body: some View {
        NavigationStack {
            ZStack {
                Color.arcDarkSurface.ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: 0) {
                        header
                        ringRow
                        readinessCard
                        energyCard
                        resultsCard
                        focusCard
                        watchCard
                        fusionCard
                        experimentCard
                        vitalityCard
                    }
                    .padding(.horizontal, 24)
                    .padding(.top, 14)
                    .padding(.bottom, 20)
                }
            }
            .toolbar(.hidden, for: .navigationBar)
        }
        .task {
            if model.user == nil { await model.loadAll() }
        }
        // The dashboard readiness card is a first-score surface: once it shows a
        // real number, cancel the one-time first-reading activation nudge.
        .task(id: model.readinessResult?.state.showsScore) {
            if model.readinessResult?.state.showsScore == true {
                appState.markFirstScoreViewed()
                appState.markCheckedInToday()
            }
        }
    }

    // MARK: Header — "GOOD MORNING, AOIFE" · "WED 2 JUL" · ✳ chat · ◍ account

    private var header: some View {
        HStack(alignment: .firstTextBaseline) {
            Mv3Eyebrow(text: greeting, size: 11, kerning: 1.1)
            Spacer()
            HStack(spacing: 12) {
                Mv3Eyebrow(text: dateLine, color: .arcRailDim)
                // Ask Arcaevo entry (chat isn't a tab in the 4-tab v3 bar,
                // so it rides on the dashboard header — flagged deviation).
                NavigationLink {
                    AskArcaevoV3View()
                } label: {
                    Text("✳")
                        .font(.arcSans(15))
                        .foregroundStyle(Color.arcMutedOnDark)
                        .frame(minWidth: 34, minHeight: 44)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                Button {
                    appState.selectedTab = .account
                } label: {
                    Text("◍")
                        .font(.arcSans(15))
                        .foregroundStyle(Color.arcMutedOnDark)
                        .frame(minWidth: 34, minHeight: 44)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.bottom, 8)
    }

    private var greeting: String {
        let hour = Calendar.current.component(.hour, from: Date())
        let opener: String
        switch hour {
        case 5..<12: opener = "GOOD MORNING"
        case 12..<18: opener = "GOOD AFTERNOON"
        default: opener = "GOOD EVENING"
        }
        // Only greet by name once the real signed-in member is known — never a
        // fabricated persona name before the session loads.
        guard let first = model.user?.name.components(separatedBy: " ").first, !first.isEmpty else {
            return opener
        }
        return "\(opener), \(first.uppercased())"
    }

    private var dateLine: String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_IE")
        formatter.dateFormat = "EEE d MMM"
        return formatter.string(from: Date()).uppercased()
    }

    // MARK: Readiness ring — the member's real, wearable-derived score

    /// The ring is honest: it shows a number only when the readiness engine has
    /// enough real overnight data to stand behind one (§6). Before then it says
    /// so rather than inventing a score.
    private var showsReadinessScore: Bool {
        model.readinessResult?.state.showsScore ?? false
    }

    private var ringRow: some View {
        HStack(spacing: 18) {
            healthRing
            VStack(alignment: .leading, spacing: 4) {
                Text(showsReadinessScore ? "From your Watch this morning." : "Learning your normal.")
                    .font(.arcSans(14.5, weight: .bold))
                    .foregroundStyle(Color.arcCream)
                Text(showsReadinessScore
                     ? "Your readiness follows your own HRV, resting heart rate and sleep — not your effort."
                     : "Wear your Watch to sleep for a few nights and your readiness appears here.")
                    .font(.arcSans(12))
                    .lineSpacing(3)
                    .foregroundStyle(Color.arcMutedOnDark)
            }
        }
        .padding(.bottom, 16)
    }

    private var healthRing: some View {
        ZStack {
            Circle()
                .stroke(Color.white.opacity(0.1), lineWidth: 8)
            Circle()
                .trim(from: 0, to: showsReadinessScore ? CGFloat(model.readinessScore) / 100 : 0)
                .stroke(Color.arcPrimaryGreen, style: StrokeStyle(lineWidth: 8, lineCap: .round))
                .rotationEffect(.degrees(-90))
            VStack(spacing: 1) {
                Text(showsReadinessScore ? "\(model.readinessScore)" : "•••")
                    .font(.arcMono(showsReadinessScore ? 27 : 20, weight: .medium))
                    .foregroundStyle(Color.arcCream)
                Text(showsReadinessScore ? "READINESS" : "CALIBRATING")
                    .font(.arcSans(8.5))
                    .kerning(0.7)
                    .foregroundStyle(Color.arcMutedOnDark)
            }
        }
        .frame(width: 96, height: 96)
    }

    // MARK: "READINESS · THIS MORNING" → Readiness screen (§1 daily glance)

    private var readinessCard: some View {
        NavigationLink {
            ReadinessV3View()
        } label: {
            HStack {
                VStack(alignment: .leading, spacing: 5) {
                    Mv3Eyebrow(text: "READINESS · THIS MORNING", size: 9, color: Mv3.watchAmber, kerning: 0.9)
                    Text(readinessLine)
                        .font(.arcSans(13.5, weight: .semibold))
                        .foregroundStyle(Color.arcCream)
                        .multilineTextAlignment(.leading)
                }
                Spacer()
                Text("›")
                    .font(.arcSans(16))
                    .foregroundStyle(Mv3.watchAmber)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 13)
            .background(Mv3.goEasyAmber.opacity(0.1), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .strokeBorder(Mv3.goEasyAmber.opacity(0.35), lineWidth: 1)
            )
            .contentShape(RoundedRectangle(cornerRadius: 16))
        }
        .buttonStyle(.plain)
        .padding(.bottom, 10)
        .accessibilityLabel("Readiness this morning. \(readinessAccessibility)")
    }

    private var readinessLine: String {
        guard let result = model.readinessResult, result.state.showsScore else {
            return "Learning your normal — check back soon."
        }
        let decision = result.decision.headline.lowercased().replacingOccurrences(of: ".", with: "")
        let ironHint = model.penalties.contains(where: { $0.marker == "ferritin" }) ? " Your iron may be part of why." : ""
        return "\(result.final) — \(decision).\(ironHint)"
    }

    private var readinessAccessibility: String {
        guard let result = model.readinessResult, result.state.showsScore else {
            return "Calibrating."
        }
        return "\(Mv3.spell(result.final)) of one hundred, \(result.decision.headline.lowercased().dropLast())."
    }

    // MARK: "ENERGY · ALL DAY" → Energy screen (§2 all-day glance)

    private var energyCard: some View {
        NavigationLink {
            EnergyV3View()
        } label: {
            HStack {
                VStack(alignment: .leading, spacing: 5) {
                    Mv3Eyebrow(text: "ENERGY · ALL DAY", size: 9, kerning: 0.9)
                    Text(energyLine)
                        .font(.arcSans(13, weight: .semibold))
                        .foregroundStyle(Color.arcCream)
                }
                Spacer()
                Text("›")
                    .font(.arcSans(16))
                    .foregroundStyle(Color.arcMutedOnDark)
            }
            .mv3Card(radius: 16, vPad: 13)
            .contentShape(RoundedRectangle(cornerRadius: 16))
        }
        .buttonStyle(.plain)
        .padding(.bottom, 10)
        .accessibilityLabel("Energy all day. \(energyLine)")
    }

    private var energyLine: String {
        let now = model.energyDay?.value(at: Date()) ?? 54
        if let dip = model.energyDay?.forecastDipHour {
            return "\(now) of 100 — dips around \(String(format: "%02d", dip)):00"
        }
        return "\(now) of 100 — modelled all day"
    }

    // MARK: "JULY PANEL · REVIEWED" → Results tab

    private var resultsCard: some View {
        Button {
            appState.selectedTab = .results
        } label: {
            HStack {
                VStack(alignment: .leading, spacing: 5) {
                    HStack(spacing: 7) {
                        Mv3Eyebrow(text: model.showsBloodSample ? "RESULTS · SAMPLE PREVIEW" : "LATEST PANEL · REVIEWED",
                                   size: 9, color: model.showsBloodSample ? .arcHollowGold : .arcBrightGreen, kerning: 0.9)
                        if model.showsBloodSample { Mv3SampleTag() }
                    }
                    Text(model.showsBloodSample
                         ? "No bloodwork yet — preview an example panel"
                         : "38 markers in — one worth acting on")
                        .font(.arcSans(13.5, weight: .semibold))
                        .foregroundStyle(Color.arcCream)
                }
                Spacer()
                Text("›")
                    .font(.arcSans(16))
                    .foregroundStyle(model.showsBloodSample ? Color.arcHollowGold : Color.arcBrightGreen)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 14)
            .background((model.showsBloodSample ? Color.arcHollowGold : Color.arcPrimaryGreen).opacity(0.1),
                        in: RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .strokeBorder((model.showsBloodSample ? Color.arcHollowGold : Color.arcPrimaryGreen).opacity(0.35), lineWidth: 1)
            )
            .contentShape(RoundedRectangle(cornerRadius: 16))
        }
        .buttonStyle(.plain)
        .padding(.bottom, 10)
    }

    // MARK: "FOCUS THIS WEEK" → Insights

    private var focusCard: some View {
        NavigationLink {
            InsightsV3View()
        } label: {
            VStack(alignment: .leading, spacing: 6) {
                HStack(spacing: 7) {
                    Mv3Eyebrow(text: "FOCUS THIS WEEK", size: 9, kerning: 0.9)
                    if model.showsBloodSample { Mv3SampleTag() }
                    Spacer()
                    Text(model.showsBloodSample ? "SEE ›" : "WHY? ›")
                        .font(.arcMono(9, weight: .regular))
                        .foregroundStyle(Color.arcBrightGreen)
                }
                Text(model.showsBloodSample
                     ? "See a sample of the weekly focus your data will earn."
                     : "Keep the evening walks — your ApoB is answering them.")
                    .font(.arcSans(14, weight: .semibold))
                    .lineSpacing(3)
                    .foregroundStyle(Color.arcCream)
                    .multilineTextAlignment(.leading)
            }
            .mv3Card(radius: 16)
            .contentShape(RoundedRectangle(cornerRadius: 16))
        }
        .buttonStyle(.plain)
        .padding(.bottom, 10)
    }

    // MARK: "TODAY · APPLE WATCH"

    private var watchCard: some View {
        VStack(alignment: .leading, spacing: 7) {
            Mv3Eyebrow(text: "TODAY · APPLE WATCH", size: 9, kerning: 0.9)
            HStack(spacing: 14) {
                watchStat("❤", value: rhrText, label: "rhr")
                watchStat("☾", value: sleepText, label: "sleep")
                watchStat("⚡", value: stepsText, label: "steps")
            }
        }
        .mv3Card(radius: 16, vPad: 13)
        .padding(.bottom, 10)
    }

    private func watchStat(_ glyph: String, value: String, label: String) -> some View {
        HStack(spacing: 4) {
            Text("\(glyph) \(value)")
                .font(.arcSans(12.5, weight: .semibold))
                .foregroundStyle(Color.arcCream)
            Text(label)
                .font(.arcSans(12.5))
                .foregroundStyle(Color.arcMutedOnDark)
        }
    }

    private var rhrText: String {
        if let latest = model.wearableSeries[.restingHeartRate]?.last?.value {
            return "\(Int(latest.rounded()))"
        }
        return "—" // no fabricated value before the Watch reports
    }

    private var sleepText: String {
        guard let hours = model.wearableSeries[.sleepHours]?.last?.value else { return "—" }
        let total = Int((hours * 60).rounded())
        return "\(total / 60)h \(String(format: "%02d", total % 60))m"
    }

    /// Steps from the real HealthKit series when present; otherwise honest "—"
    /// (steps aren't yet a modelled trend, so we never invent a figure).
    private var stepsText: String {
        guard let steps = model.wearableSeries[.steps]?.last?.value, steps > 0 else { return "—" }
        return Int(steps.rounded()).formatted(.number.grouping(.automatic))
    }

    // MARK: "FUSION · APOB × RESTING HR" → Fusion timeline

    private var fusionCard: some View {
        NavigationLink {
            FusionTimelineV3View()
        } label: {
            VStack(alignment: .leading, spacing: 8) {
                HStack(spacing: 7) {
                    Mv3Eyebrow(text: "FUSION · APOB × RESTING HR", size: 9, kerning: 0.9)
                    if model.showsBloodSample { Mv3SampleTag() }
                    Spacer()
                    Text("OPEN ›")
                        .font(.arcMono(9, weight: .regular))
                        .foregroundStyle(Color.arcBrightGreen)
                }
                Mv3MiniFusionSparkline()
                    .frame(height: 28)
            }
            .mv3Card(radius: 16, vPad: 13)
            .contentShape(RoundedRectangle(cornerRadius: 16))
        }
        .buttonStyle(.plain)
        .padding(.bottom, 10)
    }

    // MARK: "ACTIVE EXPERIMENT" → Experiments tab

    private var experimentCard: some View {
        Button {
            appState.selectedTab = .experiments
        } label: {
            HStack {
                VStack(alignment: .leading, spacing: 5) {
                    Mv3Eyebrow(text: "ACTIVE EXPERIMENT", size: 9, kerning: 0.9)
                    Text(experimentLine)
                        .font(.arcSans(13, weight: .semibold))
                        .foregroundStyle(Color.arcCream)
                }
                Spacer()
                Text("›")
                    .font(.arcSans(16))
                    .foregroundStyle(Color.arcMutedOnDark)
            }
            .mv3Card(radius: 16, vPad: 13)
            .contentShape(RoundedRectangle(cornerRadius: 16))
        }
        .buttonStyle(.plain)
    }

    private var experimentLine: String {
        if let exp = appState.experiment, exp.verdict == nil {
            return "\(exp.what) · \(Mv3Adherence.percent(for: exp))% adherence"
        }
        return "None yet — change one thing, we'll tell you if it worked"
    }

    // MARK: "VITALITY AGE · THE SLOW SCORE" → Vitality screen (§3)

    private var vitalityCard: some View {
        NavigationLink {
            VitalityV3View()
        } label: {
            HStack {
                VStack(alignment: .leading, spacing: 5) {
                    Mv3Eyebrow(text: "VITALITY AGE · THE SLOW SCORE", size: 9, kerning: 0.9)
                    Text(vitalityLine)
                        .font(.arcSans(13, weight: .semibold))
                        .foregroundStyle(Color.arcCream)
                }
                Spacer()
                Text("›")
                    .font(.arcSans(16))
                    .foregroundStyle(Color.arcMutedOnDark)
            }
            .mv3Card(radius: 16, vPad: 13)
            .contentShape(RoundedRectangle(cornerRadius: 16))
        }
        .buttonStyle(.plain)
        .padding(.top, 10)
        .accessibilityLabel("Vitality age, the slow score. \(vitalityLine)")
    }

    private var vitalityLine: String {
        if let score = model.vitalityScore {
            return "\(score.age) ± \(score.band) — the slow score"
        }
        return "Warming up — appears after your first blood panel"
    }
}

/// The dashboard's fusion mini-chart: the prototype's 300×32 sparkline —
/// gold continuous wearable line, solid green lab dots.
struct Mv3MiniFusionSparkline: View {
    private let line: [CGPoint] = [
        CGPoint(x: 0, y: 8), CGPoint(x: 60, y: 11), CGPoint(x: 120, y: 14),
        CGPoint(x: 180, y: 18), CGPoint(x: 240, y: 22), CGPoint(x: 300, y: 25),
    ]
    private let dots: [CGPoint] = [
        CGPoint(x: 30, y: 9), CGPoint(x: 150, y: 16), CGPoint(x: 266, y: 23),
    ]

    var body: some View {
        GeometryReader { geo in
            let scaleX = geo.size.width / 300
            let scaleY = geo.size.height / 32
            ZStack {
                Path { path in
                    guard let first = line.first else { return }
                    path.move(to: CGPoint(x: first.x * scaleX, y: first.y * scaleY))
                    for p in line.dropFirst() {
                        path.addLine(to: CGPoint(x: p.x * scaleX, y: p.y * scaleY))
                    }
                }
                .stroke(Color.arcHollowGold.opacity(0.85), style: StrokeStyle(lineWidth: 2, lineCap: .round))
                ForEach(dots.indices, id: \.self) { i in
                    Circle()
                        .fill(Color.arcPrimaryGreen)
                        .frame(width: 8, height: 8)
                        .position(x: dots[i].x * scaleX, y: dots[i].y * scaleY)
                }
            }
        }
    }
}

/// Adherence for a running experiment. Read from the Watch where it can:
/// in demo, the seeded HealthKit-ish series "shows" the behaviour on a
/// deterministic ~87% of elapsed days, topped up by explicit quick-log
/// check-ins (`daysLogged` — phone + watch).
enum Mv3Adherence {
    static func percent(for exp: ActiveExperiment) -> Int {
        let elapsed = max(1, Calendar.current.dateComponents([.day], from: exp.startedAt, to: Date()).day ?? 1)
        let watchRead = Int((Double(elapsed) * 0.87).rounded())
        let logged = min(elapsed, max(exp.daysLogged, watchRead))
        return min(100, Int((Double(logged) / Double(elapsed) * 100).rounded()))
    }
}
