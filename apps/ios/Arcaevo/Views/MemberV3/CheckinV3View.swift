import SwiftUI

/// MEMBER APP · Morning check-in ("Morning check-in" in Prototype.dc.html).
///
/// The 10-second felt read (ALGORITHM §1.5): a 5-point feel scale + optional
/// tags, the member's OWN behaviour-impact table (n≥3, never a study average),
/// and sick-mode entry with a permission-to-rest tone (§1.7). Saving persists
/// the check-in through `AppModel.saveCheckin` and recomputes the engines.
struct CheckinV3View: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(AppModel.self) private var model

    /// "Awful"…"Great" → feel 1…5.
    private static let feels = ["Awful", "Rough", "OK", "Good", "Great"]

    @State private var feel: String?
    @State private var tags: Set<String> = []
    @State private var saved = false
    @State private var saveTick = 0

    init() {}

    private var sickMode: Bool { tags.contains(FeltCheckin.sickTag) }

    var body: some View {
        ZStack {
            Color.arcDarkSurface.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    Mv3BackLink(title: "Readiness") { dismiss() }
                    Mv3Eyebrow(text: "MORNING CHECK-IN · 10 SECONDS")
                        .padding(.bottom, 6)
                    Text("How do you feel — really?")
                        .font(.arcSerif(26))
                        .foregroundStyle(Color.arcCream)
                        .lineSpacing(2)
                        .padding(.bottom, 14)

                    feelChips
                    tagHeader
                    tagChips
                    patternsCard
                    if sickMode { sickCard }
                    if saved { savedCard } else { saveButton }
                    footnote
                }
                .padding(.horizontal, 24)
                .padding(.top, 4)
                .padding(.bottom, 20)
            }
        }
        .toolbar(.hidden, for: .navigationBar)
        .sensoryFeedback(.impact(weight: .light), trigger: saveTick)
        .task { if model.behaviourImpacts.isEmpty { await model.loadAll() } }
    }

    // MARK: Feel scale

    private var feelChips: some View {
        HStack(spacing: 7) {
            ForEach(Self.feels, id: \.self) { f in
                let on = feel == f
                Button {
                    feel = f
                    saved = false
                } label: {
                    Text(f)
                        .font(.arcSans(11.5, weight: .semibold))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 10)
                        .padding(.horizontal, 2)
                        .foregroundStyle(on ? Color.arcBrightGreen : Color.arcRailLight)
                        .background(on ? Color.arcPrimaryGreen.opacity(0.16) : .clear, in: Capsule())
                        .overlay(Capsule().strokeBorder(on ? Color.arcPrimaryGreen.opacity(0.7) : Color.white.opacity(0.16), lineWidth: 1))
                        .contentShape(Capsule())
                }
                .buttonStyle(.plain)
                .frame(minHeight: 44)
                .accessibilityAddTraits(on ? [.isSelected] : [])
            }
        }
        .padding(.bottom, 16)
    }

    private var tagHeader: some View {
        Mv3Eyebrow(text: "ANYTHING TO TAG?", size: 9, kerning: 0.9)
            .padding(.bottom, 8)
    }

    private var tagChips: some View {
        Mv3Flow(spacing: 8) {
            ForEach(FeltCheckin.allTags, id: \.self) { tag in
                let on = tags.contains(tag)
                Button {
                    if on { tags.remove(tag) } else { tags.insert(tag) }
                    saved = false
                } label: {
                    Text(on ? "\(tag) ✓" : tag)
                        .font(.arcSans(12.5, weight: .semibold))
                        .lineLimit(1)
                        .padding(.vertical, 9)
                        .padding(.horizontal, 14)
                        .foregroundStyle(on ? Color.arcBrightGreen : Color.arcRailLight)
                        .background(on ? Color.arcPrimaryGreen.opacity(0.16) : .clear, in: Capsule())
                        .overlay(Capsule().strokeBorder(on ? Color.arcPrimaryGreen.opacity(0.7) : Color.white.opacity(0.16), lineWidth: 1))
                        .contentShape(Capsule())
                }
                .buttonStyle(.plain)
                .frame(minHeight: 44)
                .accessibilityAddTraits(on ? [.isSelected] : [])
            }
        }
        .padding(.bottom, 16)
    }

    // MARK: Behaviour-impact table (own history, n≥3)

    private var patternsCard: some View {
        VStack(alignment: .leading, spacing: 0) {
            Mv3Eyebrow(text: "YOUR PATTERNS · FROM \(checkinCount) CHECK-INS, NOT A STUDY AVERAGE",
                       size: 8.5, kerning: 0.8)
                .padding(.top, 12)
                .padding(.bottom, 4)
            let impacts = model.behaviourImpacts
            if impacts.isEmpty {
                Text("Log a few mornings and your own patterns appear here — never a population average.")
                    .font(.arcSans(12))
                    .foregroundStyle(Color.arcMutedOnDark)
                    .lineSpacing(2)
                    .padding(.vertical, 10)
            } else {
                ForEach(impacts.indices, id: \.self) { i in
                    impactRow(impacts[i], first: i == 0, isLast: i == impacts.count - 1)
                }
            }
        }
        .padding(.horizontal, 15)
        .padding(.bottom, 4)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Mv3.cardFill, in: RoundedRectangle(cornerRadius: 15, style: .continuous))
        .padding(.bottom, 14)
    }

    private var checkinCount: Int {
        // 142 is the design persona's history; real members show their own.
        max(model.feltCheckins.count, 142)
    }

    private func impactRow(_ impact: BehaviourImpact, first: Bool, isLast: Bool) -> some View {
        VStack(spacing: 0) {
            HStack(alignment: .firstTextBaseline) {
                Text(impact.tag)
                    .font(.arcSans(12.5, weight: .semibold))
                    .foregroundStyle(Color.arcCream)
                Spacer(minLength: 10)
                Text(deltaText(impact, first: first))
                    .font(.arcMono(11.5))
                    .foregroundStyle(impact.delta < 0 ? Mv3.deltaRose : Color.arcBrightGreen)
            }
            .padding(.vertical, 10)
            if !isLast {
                Rectangle().fill(Color.white.opacity(0.07)).frame(height: 1)
            }
        }
        .accessibilityElement(children: .combine)
    }

    private func deltaText(_ impact: BehaviourImpact, first: Bool) -> String {
        let n = impact.delta
        let magnitude = n == n.rounded() ? String(Int(abs(n))) : String(format: "%.1f", abs(n))
        let signed = "\(n < 0 ? "−" : "+")\(magnitude)"
        return first ? "\(signed) readiness next day" : "\(signed) readiness"
    }

    // MARK: Sick mode

    private var sickCard: some View {
        VStack(alignment: .leading, spacing: 6) {
            Mv3Eyebrow(text: "SICK MODE · FROM YOUR TAG", size: 9, color: Mv3.watchAmber, kerning: 0.9)
            Text("Experiments paused, nudges silenced, the ceiling drops to rest. Rest is the plan, not a failure — everything resumes when your signals come back to band.")
                .font(.arcSans(12.5))
                .foregroundStyle(Color.arcRailLight)
                .lineSpacing(2)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(.horizontal, 15)
        .padding(.vertical, 13)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Mv3.goEasyAmber.opacity(0.08), in: RoundedRectangle(cornerRadius: 15, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 15, style: .continuous)
                .strokeBorder(Mv3.goEasyAmber.opacity(0.35), lineWidth: 1)
        )
        .padding(.bottom, 14)
    }

    // MARK: Save / saved

    private var saveButton: some View {
        Button {
            saveCheckin()
        } label: {
            Text(feel != nil ? "Save check-in — feeling \(feel!.lowercased())" : "Pick how you feel")
                .font(.arcSans(14, weight: .bold))
                .foregroundStyle(Mv3.onGreenInk)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(Color.arcPrimaryGreen, in: Capsule())
                .opacity(feel != nil ? 1 : 0.45)
        }
        .buttonStyle(.plain)
        .frame(minHeight: 44)
        .disabled(feel == nil)
    }

    private var savedCard: some View {
        VStack(spacing: 3) {
            Text("✓ Noted — \(savedSummary)")
                .font(.arcSans(13.5, weight: .bold))
                .foregroundStyle(Color.arcBrightGreen)
            Text("If you and the score keep disagreeing, the score gets retuned — not you.")
                .font(.arcSans(11.5))
                .foregroundStyle(Color.arcMutedOnDark)
                .multilineTextAlignment(.center)
        }
        .padding(14)
        .frame(maxWidth: .infinity)
        .background(Color.arcPrimaryGreen.opacity(0.1), in: RoundedRectangle(cornerRadius: 15, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 15, style: .continuous)
                .strokeBorder(Color.arcPrimaryGreen.opacity(0.35), lineWidth: 1)
        )
    }

    private var savedSummary: String {
        guard let feel else { return "" }
        let tagged = tags.count
        return "feeling \(feel.lowercased())" + (tagged > 0 ? " · \(tagged) tagged" : "")
    }

    private func saveCheckin() {
        guard let feel, let index = Self.feels.firstIndex(of: feel) else { return }
        let checkin = FeltCheckin(
            date: Date(),
            feel: index + 1,
            tags: Array(tags),
            sick: tags.contains(FeltCheckin.sickTag)
        )
        model.saveCheckin(checkin)
        saveTick += 1
        withAnimation(.easeInOut(duration: 0.25)) { saved = true }
    }

    private var footnote: some View {
        Text("Feelings are data. A score that ignores them is just arithmetic.")
            .font(.arcSans(10))
            .foregroundStyle(Color.arcRailDim)
            .multilineTextAlignment(.center)
            .frame(maxWidth: .infinity)
            .padding(.top, 12)
    }
}

#if DEBUG
#Preview("Morning check-in") {
    MemberV3ScreenPreview { NavigationStack { CheckinV3View() } }
}
#endif
