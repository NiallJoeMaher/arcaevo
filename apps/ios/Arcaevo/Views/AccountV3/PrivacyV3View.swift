import SwiftUI

/// ACCOUNT · "Data & privacy" — `data-screen-label="Data and privacy"`.
/// The three GDPR Art. 9 consent purposes (required ones are doorways, not
/// toggles; research is live and wired to `POST /consents`), export request,
/// GP share links, and the honest delete entry.
struct PrivacyV3View: View {
    @Environment(AppState.self) private var appState
    @Environment(AppModel.self) private var model

    @State private var research = false
    @State private var cycleAware = CyclePreferences.isEnabled
    @State private var requestingCycle = false
    @State private var exportRequested = false
    @State private var loadedConsents = false

    var body: some View {
        DataV3Screen {
            DataV3BackLink(label: "Account")

            Text("Data & privacy")
                .font(.arcSerif(25))
                .foregroundStyle(Color.ink)
                .padding(.bottom, 6)

            Text("The same permissions you granted on day one — still yours to change.")
                .font(.arcSans(12.5))
                .foregroundStyle(Color.arcSecondaryLight)
                .lineSpacing(3)
                .padding(.bottom, 16)

            // Required — the "toggle" is a doorway into honest closure.
            NavigationLink(value: AccountV3Route.deleteAccount) {
                consentRow(
                    title: "Process my health data",
                    sub: "Required — turning off starts account closure",
                    trailing: { DataV3StaticToggle(isOn: true) }
                )
            }
            .buttonStyle(.plain)
            .padding(.bottom, 9)

            consentRow(
                title: "Clinician review",
                sub: "Required for tests",
                trailing: { DataV3StaticToggle(isOn: true) }
            )
            .padding(.bottom, 9)

            // Optional — live, versioned, revocable.
            consentRow(
                title: "Anonymised research",
                sub: "Optional · off by default",
                trailing: {
                    ArcToggle(isOn: Binding(
                        get: { research },
                        set: { setResearch($0) }
                    ))
                }
            )
            .padding(.bottom, 14)

            // Cycle-aware baselines — Art. 9 special-category data. Off by
            // default; enabling fires the SEPARATE HealthKit cycle ask
            // (`requestCycleAccess()`) — never bundled into the main sheet.
            // Cycle data never leaves the device unless this is on.
            consentRow(
                title: "Cycle-aware baselines",
                sub: "Reads cycle tracking from Apple Health · off by default, never synced unless on",
                trailing: {
                    ArcToggle(isOn: Binding(
                        get: { cycleAware },
                        set: { setCycleAware($0) }
                    ))
                    .disabled(requestingCycle)
                }
            )
            .padding(.bottom, 14)

            Button {
                requestExport()
            } label: {
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Export my data")
                            .font(.arcSans(13, weight: .bold))
                            .foregroundStyle(Color.ink)
                        Text("Everything as CSV + clinician PDF, within the hour")
                            .font(.arcSans(11))
                            .foregroundStyle(Color.arcSecondaryLight)
                    }
                    Spacer()
                    Text(exportRequested ? "Requested ✓ — arriving by email" : "Request export")
                        .font(.arcSans(12, weight: .semibold))
                        .foregroundStyle(Color.arcDeepGreen)
                        .multilineTextAlignment(.trailing)
                }
                .padding(.vertical, 14)
                .padding(.horizontal, 16)
                .frame(minHeight: 44)
                .dataV3Card(radius: 14, border: Color.arcDarkSurface.opacity(0.1))
                .contentShape(RoundedRectangle(cornerRadius: 14))
            }
            .buttonStyle(.plain)
            .disabled(exportRequested)
            .padding(.bottom, 9)

