import SwiftUI

// MARK: - v3 navigation shell (Phase 15 foundation)
//
// Skeletal but functional screens wired to the AppState machine + APIClient
// v2. The Phase 16 screen wave rebuilds each of these pixel-faithfully to
// Prototype.dc.html — the routing, state and API calls here are final.

// MARK: Shared chrome

/// Pill CTA per the prototype (border-radius 100, 600–700 weight).
struct ArcPillButton: View {
    var title: String
    var disabled = false
    var onDark = false
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.arcSans(14, weight: .semibold))
                .frame(maxWidth: .infinity)
                .padding(.vertical, 13)
                .background(onDark ? Color.arcCream : Color.arcDeepGreen)
                .foregroundStyle(onDark ? Color.arcDarkSurface : Color.arcCream)
                .clipShape(Capsule())
                .opacity(disabled ? 0.45 : 1)
        }
        .disabled(disabled)
        .buttonStyle(.plain)
    }
}

/// Geist Mono uppercase eyebrow label.
struct ArcEyebrow: View {
    var text: String
    var onDark = false

    var body: some View {
        Text(text.uppercased())
            .font(.arcMono(10, weight: .medium))
            .kerning(1.2)
            .foregroundStyle(onDark ? Color.arcMutedOnDark : Color.arcDeepGreen)
    }
}

/// 40×22 toggle with 18px knob, green when on — prototype toggle spec.
struct ArcToggle: View {
    @Binding var isOn: Bool

    var body: some View {
        Button {
            withAnimation(.easeInOut(duration: 0.15)) { isOn.toggle() }
        } label: {
            ZStack(alignment: isOn ? .trailing : .leading) {
                Capsule()
                    .fill(isOn ? Color.arcPrimaryGreen : Color.arcDarkSurface.opacity(0.18))
                    .frame(width: 40, height: 22)
                Circle()
                    .fill(.white)
                    .frame(width: 18, height: 18)
                    .padding(2)
            }
        }
        .buttonStyle(.plain)
        .frame(minWidth: 44, minHeight: 44) // hit target
    }
}

// MARK: - Onboarding flow (welcome → … → notifications)

struct OnboardingFlowView: View {
    @Environment(AppState.self) private var appState
    @Environment(AppModel.self) private var model

    var body: some View {
        ZStack {
            Color.bone.ignoresSafeArea()
            if case .onboarding(let step) = appState.phase {
                Group {
                    switch step {
                    case .welcome: welcome
                    case .signup: SignupStepView()
                    case .verify: VerifyStepView()
                    case .consent: ConsentStepView()
                    case .healthkit: healthKitPrimer
                    case .aboutYou: aboutYou
                    case .notifications: NotificationsStepView()
                    }
                }
                .padding(28)
                .transition(.opacity)
            }
        }
    }

    private var welcome: some View {
        VStack(alignment: .leading, spacing: 16) {
            Circle()
                .fill(RadialGradient(
                    colors: [Color(hex: 0x5FB592), .arcDeepGreen],
                    center: .init(x: 0.32, y: 0.30),
                    startRadius: 0, endRadius: 24
                ))
                .frame(width: 34, height: 34)
            Spacer()
            ArcEyebrow(text: "Arcaevo")
            Text("Your baseline,\nnot a population average.")
                .font(.arcSerif(34))
                .foregroundStyle(Color.ink)
                .lineSpacing(2)
            Text("Blood tests and your Apple Watch, fused into one plain-language story. Wellness, never diagnosis.")
                .font(.arcSans(14))
                .foregroundStyle(Color.arcSecondaryDark)
            Spacer()
            ArcPillButton(title: "Get started") { appState.advanceOnboarding() }
        }
    }

