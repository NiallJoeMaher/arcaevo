import SwiftUI

/// TESTING — Sample journey (dark #1C2620).
/// Timeline: activated → posted → at lab → clinician review → results —
/// stage derived from the member's latest TestOrder status (demo order
/// offline). Results are never emailed; the exit continues to the app.
struct SampleJourneyV3View: View {
    let tier: Membership.Tier

    @Environment(AppState.self) private var appState
    @Environment(AppModel.self) private var model
    @Environment(JourneyFlow.self) private var flow

    private struct Stage {
        let title: String
        let sub: String
    }

    private static let stages: [Stage] = [
        .init(title: "Kit activated", sub: "Mon 6 July, 08:12"),
        .init(title: "Sample posted", sub: "Mon 6 July, 11:40 · An Post tracked"),
        .init(title: "At the lab", sub: "Received Tue 7 July · processing 24–48h"),
        .init(title: "Clinician review", sub: "Every panel signed off by a doctor"),
        .init(title: "Results ready", sub: "Push + email — never values in the email"),
    ]

    /// Index of the current (in-progress) stage, mapped from TestOrder
    /// status. nil = everything done (results ready).
    private var currentStage: Int? {
        guard let order = model.currentOrder else { return 2 } // design default
        switch order.status {
        case .ordered, .shipped, .delivered: return 1 // activated ✓, posting next
        case .sampleRegistered, .inLab: return 2      // at the lab
        case .resultsReady: return nil                 // all steps complete
        }
    }

    private var monthEyebrow: String {
        let f = DateFormatter()
        f.dateFormat = "MMMM"
        let month = f.string(from: model.currentOrder?.orderedAt ?? .now)
        return "Your \(month) sample"
    }

    var body: some View {
        ZStack {
            Color.arcDarkSurface.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    ArcEyebrow(text: monthEyebrow, onDark: true, size: 10)
                        .padding(.bottom, 6)

                    Text("On its way to becoming answers.")
                        .font(.arcSerif(25))
                        .lineSpacing(25 * 0.15)
                        .foregroundStyle(Color.arcCream)
                        .padding(.bottom, 24)

                    ForEach(Array(Self.stages.enumerated()), id: \.offset) { index, stage in
                        stageRow(stage, index: index)
                    }

                    (Text("Something wrong? ").foregroundStyle(Color.arcMutedOnDark)
                        + Text("Message us about this sample")
                            .font(.arcSans(12, weight: .semibold))
                            .foregroundStyle(Color.arcBrightGreen))
                        .font(.arcSans(12))
                        .frame(maxWidth: .infinity)
                        .padding(.top, 4)
                        .padding(.bottom, 14)

                    Spacer(minLength: 20)

                    ArcGhostPill(
                        title: "Continue to your dashboard",
                        fontSize: 13,
                        verticalPadding: 13,
                        textColor: .arcCream,
                        borderColor: .white.opacity(0.25)
                    ) {
                        // The membership is live — enter the member app.
                        appState.activateMembership(tier)
                        appState.selectedTab = .today
                    }

                    #if DEBUG
                    // DEV ONLY: demo trigger for the critical-value flow
                    // (the prototype reaches it from the rail).
                    Button {
                        flow.push(.criticalValue(tier))
                    } label: {
                        Text("DEV · PREVIEW: A VALUE NEEDS A WORD FIRST")
                            .font(.arcMono(9.5, weight: .medium))
                            .kerning(1)
                            .foregroundStyle(Color.arcRailDim)
                            .frame(maxWidth: .infinity, minHeight: 44)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .padding(.top, 6)
                    #endif
                }
                .padding(EdgeInsets(top: 14, leading: 26, bottom: 26, trailing: 26))
            }
        }
    }

    @ViewBuilder
    private func stageRow(_ stage: Stage, index: Int) -> some View {
        let done = currentStage.map { index < $0 } ?? true
        let current = currentStage == index

        HStack(alignment: .top, spacing: 15) {
            ZStack {
                if done {
                    Circle().fill(Color.arcPrimaryGreen)
                    Text("✓")
                        .font(.arcSans(13))
                        .foregroundStyle(Color.arcBadgeInk)
                } else if current {
                    Circle().stroke(Color.arcPrimaryGreen, lineWidth: 2)
                    Text("●")
                        .font(.arcSans(11))
                        .foregroundStyle(Color.arcBrightGreen)
                } else {
                    Circle().stroke(Color.white.opacity(0.3), lineWidth: 2)
                }
            }
            .frame(width: 24, height: 24)

            VStack(alignment: .leading, spacing: 2) {
                Text(stage.title)
                    .font(.arcSans(14.5, weight: .bold))
                    .foregroundStyle(Color.arcCream)
                Text(stage.sub)
                    .font(.arcSans(12))
                    .foregroundStyle(Color.arcMutedOnDark)
            }
            Spacer(minLength: 0)
        }
        .opacity(done || current ? 1 : 0.5)
        .padding(.bottom, index == Self.stages.count - 1 ? 22 : 18)
    }
}
