import SwiftUI

/// ONBOARDING 2/7 — Create account (light).
/// Email + optional password (per design: "optional — we can email a link"),
/// terms checkbox, CTA sends the magic link (auth is magic-link only).
struct SignupV3View: View {
    @Environment(AppState.self) private var appState
    @Environment(\.openURL) private var openURL
    @State private var password = ""
    @State private var agreed = true
    @FocusState private var emailFocused: Bool

    private var emailValid: Bool {
        appState.signupEmail.contains("@") && appState.signupEmail.contains(".")
    }

    var body: some View {
        @Bindable var appState = appState
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                ArcBackLink { appState.phase = .onboarding(.welcome) }
                    .padding(.bottom, 10)

                Text("Create your account")
                    .font(.arcSerif(31))
                    .lineSpacing(31 * 0.1)
                    .foregroundStyle(Color.ink)
                    .padding(.bottom, 6)

                Text("Free. No card, no commitment — Dublin or not.")
                    .font(.arcSans(13.5))
                    .foregroundStyle(Color.arcSecondaryLight)
                    .padding(.bottom, 26)

                Text("Email")
                    .font(.arcSans(13, weight: .semibold))
                    .foregroundStyle(Color.ink)
                    .padding(.bottom, 7)

                TextField("aoife@example.ie", text: $appState.signupEmail)
                    .font(.arcSans(14.5))
                    .foregroundStyle(Color.ink)
                    .textContentType(.emailAddress)
                    .keyboardType(.emailAddress)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .focused($emailFocused)
                    .padding(EdgeInsets(top: 14, leading: 16, bottom: 14, trailing: 16))
                    .background(.white, in: RoundedRectangle(cornerRadius: 12))
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(
                                emailFocused || emailValid
                                    ? Color.arcPrimaryGreen
                                    : Color.arcDarkSurface.opacity(0.16),
                                lineWidth: emailFocused || emailValid ? 1.5 : 1
                            )
                    )
                    .padding(.bottom, 16)

                (Text("Password ").font(.arcSans(13, weight: .semibold)).foregroundStyle(Color.ink)
                    + Text("· optional — we can email a link").font(.arcSans(13)).foregroundStyle(Color.arcSecondaryLight))
                    .padding(.bottom, 7)

                SecureField("••••••••••", text: $password)
                    .font(.arcSans(14.5))
                    .foregroundStyle(Color.ink)
                    .textContentType(.newPassword)
                    .padding(EdgeInsets(top: 14, leading: 16, bottom: 14, trailing: 16))
                    .background(.white, in: RoundedRectangle(cornerRadius: 12))
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(Color.arcDarkSurface.opacity(0.16), lineWidth: 1)
                    )
                    .padding(.bottom, 20)

                // Terms checkbox (18px square, radius 5, deep-green when on).
                Button {
                    agreed.toggle()
                } label: {
                    HStack(alignment: .top, spacing: 11) {
                        ZStack {
                            RoundedRectangle(cornerRadius: 5)
                                .fill(agreed ? Color.arcDeepGreen : .white)
                            if !agreed {
                                RoundedRectangle(cornerRadius: 5)
                                    .stroke(Color.arcDarkSurface.opacity(0.3), lineWidth: 1.5)
                            }
                            if agreed {
                                Text("✓")
                                    .font(.arcSans(11))
                                    .foregroundStyle(.white)
                            }
                        }
                        .frame(width: 18, height: 18)
                        .padding(.top, 1)

                        (Text("I'm over 18 and agree to the ")
                            + Text("Terms").underline()
                            + Text(" and ")
                            + Text("Privacy Policy").underline())
                            .font(.arcSans(13))
                            .lineSpacing(13 * 0.3)
                            .foregroundStyle(Color.arcSecondaryDark)
                            .multilineTextAlignment(.leading)
                    }
                    .contentShape(Rectangle())
                    .frame(minHeight: 44, alignment: .top)
                }
                .buttonStyle(.plain)
                .sensoryFeedback(.selection, trigger: agreed)
                .padding(.bottom, 24)

                ArcPillButton(title: "Create account", disabled: !emailValid || !agreed || appState.authBusy) {
                    // Password is captured for later; the account itself is
                    // created via the emailed magic link (v2 backend contract).
                    Task { await appState.requestMagicLink() }
                }
                .padding(.bottom, 16)

                HStack(spacing: 4) {
                    Text("Already a member?")
                        .font(.arcSans(13.5))
                        .foregroundStyle(Color.arcSecondaryLight)
                    Button {
                        Task { await appState.requestMagicLink() }
                    } label: {
                        Text("Sign in")
                            .font(.arcSans(13.5, weight: .semibold))
                            .foregroundStyle(Color.arcDeepGreen)
                            .frame(minHeight: 44)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .disabled(!emailValid)
                }
                .frame(maxWidth: .infinity)
            }
            .padding(EdgeInsets(top: 14, leading: 28, bottom: 30, trailing: 28))
        }
        .scrollBounceBehavior(.basedOnSize)
    }
}
