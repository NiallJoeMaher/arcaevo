import SwiftUI

/// ACCOUNT · hub — `data-screen-label="Account"`. Wired by the shell as the
/// Account tab (owns its NavigationStack, like the placeholder it replaces).
/// Dark plan card + rows to security / privacy / connections / invite /
/// notifications, plus the wellness disclaimer footer.

enum AccountV3Route: Hashable {
    case security
    case privacy
    case connections
    case invite
    case notifications
    case deleteAccount
    case gpShare
}

struct AccountV3View: View {
    @Environment(AppState.self) private var appState
    @Environment(AppModel.self) private var model
    @State private var user: User?
    #if DEBUG
    @State private var demoMode = DemoMode.isEnabled
    #endif

    var body: some View {
        NavigationStack {
            DataV3Screen(topPadding: 16) {
                Text("ACCOUNT")
                    .font(.arcMono(10, weight: .medium))
                    .kerning(1.2)
                    .foregroundStyle(Color.arcDeepGreen)
                    .padding(.bottom, 12)

                Text(displayUser.name)
                    .font(.arcSerif(27))
                    .foregroundStyle(Color.ink)
                    .padding(.bottom, 2)

                Text(displayUser.email)
                    .font(.arcSans(13))
                    .foregroundStyle(Color.arcSecondaryLight)
                    .padding(.bottom, 18)

                planCard
                    .padding(.bottom, 14)

                navRow("Sign-in & security", route: .security)
                navRow("Data & privacy", route: .privacy)
                navRow("Connected sources", route: .connections)
                navRow("Invite someone — give a month", route: .invite)
                navRow("Notifications", route: .notifications)
                staticRow("Help & support")

                #if DEBUG
                demoModeRow
                    .padding(.top, 8)
                #endif

                Text(Brand.disclaimer)
                    .font(.arcSans(11))
                    .foregroundStyle(Color.arcSecondaryLight)
                    .frame(maxWidth: .infinity)
                    .multilineTextAlignment(.center)
                    .padding(.top, 22)
            }
            .navigationDestination(for: AccountV3Route.self) { route in
                switch route {
                case .security: SecurityV3View()
                case .privacy: PrivacyV3View()
                case .connections: ConnectedSourcesV3View()
                case .invite: InviteV3View(user: user)
                case .notifications: NotificationPrefsV3View()
                case .deleteAccount: DeleteAccountV3View()
                case .gpShare: GPShareV3View()
                }
            }
        }
        .task { await load() }
    }

    // MARK: Plan card (dark, per design)

    private var tier: Membership.Tier {
        appState.plan ?? displayUser.membership.tier
    }

    /// Annual test allowance per tier (Essential 2 · Performance 4).
    private var testsLine: String? {
        switch tier {
        case .fusion: return nil
        case .essential: return "1 of 2 tests used"
        case .performance: return "1 of 4 tests used"
        }
    }

    private var planCard: some View {
        VStack(alignment: .leading, spacing: 3) {
            HStack(alignment: .firstTextBaseline) {
                Text("\(tier.displayName) · \(tier.priceLine)")
                    .font(.arcSans(14.5, weight: .bold))
                    .foregroundStyle(Color.arcCream)
                Spacer()
                Text("ACTIVE")
                    .font(.arcMono(9.5, weight: .medium))
                    .kerning(0.8)
                    .foregroundStyle(Color.arcBrightGreen)
            }
            Text(planSubline)
                .font(.arcSans(12))
                .foregroundStyle(ArcDataPalette.planSub)
        }
        .padding(.vertical, 16)
        .padding(.horizontal, 18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.arcDarkSurface, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    private var planSubline: String {
        let renews = "Renews \(DataV3Format.longDate(displayUser.membership.renewsAt))"
        let billing = "billing on arcaevo.com"
        if let testsLine { return "\(renews) · \(testsLine) · \(billing)" }
        return "\(renews) · \(billing)"
    }

    // MARK: Demo toggle (DEBUG only — opt-in seeded offline experience)

    #if DEBUG
    /// Flipping this sets the runtime `DemoMode` flag and re-resolves app
    /// state: OFF drops any demo session to the real onboarding/unauthenticated
    /// state; ON restores the seeded demo flow. Never compiled into Release.
    private var demoModeRow: some View {
        Toggle(isOn: Binding(
            get: { demoMode },
            set: { newValue in
                demoMode = newValue
                appState.setDemoMode(newValue)
                Task { await model.loadAll() }
            }
        )) {
            VStack(alignment: .leading, spacing: 2) {
                Text("Demo mode")
                    .font(.arcSans(14, weight: .semibold))
                    .foregroundStyle(Color.ink)
                Text("DEBUG only · seeded offline data (default off)")
                    .font(.arcSans(11))
                    .foregroundStyle(Color.arcSecondaryLight)
            }
        }
        .tint(Color.arcPrimaryGreen)
        .padding(.vertical, 8)
        .padding(.horizontal, 16)
        .frame(minHeight: 44)
        .dataV3Card(radius: 14, border: Color.arcDarkSurface.opacity(0.1))
    }
    #endif

    // MARK: Rows

    private func navRow(_ title: String, route: AccountV3Route) -> some View {
        NavigationLink(value: route) {
            rowLabel(title)
        }
        .buttonStyle(.plain)
        .padding(.bottom, 9)
    }

    /// Help & support has no destination in the prototype — kept honest as a
    /// static row until support ships.
    private func staticRow(_ title: String) -> some View {
        rowLabel(title)
    }

    private func rowLabel(_ title: String) -> some View {
        HStack {
            Text(title)
                .font(.arcSans(14, weight: .semibold))
                .foregroundStyle(Color.ink)
            Spacer()
            Text("›")
                .font(.arcSans(14))
                .foregroundStyle(Color.arcSecondaryLight)
        }
        .padding(.vertical, 15)
        .padding(.horizontal, 16)
        .frame(minHeight: 44)
        .dataV3Card(radius: 14, border: Color.arcDarkSurface.opacity(0.1))
        .contentShape(RoundedRectangle(cornerRadius: 14))
    }

    // MARK: Data

    private var displayUser: User {
        user ?? (DemoMode.isEnabled ? DemoDataProvider.user() : .anonymous)
    }

    private func load() async {
        let me = try? await appState.api.me()
        user = me ?? (DemoMode.isEnabled ? DemoDataProvider.user() : .anonymous)
    }
}

#if DEBUG
#Preview("Account hub") {
    AccountV3View()
        .environment(AppState())
        .environment(AppModel())
}

/// Preview harness — every ACCOUNT screen reachable before shell wiring.
struct AccountV3PreviewHarness: View {
    var body: some View {
        NavigationStack {
            List {
                NavigationLink("Account hub") { AccountV3View() }
                NavigationLink("Sign-in & security") { SecurityV3View() }
                NavigationLink("Data & privacy") { PrivacyV3View() }
                NavigationLink("Delete account") { DeleteAccountV3View() }
                NavigationLink("Invite someone") { InviteV3View(user: nil) }
                NavigationLink("Connected sources") { ConnectedSourcesV3View() }
                NavigationLink("Notifications") { NotificationPrefsV3View() }
            }
            .navigationTitle("ACCOUNT v3")
        }
        .environment(AppState())
        .environment(AppModel())
    }
}

#Preview("ACCOUNT harness") {
    AccountV3PreviewHarness()
}
#endif
