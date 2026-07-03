import SwiftUI
import SafariServices

// MARK: - v3 navigation shell (Phase 16 — journey screens)
//
// Owns: shared v3 chrome, onboarding step routing (Views/OnboardingV3/),
// the free-tier → purchase → testing NavigationStack (Views/FreeTierV3/,
// Views/PurchaseV3/, Views/TestingV3/) and the member tab shell.
// Member tab content (Views/MemberV3/ etc.) belongs to other agents —
// the placeholders below stay until their screens land.

// MARK: Prototype colors not in Theme.swift (scoped to the journey screens)

extension Color {
    /// Gate-fail tone ("Cork — not in the service area yet").
    static let arcGateFail = Color(hex: 0xB3543A)
    /// Near-black text on bright-green badges (MOST POPULAR).
    static let arcBadgeInk = Color(hex: 0x04130D)
}

// MARK: Shared chrome

/// Pill CTA per the prototype (border-radius 100px, weight 600).
struct ArcPillButton: View {
    var title: String
    var disabled = false
    var onDark = false
    var fontSize: CGFloat = 15
    var verticalPadding: CGFloat = 16
    var fill: Color? = nil
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.arcSans(fontSize, weight: .semibold))
                .frame(maxWidth: .infinity)
                .padding(.vertical, verticalPadding)
                .background(fill ?? (onDark ? Color.arcCream : Color.arcDeepGreen))
                .foregroundStyle(onDark && fill == nil ? Color.arcDarkSurface : Color.white)
                .clipShape(Capsule())
                .opacity(disabled ? 0.45 : 1)
        }
        .disabled(disabled)
        .buttonStyle(.plain)
    }
}

/// Bordered secondary pill (1px ink-alpha border, no fill).
struct ArcGhostPill: View {
    var title: String
    var fontSize: CGFloat = 15
    var verticalPadding: CGFloat = 15
    var textColor = Color.arcDarkSurface
    var borderColor = Color.arcDarkSurface.opacity(0.22)
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.arcSans(fontSize, weight: .semibold))
                .foregroundStyle(textColor)
                .frame(maxWidth: .infinity)
                .padding(.vertical, verticalPadding)
                .overlay(Capsule().stroke(borderColor, lineWidth: 1))
                .contentShape(Capsule())
        }
        .buttonStyle(.plain)
    }
}

/// "‹ Back" link — 14px, #7C887F, ≥44pt hit target.
struct ArcBackLink: View {
    var title = "Back"
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            Text("‹ \(title)")
                .font(.arcSans(14))
                .foregroundStyle(Color.arcSecondaryLight)
                .frame(minHeight: 44, alignment: .leading)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// The identity mark — radial-gradient orb.
struct ArcOrb: View {
    var size: CGFloat = 34
    var haloWidth: CGFloat = 0

    var body: some View {
        Circle()
            .fill(RadialGradient(
                colors: [Color(hex: 0x5FB592), .arcDeepGreen],
                center: .init(x: 0.32, y: 0.30),
                startRadius: 0,
                endRadius: size * 0.7
            ))
            .frame(width: size, height: size)
            .background(
                haloWidth > 0
                    ? Circle().fill(Color.arcDeepGreen.opacity(0.08))
                        .frame(width: size + haloWidth * 2, height: size + haloWidth * 2)
                    : nil
            )
    }
}

/// Geist Mono uppercase eyebrow label.
struct ArcEyebrow: View {
    var text: String
    var onDark = false
    var size: CGFloat = 10
    var color: Color? = nil

    var body: some View {
        Text(text.uppercased())
            .font(.arcMono(size, weight: .medium))
            .kerning(size * 0.11)
            .foregroundStyle(color ?? (onDark ? Color.arcMutedOnDark : Color.arcDeepGreen))
    }
}

/// 40×23 toggle with 19px knob, green when on — notifications-screen spec.
struct ArcToggle: View {
    @Binding var isOn: Bool

    var body: some View {
        Button {
            withAnimation(.easeInOut(duration: 0.2)) { isOn.toggle() }
        } label: {
            ZStack(alignment: isOn ? .trailing : .leading) {
                Capsule()
                    .fill(isOn ? Color.arcPrimaryGreen : Color.arcDarkSurface.opacity(0.18))
                    .frame(width: 40, height: 23)
                Circle()
                    .fill(.white)
                    .frame(width: 19, height: 19)
                    .padding(2)
            }
        }
        .buttonStyle(.plain)
        .frame(minWidth: 44, minHeight: 44) // hit target
        .sensoryFeedback(.selection, trigger: isOn)
    }
}

/// In-app browser for the web checkout link-out (payment is NEVER in-app).
struct V3SafariView: UIViewControllerRepresentable {
    let url: URL