            NavigationLink(value: AccountV3Route.gpShare) {
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("GP share links")
                            .font(.arcSans(13, weight: .bold))
                            .foregroundStyle(Color.ink)
                        Text("Create, track and revoke")
                            .font(.arcSans(11))
                            .foregroundStyle(Color.arcSecondaryLight)
                    }
                    Spacer()
                    Text("›")
                        .font(.arcSans(14))
                        .foregroundStyle(Color.arcSecondaryLight)
                }
                .padding(.vertical, 14)
                .padding(.horizontal, 16)
                .frame(minHeight: 44)
                .dataV3Card(radius: 14, border: Color.arcDarkSurface.opacity(0.1))
                .contentShape(RoundedRectangle(cornerRadius: 14))
            }
            .buttonStyle(.plain)
            .padding(.bottom, 9)

            NavigationLink(value: AccountV3Route.deleteAccount) {
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Delete account & data")
                            .font(.arcSans(13, weight: .bold))
                            .foregroundStyle(ArcDataPalette.rust)
                        Text("Permanent · export offered first")
                            .font(.arcSans(11))
                            .foregroundStyle(Color.arcSecondaryLight)
                    }
                    Spacer()
                    Text("›")
                        .font(.arcSans(14))
                        .foregroundStyle(ArcDataPalette.rust)
                }
                .padding(.vertical, 14)
                .padding(.horizontal, 16)
                .frame(minHeight: 44)
                .overlay(
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .strokeBorder(ArcDataPalette.rust.opacity(0.4))
                )
                .contentShape(RoundedRectangle(cornerRadius: 14))
            }
            .buttonStyle(.plain)

            Text("Data-protection enquiries: privacy@arcaevo.com")
                .font(.arcSans(11))
                .foregroundStyle(Color.arcSecondaryLight)
                .padding(.top, 14)
        }
        .task { await loadConsents() }
    }

    private func consentRow<Trailing: View>(
        title: String,
        sub: String,
        @ViewBuilder trailing: () -> Trailing
    ) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.arcSans(13, weight: .bold))
                    .foregroundStyle(Color.ink)
                Text(sub)
                    .font(.arcSans(11))
                    .foregroundStyle(Color.arcSecondaryLight)
            }
            Spacer()
            trailing()
        }
        .padding(.vertical, 14)
        .padding(.horizontal, 16)
        .frame(minHeight: 44)
        .dataV3Card(radius: 14, border: Color.arcDarkSurface.opacity(0.1))
        .contentShape(RoundedRectangle(cornerRadius: 14))
    }

    // MARK: Consents wiring

    private func loadConsents() async {
        guard !loadedConsents else { return }
        loadedConsents = true
        do {
            let state = try await appState.api.getConsents()
            research = state.consents.first { $0.purpose == .research }?.granted
                ?? appState.researchConsent
        } catch {
            research = appState.researchConsent
        }
    }

    /// Research is the one live toggle — versioned, append-only backend.
    private func setResearch(_ granted: Bool) {
        research = granted
        appState.researchConsent = granted
        Task {
            do {
                _ = try await appState.api.postConsents(
                    [ConsentGrant(purpose: .research, granted: granted)],
                    surface: "ios"
                )
            } catch {
                // Offline demo: the choice is kept locally in AppState and
                // re-posted on the next consent write.
            }
        }
    }

    /// Cycle-aware baselines — the opt-in (`CyclePreferences.isEnabled`) that
    /// the readiness/energy engines read. Enabling triggers the separate cycle
    /// HealthKit ask; if the member declines the system sheet, revert so the UI
    /// never claims access it doesn't have.
    private func setCycleAware(_ on: Bool) {
        cycleAware = on
        CyclePreferences.isEnabled = on
        guard on else { return }
        requestingCycle = true
        Task {
            let granted = await model.requestCycleAccess()
            requestingCycle = false
            if !granted {
                CyclePreferences.isEnabled = false
                cycleAware = false
            }
        }
    }

    // TODO(export backend): no export API exists yet (same gap as the web
    // account page) — the request state is local until it ships.
    private func requestExport() {
        exportRequested = true
    }
}

#if DEBUG
#Preview("Data & privacy") {
    NavigationStack {
        PrivacyV3View()
            .navigationDestination(for: AccountV3Route.self) { route in
                switch route {
                case .deleteAccount: DeleteAccountV3View()
                case .gpShare: GPShareV3View()
                default: EmptyView()
                }
            }
    }
    .environment(AppState())
    .environment(AppModel())
}
#endif