    private var healthKitPrimer: some View {
        // Primer-before-sheet: explain first, THEN show the system sheet.
        VStack(alignment: .leading, spacing: 16) {
            Spacer()
            ArcEyebrow(text: "Apple Health")
            Text("Read-only. Your data stays yours.")
                .font(.arcSerif(30))
                .foregroundStyle(Color.ink)
            Text("Arcaevo reads HRV, resting heart rate, sleep and VO₂ max to build your baseline. We never write to Apple Health, and it's a device permission — separate from your account.")
                .font(.arcSans(14))
                .foregroundStyle(Color.arcSecondaryDark)
            Spacer()
            ArcPillButton(title: "Connect Apple Health") {
                Task {
                    await model.requestHealthAccess()
                    appState.advanceOnboarding()
                }
            }
            Button("Not now") { appState.advanceOnboarding() }
                .font(.arcSans(13, weight: .medium))
                .foregroundStyle(Color.arcSecondaryLight)
                .frame(maxWidth: .infinity)
        }
    }

    private var aboutYou: some View {
        // Placeholder — Phase 16 builds the full about-you screen.
        VStack(alignment: .leading, spacing: 16) {
            Spacer()
            ArcEyebrow(text: "About you")
            Text("A little context makes the baseline smarter.")
                .font(.arcSerif(30))
                .foregroundStyle(Color.ink)
            Text("Age band, training habits and goals — coming in the full screen build.")
                .font(.arcSans(14))
                .foregroundStyle(Color.arcSecondaryDark)
            Spacer()
            ArcPillButton(title: "Continue") { appState.advanceOnboarding() }
        }
    }
}

private struct SignupStepView: View {
    @Environment(AppState.self) private var appState

    var body: some View {
        @Bindable var appState = appState
        VStack(alignment: .leading, spacing: 16) {
            Spacer()
            ArcEyebrow(text: "Create account")
            Text("Email and a magic link.\nNo passwords needed.")
                .font(.arcSerif(30))
                .foregroundStyle(Color.ink)
            TextField("you@example.com", text: $appState.signupEmail)
                .font(.arcSans(15))
                .textContentType(.emailAddress)
                .keyboardType(.emailAddress)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .padding(14)
                .background(.white, in: RoundedRectangle(cornerRadius: 14))
            Spacer()
            ArcPillButton(
                title: "Send my sign-in link",
                disabled: !appState.signupEmail.contains("@")
            ) {
                Task { await appState.requestMagicLink() }
            }
        }
    }
}

private struct VerifyStepView: View {
    @Environment(AppState.self) private var appState
    @State private var pastedToken = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Spacer()
            ArcEyebrow(text: "Check your inbox")
            Text("Tap the link we sent to \(appState.signupEmail.isEmpty ? "your email" : appState.signupEmail).")
                .font(.arcSerif(28))
                .foregroundStyle(Color.ink)
            Text(appState.magicLinkMessage ?? "The link opens this app and signs you in. It's valid for 30 minutes.")
                .font(.arcSans(13.5))
                .foregroundStyle(Color.arcSecondaryDark)
            if let error = appState.authError {
                Text(error)
                    .font(.arcSans(13, weight: .medium))
                    .foregroundStyle(Color.arcAmber)
            }
            Spacer()

            // DEV ONLY: the local backend writes the magic-link email to a
            // Mongo outbox the app can't read — paste the link or raw token
            // here to continue. Removed for production builds via #if DEBUG.
            #if DEBUG
            VStack(alignment: .leading, spacing: 8) {
                ArcEyebrow(text: "Dev · paste link or token")
                TextField("https://arcaevo.com/verify?token=…", text: $pastedToken)
                    .font(.arcMono(12))
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .padding(12)
                    .background(.white, in: RoundedRectangle(cornerRadius: 12))
                ArcPillButton(title: "Verify token", disabled: pastedToken.isEmpty) {
                    let token = extractToken(from: pastedToken)
                    Task { await appState.verifyMagicLink(token: token) }
                }
            }
            #endif

            Button("Resend link") {
                Task { await appState.requestMagicLink() }
            }
            .font(.arcSans(13, weight: .medium))
            .foregroundStyle(Color.arcSecondaryLight)
            .frame(maxWidth: .infinity)
        }
    }

    /// Accepts a full verify URL or a bare token.
    private func extractToken(from input: String) -> String {
        let trimmed = input.trimmingCharacters(in: .whitespacesAndNewlines)
        if let comps = URLComponents(string: trimmed),
           let token = comps.queryItems?.first(where: { $0.name == "token" })?.value {
            return token
        }
        return trimmed
    }
}

