import SwiftUI

/// MEMBER APP · experiments home ("Experiments" in Prototype.dc.html).
/// One active experiment (adherence read from the Watch — demo data), past
/// verdicts, data-suggested next experiments, and the start flow.
struct ExperimentsV3View: View {
    @Environment(AppState.self) private var appState
    @Environment(AppModel.self) private var model
    @State private var pickedSuggestion: String?
    @State private var recheckOrdering = false
    @State private var recheckOrdered = false

    init() {}

    var body: some View {
        NavigationStack {
            ZStack {
                Color.arcDarkSurface.ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: 0) {
                        Mv3Eyebrow(text: "EXPERIMENTS")
                            .padding(.bottom, 6)
                        Text("One change at a time.")
                            .font(.arcSerif(26))
                            .foregroundStyle(Color.arcCream)
                            .padding(.bottom, 16)

                        activeCard
                            .padding(.bottom, 10)

                        completedRows
                            .padding(.bottom, 16)

                        recheckCard
                            .padding(.bottom, 16)

                        Mv3Eyebrow(text: "START NEXT · SUGGESTED BY YOUR DATA", size: 9, kerning: 0.9)
                            .padding(.bottom, 9)

                        ForEach(MemberV3Demo.experimentSuggestions, id: \.name) { suggestion in
                            suggestionRow(suggestion.name, why: suggestion.why)
                                .padding(.bottom, 9)
                        }

                        NavigationLink {
                            StartExperimentV3View()
                        } label: {
                            Text("Start something else ›")
                                .font(.arcSans(13, weight: .semibold))
                                .foregroundStyle(Color.arcCream)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 12)
                                .overlay(Capsule().strokeBorder(Color.white.opacity(0.2), lineWidth: 1))
                                .contentShape(Capsule())
                        }
                        .buttonStyle(.plain)
                        .padding(.top, 6)

                        Text("One active experiment at a time — otherwise nothing is learnable.")
                            .font(.arcSans(11.5))
                            .foregroundStyle(Color.arcRailDim)
                            .frame(maxWidth: .infinity)
                            .multilineTextAlignment(.center)
                            .padding(.top, 12)
                    }
                    .padding(.horizontal, 24)
                    .padding(.top, 14)
                    .padding(.bottom, 20)
                }
            }
            .toolbar(.hidden, for: .navigationBar)
        }
        .sensoryFeedback(.selection, trigger: pickedSuggestion)
    }

    // MARK: Active experiment — adherence read from the Watch (demo data)

    private var activeCard: some View {
        let (since, adherence, title, sub) = activeDetails
        return VStack(alignment: .leading, spacing: 0) {
            HStack {
                Mv3Eyebrow(text: "ACTIVE · SINCE \(since)", size: 9, color: .arcBrightGreen, kerning: 0.9)
                Spacer()
                Text("\(adherence)%")
                    .font(.arcMono(11, weight: .regular))
                    .foregroundStyle(Color.arcBrightGreen)
            }
            .padding(.bottom, 7)
            Text(title)
                .font(.arcSans(14.5, weight: .bold))
                .foregroundStyle(Color.arcCream)
                .padding(.bottom, 6)
            Capsule()
                .fill(Color.white.opacity(0.1))
                .frame(height: 6)
                .overlay(alignment: .leading) {
                    GeometryReader { geo in
                        Capsule()
                            .fill(Color.arcPrimaryGreen)
                            .frame(width: geo.size.width * CGFloat(adherence) / 100)
                    }
                }
                .padding(.bottom, 8)
            Text(sub)
                .font(.arcSans(11.5))
                .lineSpacing(3)
                .foregroundStyle(Color.arcMutedOnDark)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 15)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.arcPrimaryGreen.opacity(0.1), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .strokeBorder(Color.arcPrimaryGreen.opacity(0.35), lineWidth: 1)
        )
    }

    private var activeDetails: (since: String, adherence: Int, title: String, sub: String) {
        if let exp = appState.experiment, exp.verdict == nil {
            let formatter = DateFormatter()
            formatter.locale = Locale(identifier: "en_IE")
            formatter.dateFormat = "d MMM"
            return (
                formatter.string(from: exp.startedAt).uppercased(),
                Mv3Adherence.percent(for: exp),
                "\(exp.what) — \(exp.duration), watching \(exp.watchedMarker)",
                "Adherence read from your Watch — no logging. Verdict lands when the \(exp.duration) are up."
            )
        }
        // Demo story (design verbatim): the evening-walks experiment.
        return (
            "12 MAY", 87,
            "Evening walks — 30 min, 5×/week",
            "Adherence read from your Watch — no logging. Verdict lands with your January recheck."
        )
    }

    // MARK: Close the loop — the €69 recheck (the ONLY sell, never a supplement)

    private var recheckCard: some View {
        Button {
            Task { await placeRecheck() }
        } label: {
            VStack(alignment: .leading, spacing: 0) {
                HStack {
                    Mv3Eyebrow(
                        text: recheckOrdered ? "CLOSE THE LOOP · ORDERED" : "CLOSE THE LOOP · JANUARY",
                        size: 9, color: Color.arcHollowGold, kerning: 0.9
                    )
                    Spacer()
                    Text(recheckOrdered ? "✓ KIT ON ITS WAY" : "€69 KIT")
                        .font(.arcMono(10, weight: .regular))
                        .foregroundStyle(Color.arcHollowGold)
                }
                .padding(.bottom, 5)
                Text(recheckOrdered
                     ? "Ordered — we'll ship the ferritin recheck near January. The verdict is the point, not the kit. Never a supplement."
                     : "Recheck ferritin when the iron experiment ends — the verdict is the point, not the kit. Never a supplement.")
                    .font(.arcSans(12))
                    .lineSpacing(3)
                    .foregroundStyle(Mv3.bodyOnDark)
            }
            .padding(.horizontal, 15)
            .padding(.vertical, 13)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.arcHollowGold.opacity(0.08),
                        in: RoundedRectangle(cornerRadius: 15, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 15, style: .continuous)
                    .strokeBorder(Color.arcHollowGold.opacity(0.35),
                                  style: StrokeStyle(lineWidth: 1, dash: [4, 3]))
            )
            .contentShape(RoundedRectangle(cornerRadius: 15))
            .opacity(recheckOrdering ? 0.6 : 1)
        }
        .buttonStyle(.plain)
        .disabled(recheckOrdering || recheckOrdered)
        .sensoryFeedback(.success, trigger: recheckOrdered)
        .accessibilityElement(children: .combine)
        .accessibilityHint(recheckOrdered ? "Recheck kit ordered" : "Double-tap to order the €69 ferritin recheck kit")
    }

    private func placeRecheck() async {
        recheckOrdering = true
        await model.orderRecheck(RecheckOrder(markerId: "ferritin"), markerName: "Ferritin")
        recheckOrdering = false
        recheckOrdered = true
    }

    // MARK: Completed → verdicts

    @ViewBuilder
    private var completedRows: some View {
        // Design verbatim: the caffeine experiment that worked.
        NavigationLink {
            VerdictV3View()
        } label: {
            completedRow(
                eyebrow: "COMPLETED · FEB–JUN",
                title: "Cut caffeine after 14:00",
                chip: "IT WORKED ›",
                chipColor: .arcBrightGreen,
                chipFill: Color.arcPrimaryGreen.opacity(0.14)
            )
        }
        .buttonStyle(.plain)

        // A user experiment concluded via AppState also lands here.
        if let exp = appState.experiment, let verdict = exp.verdict {
            NavigationLink {
                VerdictV3View(model: .from(exp))
            } label: {
                completedRow(
                    eyebrow: "COMPLETED · \(exp.duration.uppercased())",
                    title: exp.what,
                    chip: verdictChipText(verdict),
                    chipColor: verdictChipColor(verdict),
                    chipFill: verdictChipColor(verdict).opacity(0.14)
                )
            }
            .buttonStyle(.plain)
            .padding(.top, 9)
        }
    }

    private func completedRow(eyebrow: String, title: String, chip: String, chipColor: Color, chipFill: Color) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 5) {
                Mv3Eyebrow(text: eyebrow, size: 9, kerning: 0.9)
                Text(title)
                    .font(.arcSans(13.5, weight: .bold))
                    .foregroundStyle(Color.arcCream)
            }
            Spacer()
            Text(chip)
                .font(.arcMono(10, weight: .regular))
                .foregroundStyle(chipColor)
                .padding(.vertical, 6)
                .padding(.horizontal, 12)
                .background(chipFill, in: Capsule())
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 15)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Mv3.cardFill, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .contentShape(RoundedRectangle(cornerRadius: 16))
    }

    private func verdictChipText(_ verdict: RCVVerdict) -> String {
        switch verdict {
        case .improved: return "IT WORKED ›"
        case .noRealChange: return "WITHIN NOISE ›"
        case .worsened: return "WRONG WAY ›"
        }
    }

    private func verdictChipColor(_ verdict: RCVVerdict) -> Color {
        switch verdict {
        case .improved: return .arcBrightGreen
        case .noRealChange: return .arcMutedOnDark
        case .worsened: return Mv3.watchAmber // amber, never red
        }
    }

    // MARK: Suggestions ("PICK" → "✓ QUEUED")

    private func suggestionRow(_ name: String, why: String) -> some View {
        let picked = pickedSuggestion == name
        return Button {
            pickedSuggestion = name
        } label: {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(name)
                        .font(.arcSans(13, weight: .semibold))
                        .foregroundStyle(Color.arcCream)
                    Text(why)
                        .font(.arcSans(11))
                        .foregroundStyle(Color.arcMutedOnDark)
                }
                Spacer()
                Text(picked ? "✓ QUEUED" : "PICK")
                    .font(.arcMono(10, weight: .regular))
                    .foregroundStyle(picked ? Color.arcBrightGreen : Color.arcRailDim)
            }
            .padding(.horizontal, 15)
            .padding(.vertical, 13)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Mv3.cardFill, in: RoundedRectangle(cornerRadius: 15, style: .continuous))
            .overlay {
                if picked {
                    RoundedRectangle(cornerRadius: 15, style: .continuous)
                        .strokeBorder(Color.arcPrimaryGreen.opacity(0.5), lineWidth: 1)
                }
            }
            .contentShape(RoundedRectangle(cornerRadius: 15))
        }
        .buttonStyle(.plain)
    }
}
