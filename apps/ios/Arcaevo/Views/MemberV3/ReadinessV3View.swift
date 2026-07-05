import SwiftUI

/// MEMBER APP · Readiness ("Readiness" in Prototype.dc.html).
///
/// The flagship daily glance (ALGORITHM §1): the locked-at-wake score ring,
/// the decision + one-line why, the wearable/sleep/cycle breakdown, the
/// **blood-layer ON/OFF toggle** that flips the wearable-only core (71) to the
/// blood-recalibrated score (62) with the ferritin explanation, and today's
/// Target Exertion ceiling. Honours §6: while calibrating / sparse-night the
/// screen shows that state honestly instead of a confident number.
struct ReadinessV3View: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(AppModel.self) private var model

    init() {}

    var body: some View {
        ZStack {
            Color.arcDarkSurface.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    Mv3BackLink(title: "Today") { dismiss() }
                    Mv3Eyebrow(text: "MORNING READINESS · LOCKED AT WAKE")
                        .padding(.bottom, 12)

                    if let result = model.readinessResult {
                        if result.state.showsScore {
                            scoreRow(result)
                            metricsCard(result)
                            bloodLayerCard(result)
                            targetExertionCard(result)
                        } else {
                            degradedCard(result)
                        }
                    } else {
                        degradedPlaceholder
                    }

                    checkinCTA
                }
                .padding(.horizontal, 24)
                .padding(.top, 4)
                .padding(.bottom, 20)
            }
        }
        .toolbar(.hidden, for: .navigationBar)
        .task { if model.readinessResult == nil { await model.loadAll() } }
    }

    // MARK: Score ring + decision

    private var ringColor: Color {
        guard let d = model.readinessResult?.decision else { return .arcPrimaryGreen }
        return (d == .goEasy || d == .rest) ? Mv3.goEasyAmber : .arcPrimaryGreen
    }

    private func scoreRow(_ result: ReadinessResult) -> some View {
        HStack(alignment: .center, spacing: 16) {
            Mv3ScoreRing(score: result.final, caption: "READINESS", color: ringColor)
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(
                    "Readiness \(Mv3.spell(result.final)) of one hundred, \(result.decision.headline.lowercased().dropLast()). Plus or minus \(result.band)."
                )
            VStack(alignment: .leading, spacing: 4) {
                Text(result.decision.headline)
                    .font(.arcSerif(23))
                    .foregroundStyle(Color.arcCream)
                    .lineSpacing(1)
                Text(subLine(result))
                    .font(.arcSans(11.5))
                    .foregroundStyle(Color.arcMutedOnDark)
                    .lineSpacing(2)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(.bottom, 12)
    }

    /// The one-line why. Blood ON → the engine's real `why` (the ferritin
    /// story for the demo); blood OFF → the design's wearable-only explainer,
    /// which frames the toggle rather than the (penalty-free) engine line.
    private func subLine(_ result: ReadinessResult) -> String {
        if model.bloodLayerEnabled {
            return result.why
        }
        return "The wearable-only read. Without your bloods, today would look like a normal training day."
    }

    // MARK: Wearable / sleep / cycle breakdown

    private func metricsCard(_ result: ReadinessResult) -> some View {
        VStack(spacing: 0) {
            let rows = breakdownRows(result)
            ForEach(rows.indices, id: \.self) { i in
                metricRow(rows[i], isLast: i == rows.count - 1)
            }
        }
        .padding(.horizontal, 15)
        .padding(.vertical, 4)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Mv3.cardFill, in: RoundedRectangle(cornerRadius: 15, style: .continuous))
        .padding(.bottom, 9)
    }

    private struct BreakdownRow: Identifiable {
        var id = UUID()
        var title: String
        var value: String
        var tone: Tone
        enum Tone { case amber, positive, muted }
    }

    private func breakdownRows(_ result: ReadinessResult) -> [BreakdownRow] {
        var rows: [BreakdownRow] = []
        // Wearable contributions (HRV, resting HR) carry a signed core delta.
        for c in result.contributions where c.points != 0 || c.label.contains("baseline") {
            guard c.label.contains("HRV") || c.label.lowercased().contains("heart rate") else { continue }
            let title = c.label.contains("HRV") ? "HRV overnight" : "Resting heart rate"
            rows.append(BreakdownRow(
                title: title,
                value: c.detail ?? "\(c.points >= 0 ? "+" : "")\(c.points)",
                tone: c.points < 0 ? .amber : (c.points > 0 ? .positive : .muted)
            ))
        }
        // Sleep — shown, never scored (§1.4).
        if let night = model.sleepNights.last {
            let total = Int((night.hours * 60).rounded())
            rows.append(BreakdownRow(
                title: "Sleep",
                value: "\(total / 60)h \(String(format: "%02d", total % 60))m · shown, not scored",
                tone: .muted
            ))
        }
        // Cycle phase — only when cycle-aware baselines are opted in (§3.1).
        if let phase = model.cyclePhase {
            rows.append(BreakdownRow(
                title: "Cycle phase",
                value: "\(phase.displayName.lowercased()) · band adjusted, no false alarm",
                tone: .muted
            ))
        }
        return rows
    }

    private func metricRow(_ row: BreakdownRow, isLast: Bool) -> some View {
        VStack(spacing: 0) {
            HStack(alignment: .firstTextBaseline) {
                Text(row.title)
                    .font(.arcSans(12.5, weight: .semibold))
                    .foregroundStyle(Color.arcCream)
                Spacer(minLength: 10)
                Text(row.value)
                    .font(.arcMono(11.5))
                    .foregroundStyle(valueColor(row.tone))
                    .multilineTextAlignment(.trailing)
            }
            .padding(.vertical, 10)
            if !isLast {
                Rectangle().fill(Color.white.opacity(0.07)).frame(height: 1)
            }
        }
    }

    private func valueColor(_ tone: BreakdownRow.Tone) -> Color {
        switch tone {
        case .amber: return Mv3.watchAmber
        case .positive: return .arcBrightGreen
        case .muted: return .arcMutedOnDark
        }
    }

    // MARK: Blood-layer ON/OFF toggle (71 ↔ 62)

    private func bloodLayerCard(_ result: ReadinessResult) -> some View {
        Button {
            model.bloodLayerEnabled.toggle()
        } label: {
            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Mv3Eyebrow(text: "BLOOD LAYER · \(model.bloodLayerEnabled ? "ON · JULY PANEL" : "OFF · WEARABLE-ONLY")",
                               size: 9, color: Mv3.watchAmber, kerning: 0.9)
                    Spacer()
                    Text("TAP TO COMPARE")
                        .font(.arcMono(9))
                        .foregroundStyle(Color.arcMutedOnDark)
                }
                Text(bloodNote(result))
                    .font(.arcSans(12))
                    .foregroundStyle(Color.arcRailLight)
                    .lineSpacing(2)
                    .fixedSize(horizontal: false, vertical: true)
                    .multilineTextAlignment(.leading)
            }
            .padding(.horizontal, 15)
            .padding(.vertical, 13)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Mv3.goEasyAmber.opacity(0.08), in: RoundedRectangle(cornerRadius: 15, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 15, style: .continuous)
                    .strokeBorder(Mv3.goEasyAmber.opacity(0.35), lineWidth: 1)
            )
            .contentShape(RoundedRectangle(cornerRadius: 15))
        }
        .buttonStyle(.plain)
        .frame(minHeight: 44)
        .padding(.bottom, 9)
        .accessibilityLabel("Blood layer \(model.bloodLayerEnabled ? "on" : "off"). \(bloodNote(result))")
        .accessibilityHint("Double tap to compare with the wearable-only score.")
    }

    /// ON → the real top penalty note + the widened band, so the card is wired
    /// to the engine; OFF → the design's verbatim wearable-only framing.
    private func bloodNote(_ result: ReadinessResult) -> String {
        if model.bloodLayerEnabled {
            if let top = model.penalties.first {
                return "\(top.note) Confidence band widened to ±\(result.band). Recheck lands in January."
            }
            return "No active blood penalties — your wearable-only and blood-recalibrated scores agree today."
        }
        return "This is the score every wearable-only app would show — and exactly the reading that hides your iron story. Tap to put the blood layer back."
    }

    // MARK: Target Exertion ceiling

    private func targetExertionCard(_ result: ReadinessResult) -> some View {
        let ceiling = result.exertionCeiling
        let load = currentLoad
        return VStack(alignment: .leading, spacing: 0) {
            Mv3Eyebrow(text: "TODAY'S TARGET EXERTION", size: 9, kerning: 0.9)
                .padding(.bottom, 9)
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule().fill(Color.white.opacity(0.1))
                    Capsule()
                        .fill(Color.arcPrimaryGreen.opacity(0.55))
                        .frame(width: geo.size.width * CGFloat(ceiling) / 10)
                    RoundedRectangle(cornerRadius: 2)
                        .fill(Color.arcCream)
                        .frame(width: 3, height: 14)
                        .offset(x: geo.size.width * CGFloat(min(10, load)) / 10 - 1.5, y: -3)
                }
            }
            .frame(height: 8)
            .padding(.bottom, 8)
            Text(exertionLabel(ceiling: ceiling, load: load))
                .font(.arcSans(11.5))
                .foregroundStyle(Color.arcMutedOnDark)
                .lineSpacing(2)
                .fixedSize(horizontal: false, vertical: true)
            Text("Resistance work counts toward load — not just cardio.")
                .font(.arcSans(10))
                .foregroundStyle(Color.arcRailDim)
                .padding(.top, 5)
        }
        .padding(.horizontal, 15)
        .padding(.vertical, 13)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Mv3.cardFill, in: RoundedRectangle(cornerRadius: 15, style: .continuous))
        .padding(.bottom, 12)
    }

    /// Today's 0–10 load from the day's workouts (§1.6). Falls back to the
    /// design's illustrative 3.1 when nothing has been logged yet today.
    private var currentLoad: Double {
        let today = model.workouts.filter { Calendar.current.isDateInToday($0.date) }
        let load = ReadinessEngine.currentLoad(workoutsToday: today)
        return load > 0 ? load : 3.1
    }

    private func exertionLabel(ceiling: Int, load: Double) -> String {
        let at = String(format: "%.1f", load)
        if model.bloodLayerEnabled {
            return "Up to \(ceiling) of 10 — a ceiling, not a quota. You're at \(at)."
        }
        return "Up to \(ceiling) of 10 on the wearable-only read. You're at \(at)."
    }

    // MARK: Degraded states (§6 — scores never bluff)

    private func degradedCard(_ result: ReadinessResult) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Mv3ScoreRing(score: 0, caption: stateCaption(result.state), color: .white.opacity(0.18))
                .accessibilityHidden(true)
            Text(stateTitle(result.state))
                .font(.arcSerif(23))
                .foregroundStyle(Color.arcCream)
            Text(result.why)
                .font(.arcSans(12.5))
                .foregroundStyle(Color.arcMutedOnDark)
                .lineSpacing(3)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Mv3.cardFill, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .padding(.bottom, 12)
    }

    private var degradedPlaceholder: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Learning your normal.")
                .font(.arcSerif(23))
                .foregroundStyle(Color.arcCream)
            Text("Wear the watch to sleep and your morning readiness appears here.")
                .font(.arcSans(12.5))
                .foregroundStyle(Color.arcMutedOnDark)
                .lineSpacing(3)
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Mv3.cardFill, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .padding(.bottom, 12)
    }

    private func stateTitle(_ state: ReadinessState) -> String {
        switch state {
        case .calibrating(let day, let of): return "Calibrating · day \(day) of \(of)"
        case .sparseNight: return "No overnight read."
        case .ok, .sick: return "Readiness"
        }
    }

    private func stateCaption(_ state: ReadinessState) -> String {
        switch state {
        case .calibrating: return "LEARNING"
        case .sparseNight: return "NO READ"
        default: return "READINESS"
        }
    }

    // MARK: Check-in CTA

    private var checkinCTA: some View {
        NavigationLink {
            CheckinV3View()
        } label: {
            Text("How do you feel? · 10-second check-in")
                .font(.arcSans(13.5, weight: .semibold))
                .foregroundStyle(Color.arcDarkSurface)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 13)
                .background(Color.arcCream, in: Capsule())
        }
        .buttonStyle(.plain)
        .frame(minHeight: 44)
    }
}

#if DEBUG
#Preview("Readiness") {
    MemberV3ScreenPreview { NavigationStack { ReadinessV3View() } }
}
#endif