private struct ConsentStepView: View {
    @Environment(AppState.self) private var appState

    var body: some View {
        @Bindable var appState = appState
        VStack(alignment: .leading, spacing: 14) {
            ArcEyebrow(text: "Health-data consent")
            Text("Your data. Your say.")
                .font(.arcSerif(30))
                .foregroundStyle(Color.ink)
            Text("GDPR Article 9 — three purposes, versioned, revocable any time in Account.")
                .font(.arcSans(13.5))
                .foregroundStyle(Color.arcSecondaryDark)

            consentRow(
                title: ConsentPurpose.healthProcessing.displayName,
                sub: "Required — it's what the product is.",
                required: true
            )
            consentRow(
                title: ConsentPurpose.clinicianReview.displayName,
                sub: "Required for tests — a clinician signs off results.",
                required: true
            )
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 3) {
                    Text(ConsentPurpose.research.displayName)
                        .font(.arcSans(14, weight: .semibold))
                        .foregroundStyle(Color.ink)
                    Text("Optional — off by default. Anonymised, never sold.")
                        .font(.arcSans(12.5))
                        .foregroundStyle(Color.arcSecondaryLight)
                }
                Spacer()
                ArcToggle(isOn: $appState.researchConsent)
            }
            .padding(14)
            .background(.white, in: RoundedRectangle(cornerRadius: 16))

            Spacer()
            ArcPillButton(title: "Agree and continue") {
                Task { await appState.submitConsents() }
            }
        }
    }

    private func consentRow(title: String, sub: String, required: Bool) -> some View {
        HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: 3) {
                Text(title)
                    .font(.arcSans(14, weight: .semibold))
                    .foregroundStyle(Color.ink)
                Text(sub)
                    .font(.arcSans(12.5))
                    .foregroundStyle(Color.arcSecondaryLight)
            }
            Spacer()
            Text("ON")
                .font(.arcMono(10, weight: .medium))
                .foregroundStyle(Color.arcPrimaryGreen)
                .padding(.top, 4)
        }
        .padding(14)
        .background(.white, in: RoundedRectangle(cornerRadius: 16))
    }
}

private struct NotificationsStepView: View {
    @Environment(AppState.self) private var appState

    var body: some View {
        @Bindable var appState = appState
        VStack(alignment: .leading, spacing: 14) {
            ArcEyebrow(text: "Notifications")
            Text("Only what matters.\nNever streaks.")
                .font(.arcSerif(30))
                .foregroundStyle(Color.ink)
            Text("Results never arrive in a push — you'll be told they're ready, nothing more.")
                .font(.arcSans(13.5))
                .foregroundStyle(Color.arcSecondaryDark)

            prefRow("Results & clinician notes", "The reason the app exists", $appState.notificationPrefs.results)
            prefRow("Test & fasting reminders", "The night before, and the morning of", $appState.notificationPrefs.reminders)
            prefRow("Weekly focus", "One nudge a week, never streaks", $appState.notificationPrefs.weeklyFocus)
            prefRow("Lock app with Face ID", "It's health data — on by default", $appState.notificationPrefs.faceIDLock)

            Spacer()
            ArcPillButton(title: "Finish setup") { appState.completeOnboarding() }
        }
    }

    private func prefRow(_ title: String, _ sub: String, _ binding: Binding<Bool>) -> some View {
        HStack(alignment: .center) {
            VStack(alignment: .leading, spacing: 3) {
                Text(title)
                    .font(.arcSans(14, weight: .semibold))
                    .foregroundStyle(Color.ink)
                Text(sub)
                    .font(.arcSans(12.5))
                    .foregroundStyle(Color.arcSecondaryLight)
            }
            Spacer()
            ArcToggle(isOn: binding)
        }
        .padding(.vertical, 2)
    }
}

// MARK: - Free tier home (placeholder — Phase 16 rebuilds)

struct FreeHomeView: View {
    @Environment(AppState.self) private var appState
    @Environment(\.openURL) private var openURL
    @State private var eircode = ""
    @State private var pendingTier: Membership.Tier?

