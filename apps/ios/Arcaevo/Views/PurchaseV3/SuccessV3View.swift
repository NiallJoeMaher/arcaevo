import SwiftUI

/// PURCHASE — Success / "You're a member" (light).
/// Plan-aware step-1 card + CTA: fusion → upload (member app) ·
/// essential → activate kit · performance → nurse booking.
/// Membership activation is wired through AppState.activateMembership.
struct SuccessV3View: View {
    let tier: Membership.Tier

    @Environment(AppState.self) private var appState
    @Environment(AppModel.self) private var model
    @Environment(JourneyFlow.self) private var flow

    private var firstName: String? {
        (model.user?.name ?? "").split(separator: " ").first.map(String.init)
    }

    private var receiptEmail: String {
        if !appState.signupEmail.isEmpty { return appState.signupEmail }
        return model.user?.email ?? "aoife@example.ie"
    }

    var body: some View {
        ZStack {
            Color.bone.ignoresSafeArea()
            VStack(alignment: .leading, spacing: 0) {
                Text("✓")
                    .font(.arcSans(26))
                    .foregroundStyle(Color.arcDeepGreen)
                    .frame(width: 60, height: 60)
                    .background(Color.arcPrimaryGreen.opacity(0.14), in: Circle())
                    .padding(.bottom, 20)

                Text(firstName.map { "You're a member, \($0)." } ?? "You're a member.")
                    .font(.arcSerif(30))
                    .lineSpacing(30 * 0.1)
                    .foregroundStyle(Color.ink)
                    .padding(.bottom, 8)

                Text("Receipt sent to \(receiptEmail)")
                    .font(.arcSans(13.5))
                    .foregroundStyle(Color.arcSecondaryLight)
                    .padding(.bottom, 24)

                step(number: "01") {
                    Text(tier.successStep1)
                        .font(.arcSans(14, weight: .bold))
                }
                step(number: "02") {
                    (Text("Your Watch is already flowing").font(.arcSans(14, weight: .bold))
                        + Text(" — baselines start building tonight.").font(.arcSans(14)))
                }
                step(number: "03", bottomPadding: 24) {
                    (Text("Test on a Tue–Thu morning").font(.arcSans(14, weight: .bold))
                        + Text(", fasted, and post the same day.").font(.arcSans(14)))
                }

                Spacer()

                ArcPillButton(title: tier.successCTA, fontSize: 14.5, verticalPadding: 15) {
                    switch tier {
                    case .fusion:
                        // Upload lives in the member app (Your Data screens) —
                        // activate and land on the member shell.
                        appState.activateMembership(.fusion)
                        appState.selectedTab = .today
                    case .essential:
                        flow.push(.activateKit(tier))
                    case .performance:
                        flow.push(.nurseBooking(tier))
                    }
                }
            }
            .padding(EdgeInsets(top: 20, leading: 28, bottom: 28, trailing: 28))
        }
        .onAppear {
            // The plan is now paid for — record it so a relaunch resumes as
            // a member-in-setup even before the testing steps finish.
            if appState.plan != tier { appState.plan = tier }
        }
    }

    private func step(
        number: String,
        bottomPadding: CGFloat = 14,
        @ViewBuilder content: () -> Text
    ) -> some View {
        HStack(alignment: .top, spacing: 13) {
            Text(number)
                .font(.arcMono(12))
                .foregroundStyle(Color.arcDeepGreen)
                .frame(width: 22, alignment: .leading)
            content()
                .lineSpacing(14 * 0.3)
                .foregroundStyle(Color.ink)
            Spacer(minLength: 0)
        }
        .padding(.bottom, bottomPadding)
    }
}