    func makeUIViewController(context: Context) -> SFSafariViewController {
        let controller = SFSafariViewController(url: url)
        controller.preferredControlTintColor = UIColor(Color.arcDeepGreen)
        return controller
    }

    func updateUIViewController(_ controller: SFSafariViewController, context: Context) {}
}

// MARK: - Journey routing (free tier → purchase → testing)

/// Prototype flow: plans → (fusion → checkout) | (essential/performance →
/// gate → checkout | waitlist) → success → activate kit | nurse booking →
/// sample journey (→ critical value demo).
enum JourneyRoute: Hashable {
    case plans
    case gate(Membership.Tier)
    case waitlist(Membership.Tier)
    case checkout(Membership.Tier)
    case success(Membership.Tier)
    case activateKit(Membership.Tier)
    case nurseBooking(Membership.Tier)
    case sampleJourney(Membership.Tier)
    case criticalValue(Membership.Tier)
}

/// Navigation path for the journey stack, injected into every journey screen.
@MainActor
@Observable
final class JourneyFlow {
    var path: [JourneyRoute] = []
    /// The eircode typed on the gate — the waitlist join reuses it.
    var lastEircode: String = ""

    func push(_ route: JourneyRoute) { path.append(route) }
    func pop() { if !path.isEmpty { path.removeLast() } }
}

// MARK: - Onboarding flow (welcome → … → notifications)

struct OnboardingFlowView: View {
    @Environment(AppState.self) private var appState

    var body: some View {
        ZStack {
            Color.bone.ignoresSafeArea()
            if case .onboarding(let step) = appState.phase {
                Group {
                    switch step {
                    case .welcome: WelcomeV3View()
                    case .signup: SignupV3View()
                    case .verify: VerifyV3View()
                    case .consent: ConsentV3View()
                    case .healthkit: HealthKitPrimerV3View()
                    case .aboutYou: AboutYouV3View()
                    case .notifications: NotificationsV3View()
                    }
                }
                .transition(.opacity)
                .id(step)
            }
        }
        .animation(.easeInOut(duration: 0.2), value: appState.phase)
    }
}

// MARK: - Free tier shell (home → plans → purchase → testing)

/// Root of the `.freeTier` phase — one NavigationStack for the whole
/// purchase + testing journey. Named `FreeHomeView` so RootView keeps
/// compiling unchanged.
struct FreeHomeView: View {
    @State private var flow = JourneyFlow()

    var body: some View {
        NavigationStack(path: $flow.path) {
            FreeHomeV3View()
                .navigationBarBackButtonHidden(true)
                .toolbar(.hidden, for: .navigationBar)
                .navigationDestination(for: JourneyRoute.self) { route in
                    Group {
                        switch route {
                        case .plans: PlansV3View()
                        case .gate(let tier): EircodeGateV3View(tier: tier)
                        case .waitlist(let tier): WaitlistV3View(tier: tier)
                        case .checkout(let tier): CheckoutV3View(tier: tier)
                        case .success(let tier): SuccessV3View(tier: tier)
                        case .activateKit(let tier): ActivateKitV3View(tier: tier)
                        case .nurseBooking(let tier): NurseBookingV3View(tier: tier)
                        case .sampleJourney(let tier): SampleJourneyV3View(tier: tier)
                        case .criticalValue(let tier): CriticalValueV3View(tier: tier)
                        }
                    }
                    .navigationBarBackButtonHidden(true)
                    .toolbar(.hidden, for: .navigationBar)
                }
        }
        .environment(flow)
    }
}

// MARK: - Member shell: content + prototype tab bar on #1C2620

struct MemberShellView: View {
    @Environment(AppState.self) private var appState

    var body: some View {
        VStack(spacing: 0) {
            Group {
                // The real Phase 16 member screens (each owns its own
                // NavigationStack — don't double-wrap).
                switch appState.selectedTab {
                case .today:
                    MemberTodayV3View()
                case .results:
                    MemberResultsV3View()
                case .experiments:
                    ExperimentsV3View()
                case .account:
                    AccountV3View()
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

// MARK: - Placeholder tabs (other agents' Phase 16 screens replace these)

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
