import SwiftUI

/// ONBOARDING 1/7 — Welcome (light).
/// Prototype: brand mark 34px, serif 40px headline, 15.5px sub,
/// green pill "Create account" + ghost "Sign in" (both → signup).
struct WelcomeV3View: View {
    @Environment(AppState.self) private var appState

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Brand identity mark (real logo — the cream chip + green "A"),
            // sized to match the former 34px orb so layout is unchanged.
            Image("BrandMark")
                .resizable()
                .scaledToFit()
                .frame(width: 34, height: 34)
                .padding(.top, 26)

            Spacer()

            Text("Know what's actually happening inside your body.")
                .font(.arcSerif(40))
                .kerning(40 * -0.015)
                .lineSpacing(40 * 0.05)
                .foregroundStyle(Color.ink)
                .padding(.bottom, 16)

            Text("Bloods and your Watch, read together — with the one or two changes worth making.")
                .font(.arcSans(15.5))
                .lineSpacing(15.5 * 0.35)
                .foregroundStyle(Color.arcSecondaryDark)
                .padding(.bottom, 30)

            ArcPillButton(title: "Create account") {
                appState.phase = .onboarding(.signup)
            }
            .padding(.bottom, 11)

            ArcGhostPill(title: "Sign in") {
                // Email + magic link only — sign-in and sign-up share the flow.
                appState.phase = .onboarding(.signup)
            }
        }
        .padding(EdgeInsets(top: 26, leading: 28, bottom: 30, trailing: 28))
    }
}
