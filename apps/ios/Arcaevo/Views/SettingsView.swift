import SwiftUI

/// Membership, Apple Health connection, data export/delete (links out to the
/// self-serve web flows), disclaimer footer.
struct SettingsView: View {
    @Environment(AppModel.self) private var model
    @AppStorage("hasOnboarded") private var hasOnboarded = true

    // Self-serve GDPR flows live on the web app (see design handoff:
    // "export/delete self-serve"). Local dev URL; production would be
    // https://arcaevo.co.
    private let webBase = URL(string: "http://localhost:3000")!

    var body: some View {
        List {
            membershipSection
            healthSection
            dataSection
            aboutSection

            Section {
                EmptyView()
            } footer: {
                DisclaimerFooter()
            }
        }
        .scrollContentBackground(.hidden)
        .background(Color.bone.ignoresSafeArea())
        .navigationTitle("Settings")
        .toolbarTitleDisplayMode(.large)
    }

    // MARK: - Membership

    private var membershipSection: some View {
        Section("Membership") {
            if let user = model.user {
                LabeledContent("Member", value: user.name)
                LabeledContent("Plan") {
                    HStack(spacing: 8) {
                        Text(user.membership.tier.displayName)
                            .fontWeight(.semibold)
                        Text(user.membership.tier.priceLine)
                            .font(.system(size: 12, design: .monospaced))
                            .foregroundStyle(Color.caption)
                    }
                }
                LabeledContent("Billing", value: user.membership.term == .annual ? "Annual" : "—")
                LabeledContent("Cadence", value: user.membership.cadence == .quarterly ? "Quarterly" : "Standard")
                LabeledContent("Renews") {
                    Text(user.membership.renewsAt, style: .date)
                }
            } else {
                Text("Loading membership…")
                    .foregroundStyle(Color.caption)
            }
            if model.isDemoMode {
                HStack {
                    DemoModeBadge()
                    Spacer()
                }
            }
        }
    }

    // MARK: - Apple Health

    private var healthSection: some View {
        Section {
            HStack {
                Label("Apple Health", systemImage: "heart.fill")
                Spacer()
                Text(healthStatusText)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(model.healthAuthorized || model.isUsingMockHealthData ? Color.vitality : Color.amber)
            }
            if !model.healthAuthorized {
                Button("Connect Apple Health") {
                    Task { await model.requestHealthAccess() }
                }
            }
        } header: {
            Text("Connections")
        } footer: {
            Text("v1 syncs Apple Watch + Apple Health only. WHOOP, Oura and Garmin are on the roadmap.")
        }
    }

    private var healthStatusText: String {
        if model.healthAuthorized { return "Connected" }
        if model.isUsingMockHealthData { return "Demo data" }
        return "Not connected"
    }

    // MARK: - Your data

    private var dataSection: some View {
        Section {
            Link(destination: webBase.appendingPathComponent("legal/privacy")) {
                Label("Privacy notice", systemImage: "lock")
            }
            Link(destination: webBase.appendingPathComponent("help")) {
                Label("Export my data", systemImage: "square.and.arrow.up")
            }
            Link(destination: webBase.appendingPathComponent("legal/data-deletion")) {
                Label("Delete my data", systemImage: "trash")
            }
        } header: {
            Text("Your data")
        } footer: {
            Text("EU-hosted, never sold. Export or delete everything, self-serve, whenever you like.")
        }
    }

    // MARK: - About / debug

    private var aboutSection: some View {
        Section("About") {
            LabeledContent("Version", value: appVersion)
            LabeledContent("API") {
                Text(APIClient.defaultBaseURL.absoluteString)
                    .font(.system(size: 11, design: .monospaced))
                    .foregroundStyle(Color.caption)
            }
            Button("Replay onboarding", role: .destructive) {
                hasOnboarded = false
            }
        }
    }

    private var appVersion: String {
        let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "—"
        return version
    }
}
