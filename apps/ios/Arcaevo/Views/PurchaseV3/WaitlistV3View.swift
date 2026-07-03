import SwiftUI

/// PURCHASE — Early access / waitlist (light).
/// The refusal sells: join → county queue position + founding-member note,
/// plus the Fusion cross-sell (works anywhere). POST /waitlist offline-safe.
struct WaitlistV3View: View {
    let tier: Membership.Tier

    @Environment(AppState.self) private var appState
    @Environment(JourneyFlow.self) private var flow
    @State private var joining = false

    private var county: String {
        if case .fail(_, let county) = appState.eircodeGate, let county { return county }
        return appState.waitlistCounty ?? "Cork"
    }

    var body: some View {
        ZStack {
            Color.bone.ignoresSafeArea()
            VStack(alignment: .leading, spacing: 0) {
                ArcBackLink { flow.pop() }
                    .padding(.bottom, 2)

                Text("Not in \(county) yet — but you're next.")
                    .font(.arcSerif(27))
                    .lineSpacing(27 * 0.12)
                    .foregroundStyle(Color.ink)
                    .padding(.bottom, 10)

                Text("We're starting in Dublin so every kit, courier and nurse visit is flawless before we widen the map. Join the early-access list and we'll open your area in order of demand — first booking and founding-member pricing included.")
                    .font(.arcSans(13.5))
                    .lineSpacing(13.5 * 0.4)
                    .foregroundStyle(Color.arcSecondaryDark)
                    .padding(.bottom, 22)

                if let position = appState.waitlistPosition {
                    VStack(spacing: 3) {
                        Text("✓ You're № \(position) for \(appState.waitlistCounty ?? county)")
                            .font(.arcSans(14, weight: .bold))
                            .foregroundStyle(Color.arcDeepGreen)
                        Text("Confirmation sent · monthly updates · 30-day founding window when \(appState.waitlistCounty ?? county) opens")
                            .font(.arcSans(12))
                            .foregroundStyle(Color.arcSecondaryDark)
                            .multilineTextAlignment(.center)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(16)
                    .background(Color.arcPrimaryGreen.opacity(0.1), in: RoundedRectangle(cornerRadius: 14))
                    .overlay(
                        RoundedRectangle(cornerRadius: 14)
                            .stroke(Color.arcPrimaryGreen.opacity(0.35), lineWidth: 1)
                    )
                    .padding(.bottom, 11)
                } else {
                    ArcPillButton(
                        title: joining ? "Joining…" : "Join the early-access list",
                        disabled: joining,
                        fontSize: 14.5,
                        verticalPadding: 15
                    ) {
                        joining = true
                        Task {
                            await appState.joinWaitlist(eircode: flow.lastEircode)
                            joining = false
                        }
                    }
                    .padding(.bottom, 11)
                }

                // Fusion cross-sell — never a dead end.
                ArcGhostPill(title: "Start with Fusion instead — €119/yr", fontSize: 14, verticalPadding: 14) {
                    flow.push(.checkout(.fusion))
                }

                Text("Fusion works anywhere: your watch + any past bloodwork.")
                    .font(.arcSans(11.5))
                    .foregroundStyle(Color.arcSecondaryLight)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: .infinity)
                    .padding(.top, 14)

                Spacer()
            }
            .padding(EdgeInsets(top: 14, leading: 26, bottom: 28, trailing: 26))
        }
        .sensoryFeedback(.success, trigger: appState.waitlistPosition)
    }
}