    var body: some View {
        ZStack {
            Color.arcDarkSurface.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    ArcEyebrow(text: "Free tier", onDark: true)
                    Text("You're in. The full picture needs a plan.")
                        .font(.arcSerif(30))
                        .foregroundStyle(Color.arcCream)

                    ForEach(Membership.Tier.allCases, id: \.self) { tier in
                        planCard(tier)
                    }

                    if case .fail(_, let county) = appState.eircodeGate {
                        waitlistCard(county: county ?? "your county")
                    }

                    Text(Brand.disclaimer)
                        .font(.arcMono(9.5))
                        .foregroundStyle(Color.arcRailDim)
                }
                .padding(24)
            }
        }
    }

    private func planCard(_ tier: Membership.Tier) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(tier.displayName)
                    .font(.arcSans(16, weight: .bold))
                    .foregroundStyle(Color.arcCream)
                Spacer()
                Text(tier.priceLine)
                    .font(.arcMono(11, weight: .medium))
                    .foregroundStyle(Color.arcBrightGreen)
            }

            if tier != .fusion {
                // Eircode gate applies to Essential/Performance only.
                HStack(spacing: 8) {
                    TextField("Eircode (e.g. D08)", text: $eircode)
                        .font(.arcMono(12))
                        .textInputAutocapitalization(.characters)
                        .autocorrectionDisabled()
                        .padding(10)
                        .background(.white.opacity(0.06), in: RoundedRectangle(cornerRadius: 10))
                        .foregroundStyle(Color.arcCream)
                    Button("Check") {
                        Task { await appState.checkEircode(eircode) }
                    }
                    .font(.arcSans(13, weight: .semibold))
                    .foregroundStyle(Color.arcBrightGreen)
                }
                if case .pass(let key, _) = appState.eircodeGate {
                    Text("\(key) — you're in the Dublin service area")
                        .font(.arcSans(12.5))
                        .foregroundStyle(Color.arcBrightGreen)
                }
            }

            ArcPillButton(
                title: "Start \(tier.displayName) on the web",
                disabled: tier != .fusion && !gatePassed,
                onDark: true
            ) {
                // Payments ALWAYS link out to web checkout — no IAP.
                openURL(appState.checkoutURL(for: tier))
                pendingTier = tier
            }

            if pendingTier == tier {
                // DEV/demo affordance until real return-from-web deep link.
                Button("I've finished checkout — activate \(tier.displayName)") {
                    appState.activateMembership(tier)
                }
                .font(.arcSans(12.5, weight: .medium))
                .foregroundStyle(Color.arcMutedOnDark)
                .frame(maxWidth: .infinity)
            }
        }
        .padding(16)
        .background(.white.opacity(0.05), in: RoundedRectangle(cornerRadius: 16))
    }

    private var gatePassed: Bool {
        if case .pass = appState.eircodeGate { return true }
        return false
    }

    private func waitlistCard(county: String) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Not in \(county) yet — but you're next.")
                .font(.arcSans(14, weight: .semibold))
                .foregroundStyle(Color.arcCream)
            if let position = appState.waitlistPosition {
                Text("You're number \(position) in \(appState.waitlistCounty ?? county).")
                    .font(.arcSans(13))
                    .foregroundStyle(Color.arcMutedOnDark)
            } else {
                ArcPillButton(title: "Join the early-access list", onDark: true) {
                    Task { await appState.joinWaitlist(eircode: eircode) }
                }
            }
            Text("Fusion works anywhere: your watch + any past bloodwork.")
                .font(.arcSans(12.5))
                .foregroundStyle(Color.arcHollowGold)
        }
        .padding(16)
        .background(.white.opacity(0.05), in: RoundedRectangle(cornerRadius: 16))
    }
}

// MARK: - Member shell: content + prototype tab bar on #1C2620

struct MemberShellView: View {
    @Environment(AppState.self) private var appState

