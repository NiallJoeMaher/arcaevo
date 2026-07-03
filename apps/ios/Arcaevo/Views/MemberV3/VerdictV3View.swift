import SwiftUI

/// MEMBER APP · "did it work?" verdict ("Verdict" in Prototype.dc.html).
/// Honest by construction: a REAL change (beyond the marker's test noise)
/// reads "It worked." — anything inside the noise says so plainly, and the
/// card always includes THE HONEST PART: what didn't move. Never a red
/// number, never overclaiming.
struct VerdictV3View: View {
    @Environment(\.dismiss) private var dismiss

    struct Row: Identifiable {
        let measure: String
        let delta: String
        var id: String { measure }
    }

    struct Model {
        var eyebrow: String
        var headline: String
        var headlineColor: Color
        var rows: [Row]
        var honest: String
        var cta: String

        /// The design's completed experiment (copy verbatim).
        static let caffeine = Model(
            eyebrow: "DID IT WORK? · CUT CAFFEINE AFTER 14:00 · FEB–JUN",
            headline: "It worked.",
            headlineColor: .arcBrightGreen,
            rows: [
                Row(measure: "Deep sleep", delta: "+22 min avg"),
                Row(measure: "Time to fall asleep", delta: "−18 min"),
                Row(measure: "Resting heart rate", delta: "−2 bpm"),
            ],
            honest: "CRP didn't move — this one was about sleep, not inflammation. Measured over 14 weeks against your own baseline, not a study average.",
            cta: "Keep the habit — start the next one"
        )

        /// Verdict screen for an experiment concluded via AppState. The RCV
        /// verdict is decided by deterministic rules; this only narrates it.
        static func from(_ exp: ActiveExperiment) -> Model {
            let eyebrow = "DID IT WORK? · \(exp.what.uppercased()) · \(exp.duration.uppercased())"
            switch exp.verdict {
            case .improved:
                return Model(
                    eyebrow: eyebrow,
                    headline: "It worked.",
                    headlineColor: .arcBrightGreen,
                    rows: [Row(measure: exp.watchedMarker, delta: "real change ✓")],
                    honest: "\(exp.watchedMarker) moved further than this marker's test noise (RCV) allows by chance — that counts as a real change against your own baseline, not a study average.",
                    cta: "Keep the habit — start the next one"
                )
            case .worsened:
                return Model(
                    eyebrow: eyebrow,
                    headline: "It moved the wrong way.",
                    headlineColor: Mv3.watchAmber, // amber, never red
                    rows: [Row(measure: exp.watchedMarker, delta: "real change — wrong direction")],
                    honest: "\(exp.watchedMarker) moved beyond test noise, but not the way you wanted. That's still an answer: this lever isn't yours. Nothing here is a diagnosis — your recheck and clinician review carry the weight.",
                    cta: "Start the next one"
                )
            case .noRealChange, nil:
                return Model(
                    eyebrow: eyebrow,
                    headline: "Within the noise.",
                    headlineColor: .arcMutedOnDark,
                    rows: [Row(measure: exp.watchedMarker, delta: "no real change")],
                    honest: "The shift in \(exp.watchedMarker) was smaller than this marker's test noise (RCV), so we won't call it real. That's the honest answer — a longer window or a different lever is the next move.",
                    cta: "Start the next one"
                )
            }
        }
    }

    var model: Model

    init(model: Model = .caffeine) {
        self.model = model
    }

    var body: some View {
        ZStack {
            Color.arcDarkSurface.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    Mv3BackLink(title: "Experiments") { dismiss() }
                        .padding(.bottom, 4)

                    Mv3Eyebrow(text: model.eyebrow)
                        .padding(.bottom, 10)
                    Text(model.headline)
                        .font(.arcSerif(38))
                        .foregroundStyle(model.headlineColor)
                        .padding(.bottom, 14)

                    // What moved, in the member's own units.
                    VStack(spacing: 0) {
                        ForEach(Array(model.rows.enumerated()), id: \.element.id) { index, row in
                            HStack {
                                Text(row.measure)
                                    .font(.arcSans(13, weight: .semibold))
                                    .foregroundStyle(Color.arcCream)
                                Spacer()
                                Text(row.delta)
                                    .font(.arcMono(12.5, weight: .regular))
                                    .foregroundStyle(model.headlineColor)
                            }
                            .padding(.vertical, 11)
                            if index < model.rows.count - 1 {
                                Rectangle()
                                    .fill(Color.white.opacity(0.07))
                                    .frame(height: 1)
                            }
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 4)
                    .background(Mv3.cardFill, in: RoundedRectangle(cornerRadius: 15, style: .continuous))
                    .padding(.bottom, 10)

                    VStack(alignment: .leading, spacing: 6) {
                        Mv3Eyebrow(text: "THE HONEST PART", size: 9, kerning: 0.9)
                        Text(model.honest)
                            .font(.arcSans(12.5))
                            .lineSpacing(4)
                            .foregroundStyle(Mv3.bodyOnDark)
                    }
                    .padding(.horizontal, 15)
                    .padding(.vertical, 13)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Mv3.cardFill, in: RoundedRectangle(cornerRadius: 15, style: .continuous))
                    .padding(.bottom, 14)

                    Mv3CreamCTA(title: model.cta) { dismiss() }
                }
                .padding(.horizontal, 24)
                .padding(.top, 8)
                .padding(.bottom, 20)
            }
        }
        .toolbar(.hidden, for: .navigationBar)
    }
}
