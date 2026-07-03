import SwiftUI

/// MEMBER APP · start experiment ("Start experiment" in Prototype.dc.html).
/// Pick what / duration / watched marker → start → the experiment lands in
/// AppState (adherence then reads from the Watch; verdict at the end).
struct StartExperimentV3View: View {
    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss

    // Prototype expSel defaults: what = nil, dur = "4 weeks", watch = "Ferritin".
    @State private var what: String?
    @State private var duration = "4 weeks"
    @State private var watchedMarker = "Ferritin"
    @State private var started = false

    init() {}

    var body: some View {
        ZStack {
            Color.arcDarkSurface.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    Mv3BackLink(title: "Experiments") { dismiss() }
                        .padding(.bottom, 4)

                    Mv3Eyebrow(text: "START AN EXPERIMENT")
                        .padding(.bottom, 6)
                    Text("Change one thing. We'll measure it.")
                        .font(.arcSerif(25))
                        .foregroundStyle(Color.arcCream)
                        .lineSpacing(2)
                        .padding(.bottom, 16)

                    Mv3Eyebrow(text: "WHAT WILL YOU CHANGE?", size: 9, kerning: 0.9)
                        .padding(.bottom, 8)
                    Mv3Flow(spacing: 8) {
                        ForEach(MemberV3Demo.experimentWhats, id: \.self) { option in
                            Mv3Chip(
                                label: option,
                                isOn: what == option,
                                font: .arcSans(12.5, weight: .semibold),
                                kerning: 0,
                                hPad: 14, vPad: 9,
                                offText: .arcRailLight
                            ) {
                                what = option
                                started = false
                            }
                        }
                    }
                    .padding(.bottom, 16)

                    Mv3Eyebrow(text: "FOR HOW LONG?", size: 9, kerning: 0.9)
                        .padding(.bottom, 8)
                    HStack(spacing: 8) {
                        ForEach(MemberV3Demo.experimentDurations, id: \.self) { option in
                            durationChip(option)
                        }
                    }
                    .padding(.bottom, 16)

                    Mv3Eyebrow(text: "WATCHING · SUGGESTED FROM YOUR JULY PANEL", size: 9, kerning: 0.9)
                        .padding(.bottom, 8)
                    Mv3Flow(spacing: 8) {
                        ForEach(MemberV3Demo.experimentWatchedMarkers, id: \.self) { option in
                            Mv3Chip(
                                label: option,
                                isOn: watchedMarker == option,
                                font: .arcSans(12),
                                kerning: 0,
                                hPad: 13, vPad: 8,
                                offText: .arcRailLight
                            ) {
                                watchedMarker = option
                                started = false
                            }
                        }
                    }
                    .padding(.bottom, 20)

                    if !started {
                        Mv3GreenCTA(
                            title: what.map { "Start — \($0), \(duration)" } ?? "Pick a change to start",
                            enabled: what != nil
                        ) {
                            guard let what else { return }
                            appState.startExperiment(what: what, duration: duration, watchedMarker: watchedMarker)
                            started = true
                        }
                    } else {
                        VStack(spacing: 3) {
                            Text("✓ Running — \(what ?? "") · \(duration) · watching \(watchedMarker)")
                                .font(.arcSans(13.5, weight: .bold))
                                .foregroundStyle(Color.arcBrightGreen)
                                .multilineTextAlignment(.center)
                            Text("Adherence reads from your Watch where it can. Verdict lands at the end.")
                                .font(.arcSans(11.5))
                                .foregroundStyle(Color.arcMutedOnDark)
                                .multilineTextAlignment(.center)
                        }
                        .padding(15)
                        .frame(maxWidth: .infinity)
                        .background(Color.arcPrimaryGreen.opacity(0.1), in: RoundedRectangle(cornerRadius: 15, style: .continuous))
                        .overlay(
                            RoundedRectangle(cornerRadius: 15, style: .continuous)
                                .strokeBorder(Color.arcPrimaryGreen.opacity(0.35), lineWidth: 1)
                        )
                        .padding(.bottom, 10)

                        Mv3GhostCTA(title: "See it on Experiments", borderOpacity: 0.25) {
                            dismiss()
                        }
                    }

                    Text("One at a time — otherwise nothing is learnable.")
                        .font(.arcSans(10))
                        .foregroundStyle(Color.arcRailDim)
                        .frame(maxWidth: .infinity)
                        .multilineTextAlignment(.center)
                        .padding(.top, 12)
                }
                .padding(.horizontal, 24)
                .padding(.top, 8)
                .padding(.bottom, 20)
            }
        }
        .toolbar(.hidden, for: .navigationBar)
        .sensoryFeedback(.selection, trigger: what)
        .sensoryFeedback(.selection, trigger: duration)
        .sensoryFeedback(.selection, trigger: watchedMarker)
        .sensoryFeedback(.success, trigger: started) { _, isStarted in isStarted }
    }

    /// Duration chips flex to equal widths (prototype flex:1).
    private func durationChip(_ option: String) -> some View {
        let isOn = duration == option
        return Button {
            duration = option
            started = false
        } label: {
            Text(option)
                .font(.arcSans(12.5, weight: .semibold))
                .foregroundStyle(isOn ? Color.arcBrightGreen : Color.arcRailLight)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 10)
                .background(isOn ? Color.arcPrimaryGreen.opacity(0.16) : .clear, in: Capsule())
                .overlay(Capsule().strokeBorder(isOn ? Color.arcPrimaryGreen.opacity(0.7) : Color.white.opacity(0.16), lineWidth: 1))
                .contentShape(Capsule())
        }
        .buttonStyle(.plain)
    }
}
