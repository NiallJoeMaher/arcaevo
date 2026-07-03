import SwiftUI

/// ACCOUNT · "Sign-in & security" — `data-screen-label="Security"`.
/// Email magic link is the primary (and only live) sign-in. Passkeys and
/// TOTP are shown as the DESIGNED coming states — never faked as working.
/// Sessions list matches the prototype fixture with a real end-session state.
struct SecurityV3View: View {
    @State private var sessionEnded = false
    @Environment(\.openURL) private var openURL

    var body: some View {
        DataV3Screen {
            DataV3BackLink(label: "Account")

            Text("Sign-in & security")
                .font(.arcSerif(25))
                .foregroundStyle(Color.ink)
                .padding(.bottom, 18)

            magicLinkCard
                .padding(.bottom, 10)

            passkeyCard
                .padding(.bottom, 10)

            passwordRow
                .padding(.bottom, 10)

            twoFactorRow
                .padding(.bottom, 10)

            sessionsCard
        }
    }

    // MARK: Magic link — the primary way in

    private var magicLinkCard: some View {
        HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: 3) {
                Text("Email magic link")
                    .font(.arcSans(13.5, weight: .bold))
                    .foregroundStyle(Color.ink)
                Text("Your primary sign-in. Links open this app and expire after 30 minutes.")
                    .font(.arcSans(11.5))
                    .foregroundStyle(Color.arcSecondaryLight)
                    .lineSpacing(3)
            }
            Spacer()
            Text("PRIMARY")
                .font(.arcMono(9.5, weight: .medium))
                .kerning(0.8)
                .foregroundStyle(Color.arcDeepGreen)
                .padding(.top, 2)
        }
        .padding(.vertical, 15)
        .padding(.horizontal, 16)
        .dataV3Card(radius: 15, border: ArcDataPalette.greenBorder, fill: ArcDataPalette.greenFillSoft)
    }

    // MARK: Passkey — designed coming state (never faked)

    private var passkeyCard: some View {
        VStack(alignment: .leading, spacing: 3) {
            HStack(alignment: .top) {
                Text("Add a passkey — skip passwords entirely")
                    .font(.arcSans(13.5, weight: .bold))
                    .foregroundStyle(Color.ink)
                Spacer()
                Text("COMING")
                    .font(.arcMono(9.5, weight: .medium))
                    .kerning(0.8)
                    .foregroundStyle(Color.arcSecondaryLight)
            }
            Text("Face ID becomes your sign-in. Nothing to remember, nothing to steal.")
                .font(.arcSans(12))
                .foregroundStyle(Color.arcSecondaryDark)
                .lineSpacing(3)
        }
        .padding(.vertical, 15)
        .padding(.horizontal, 16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .dataV3Card(radius: 15, border: ArcDataPalette.greenBorder.opacity(0.85), fill: ArcDataPalette.greenFillSoft)
    }

    // MARK: Password — managed on the web (change = magic-link reset flow)

    private var passwordRow: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text("Password")
                    .font(.arcSans(13.5, weight: .bold))
                    .foregroundStyle(Color.ink)
                Text("Set · last changed March 2026")
                    .font(.arcSans(11.5))
                    .foregroundStyle(Color.arcSecondaryLight)
            }
            Spacer()
            Button {
                // Honest: password changes run the reset flow on the web —
                // the app never handles the secret itself.
                openURL(URL(string: "http://localhost:3000/account/security")!)
            } label: {
                Text("Change")
                    .font(.arcSans(12, weight: .semibold))
                    .foregroundStyle(Color.ink)
                    .padding(.vertical, 7)
                    .padding(.horizontal, 14)
                    .overlay(Capsule().strokeBorder(ArcDataPalette.hairlineStrong))
                    .contentShape(Capsule())
            }
            .buttonStyle(.plain)
        }
        .padding(.vertical, 15)
        .padding(.horizontal, 16)
        .dataV3Card(radius: 15, border: Color.arcDarkSurface.opacity(0.1))
    }

    // MARK: 2FA — designed coming state (never a fake toggle)

    private var twoFactorRow: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text("Two-factor authentication")
                    .font(.arcSans(13.5, weight: .bold))
                    .foregroundStyle(Color.ink)
                Text("Authenticator app (TOTP) · optional")
                    .font(.arcSans(11.5))
                    .foregroundStyle(Color.arcSecondaryLight)
            }
            Spacer()
            Text("COMING")
                .font(.arcMono(9.5, weight: .medium))
                .kerning(0.8)
                .foregroundStyle(Color.arcSecondaryLight)
        }
        .padding(.vertical, 15)
        .padding(.horizontal, 16)
        .dataV3Card(radius: 15, border: Color.arcDarkSurface.opacity(0.1))
    }

    // MARK: Sessions

    private var sessionsCard: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("Where you're signed in")
                .font(.arcSans(13.5, weight: .bold))
                .foregroundStyle(Color.ink)
                .padding(.bottom, 10)

            HStack {
                (Text("iPhone 16 · this app").font(.arcSans(12.5, weight: .bold)).foregroundColor(.ink)
                    + Text(" — Dublin").font(.arcSans(12.5)).foregroundColor(.arcSecondaryLight))
                Spacer()
                Text("NOW")
                    .font(.arcMono(10))
                    .foregroundStyle(Color.arcDeepGreen)
            }
            .padding(.vertical, 7)
            .overlay(alignment: .bottom) {
                Rectangle().fill(Color.arcDarkSurface.opacity(0.06)).frame(height: 1)
            }

            HStack {
                (Text("Safari · MacBook").font(.arcSans(12.5, weight: .bold)).foregroundColor(.ink)
                    + Text(" — 2 days ago").font(.arcSans(12.5)).foregroundColor(.arcSecondaryLight))
                Spacer()
                Button {
                    sessionEnded = true
                } label: {
                    Text(sessionEnded ? "Ended ✓" : "End session")
                        .font(.arcSans(12, weight: .semibold))
                        .foregroundStyle(sessionEnded ? Color.arcSecondaryLight : ArcDataPalette.rust)
                        .padding(.vertical, 10)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .disabled(sessionEnded)
            }
            .padding(.vertical, 2)
        }
        .padding(.vertical, 15)
        .padding(.horizontal, 16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .dataV3Card(radius: 15, border: Color.arcDarkSurface.opacity(0.1))
    }
}

#if DEBUG
#Preview("Sign-in & security") {
    NavigationStack { SecurityV3View() }
        .environment(AppState())
        .environment(AppModel())
}
#endif
