import SwiftUI

/// ONBOARDING 3/7 — Check your inbox (light, centered).
/// Magic-link wait state. The real link opens the app (universal link /
/// arcaevo:// scheme → AppState.handleIncomingURL). PREFETCH-SAFE FALLBACK
/// (Phase 21): if a security appliance ate the universal link, the human
/// types the 6-char CODE from the same email — a real Release affordance
/// (a scanner never fills in and submits a code field).
struct VerifyV3View: View {
    @Environment(AppState.self) private var appState
    @State private var code = ""

    /// The unambiguous code alphabet (mirrors the web's CODE_ALPHABET).
    private static let alphabet = Set("ABCDEFGHJKLMNPQRSTUVWXYZ23456789")

    /// Uppercase, keep only alphabet chars, group as XXX-XXX (max 6).
    static func formatCode(_ raw: String) -> String {
        let cleaned = String(raw.uppercased().filter { alphabet.contains($0) }.prefix(6))
        guard cleaned.count > 3 else { return cleaned }
        let idx = cleaned.index(cleaned.startIndex, offsetBy: 3)
        return "\(cleaned[..<idx])-\(cleaned[idx...])"
    }

    private var normalizedCodeCount: Int {
        code.filter { Self.alphabet.contains($0) }.count
    }

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

                // Prefetch-safe fallback: type the code from the email. Works
                // in Release — the way in when the link gets scanned/blocked.
                VStack(alignment: .leading, spacing: 8) {
                    ArcEyebrow(text: "Link blocked? Enter your code", color: .arcSecondaryLight)
                    TextField("XXX-XXX", text: $code)
                        .font(.arcMono(16))
                        .foregroundStyle(Color.ink)
                        .multilineTextAlignment(.center)
                        .textInputAutocapitalization(.characters)
                        .autocorrectionDisabled()
                        .onChange(of: code) { _, newValue in
                            let formatted = Self.formatCode(newValue)
                            if formatted != code { code = formatted }
                        }
                        .padding(12)
                        .background(.white, in: RoundedRectangle(cornerRadius: 12))
                        .overlay(
                            RoundedRectangle(cornerRadius: 12)
                                .stroke(Color.arcDarkSurface.opacity(0.16), lineWidth: 1)
                        )
                    ArcPillButton(
                        title: "Sign in with code",
                        disabled: normalizedCodeCount != 6 || appState.authBusy,
                        fontSize: 14,
                        verticalPadding: 13
                    ) {
                        Task { await appState.verifyMagicLinkCode(code: code) }
                    }
                    Text("Useful if your email security blocks the link.")
                        .font(.arcSans(11.5))
                        .foregroundStyle(Color.arcSecondaryLight)
                }
                .padding(.top, 22)
            }
            .padding(EdgeInsets(top: 26, leading: 32, bottom: 40, trailing: 32))
            .frame(maxWidth: .infinity)
        }
        .scrollBounceBehavior(.basedOnSize)
    }
}