    var body: some View {
        VStack(spacing: 0) {
            Group {
                switch appState.selectedTab {
                case .today:
                    NavigationStack { TodayView() }
                case .results:
                    NavigationStack { ResultsView() }
                case .experiments:
                    ExperimentsPlaceholderView()
                case .account:
                    AccountPlaceholderView()
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)

            ArcTabBar()
        }
        .background(Color.arcDarkSurface)
    }
}

/// The prototype's member tab bar: #141B17 bar, hairline top border,
/// glyph + 9.5px label, active #7FD3AE (700) / inactive #5E6E64 (500).
struct ArcTabBar: View {
    @Environment(AppState.self) private var appState

    var body: some View {
        HStack(spacing: 0) {
            ForEach(MainTab.allCases, id: \.self) { tab in
                let active = appState.selectedTab == tab
                Button {
                    appState.selectedTab = tab
                } label: {
                    VStack(spacing: 2) {
                        Text(tab.glyph)
                            .font(.arcSans(16))
                        Text(tab.title)
                            .font(.arcSans(9.5, weight: active ? .bold : .medium))
                            .kerning(0.3)
                    }
                    .foregroundStyle(active ? Color.arcBrightGreen : Color.arcRailDim)
                    .frame(maxWidth: .infinity, minHeight: 44) // ≥44px hit target
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.top, 9)
        .padding(.horizontal, 6)
        .padding(.bottom, 4)
        .background(Color.arcTabBarSurface)
        .overlay(alignment: .top) {
            Rectangle().fill(.white.opacity(0.08)).frame(height: 1)
        }
    }
}

// MARK: - Placeholder tabs (rebuilt in Phase 16)

struct ExperimentsPlaceholderView: View {
    @Environment(AppState.self) private var appState

    var body: some View {
        ZStack {
            Color.arcDarkSurface.ignoresSafeArea()
            VStack(alignment: .leading, spacing: 14) {
                ArcEyebrow(text: "Experiments", onDark: true)
                Text("Change one thing.\nWe'll tell you if it worked.")
                    .font(.arcSerif(28))
                    .foregroundStyle(Color.arcCream)

                if let exp = appState.experiment {
                    VStack(alignment: .leading, spacing: 6) {
                        Text(exp.what)
                            .font(.arcSans(14, weight: .bold))
                            .foregroundStyle(Color.arcBrightGreen)
                        Text("\(exp.duration) · watching \(exp.watchedMarker) · \(exp.daysLogged) days logged")
                            .font(.arcMono(10.5))
                            .foregroundStyle(Color.arcMutedOnDark)
                        if let verdict = exp.verdict {
                            Text("Verdict: \(verdict.displayName)")
                                .font(.arcSans(13, weight: .semibold))
                                .foregroundStyle(verdict.tint)
                        } else {
                            Button("Log today ✓") { appState.logExperimentDay() }
                                .font(.arcSans(13, weight: .semibold))
                                .foregroundStyle(Color.arcBrightGreen)
                        }
                    }
                    .padding(16)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(.white.opacity(0.05), in: RoundedRectangle(cornerRadius: 16))
                } else {
                    ArcPillButton(title: "Start — Iron-rich breakfasts, 4 weeks", onDark: true) {
                        appState.startExperiment(
                            what: "Iron-rich breakfasts",
                            duration: "4 weeks",
                            watchedMarker: "Ferritin"
                        )
                    }
                }
                Spacer()
            }
            .padding(24)
        }
    }
}

struct AccountPlaceholderView: View {
    @Environment(AppState.self) private var appState

    var body: some View {
        NavigationStack {
            List {
                Section {
                    if let plan = appState.plan {
                        LabeledContent("Plan", value: "\(plan.displayName) · \(plan.priceLine)")
                    }
                    if appState.isDemoSession {
                        Label("Demo mode — backend unreachable", systemImage: "antenna.radiowaves.left.and.right.slash")
                            .font(.arcSans(13))
                    }
                    if !ArcTypography.allFamiliesLoaded {
                        Label("Bundled fonts failed to load — using system fallback", systemImage: "exclamationmark.triangle")
                            .font(.system(size: 13))
                    }
                }
                Section("More") {
                    NavigationLink("Settings (legacy)") { SettingsView() }
                    NavigationLink("Orders (legacy)") { OrdersView() }
                }
                Section {
                    Button("Sign out", role: .destructive) { appState.signOut() }
                }
            }
            .navigationTitle("Account")
        }
    }
}
