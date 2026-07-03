import SwiftUI

/// ONBOARDING 3/7 — Check your inbox (light, centered).
/// Magic-link wait state. The real link opens the app (universal link /
/// arcaevo:// scheme → AppState.handleIncomingURL). In DEBUG builds a
/// paste-link/token affordance stays, because local dev "emails" land in
/// the backend's Mongo outbox the app can't read.
struct VerifyV3View: View {
    @Environment(AppState.self) private var appState
    @State private var pastedToken = ""

    private var email: String {
        appState.signupEmail.isEmpty ? "your email" : appState.signupEmail
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                Spacer(minLength: 60)

                Text("✉")
                    .font(.arcSans(26))
                    .foregroundStyle(Color.arcDeepGreen)
                    .frame(width: 64, height: 64)
                    .background(Color.arcPrimaryGreen.opacity(0.14), in: Circle())
                    .padding(.bottom, 22)

                Text("Check your inbox")
                    .font(.arcSerif(29))
                    .lineSpacing(29 * 0.12)
                    .foregroundStyle(Color.ink)
                    .padding(.bottom, 12)

                (Text("We've sent a confirmation link to\n")
                    + Text(email).font(.arcSans(14.5, weight: .bold))
                    + Text(". It's valid for 30 minutes."))
                    .font(.arcSans(14.5))
                    .lineSpacing(14.5 * 0.4)
                    .foregroundStyle(Color.arcSecondaryDark)
                    .multilineTextAlignment(.center)
                    .padding(.bottom, 12)

                if let message = appState.magicLinkMessage {
                    Text(message)
                        .font(.arcSans(12.5))
                        .foregroundStyle(Color.arcSecondaryLight)
                        .multilineTextAlignment(.center)
                        .padding(.bottom, 8)
                }
                if let error = appState.authError {
                    Text(error)
                        .font(.arcSans(12.5, weight: .medium))
                        .foregroundStyle(Color.arcGateFail)
                        .multilineTextAlignment(.center)
                        .padding(.bottom, 8)
                }

                Spacer(minLength: 18)

                ArcGhostPill(
                    title: "Resend email",
                    fontSize: 14,
                    verticalPadding: 14,
                    textColor: .arcSecondaryDark,
                    borderColor: Color.arcDarkSurface.opacity(0.18)
                ) {
                    Task { await appState.requestMagicLink() }
                }

                #if DEBUG
                // DEV ONLY: paste the verify link or raw token from the
                // Mongo outbox to continue. Compiled out of release builds.
                VStack(alignment: .leading, spacing: 8) {
                    ArcEyebrow(text: "Dev · paste link or token", color: .arcSecondaryLight)
                    TextField("https://arcaevo.com/verify?token=…", text: $pastedToken)
                        .font(.arcMono(12))
                        .foregroundStyle(Color.ink)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .padding(12)
                        .background(.white, in: RoundedRectangle(cornerRadius: 12))
                        .overlay(
                            RoundedRectangle(cornerRadius: 12)
                                .stroke(Color.arcDarkSurface.opacity(0.16), lineWidth: 1)
                        )
                    ArcPillButton(
                        title: "Verify token",
                        disabled: pastedToken.isEmpty || appState.authBusy,
                        fontSize: 14,
                        verticalPadding: 13
                    ) {
                        Task { await appState.verifyMagicLink(token: Self.extractToken(from: pastedToken)) }
                    }
                }
                .padding(.top, 22)
                #endif
            }
            .padding(EdgeInsets(top: 26, leading: 32, bottom: 40, trailing: 32))
            .frame(maxWidth: .infinity)
        }
        .scrollBounceBehavior(.basedOnSize)
    }

    /// Accepts a full verify URL or a bare token.
    static func extractToken(from input: String) -> String {
        let trimmed = input.trimmingCharacters(in: .whitespacesAndNewlines)
        if let comps = URLComponents(string: trimmed),
           let token = comps.queryItems?.first(where: { $0.name == "token" })?.value {
            return token
        }
        return trimmed
    }
}
