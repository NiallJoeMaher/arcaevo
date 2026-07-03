import SwiftUI

/// ACCOUNT · "Connected sources" — `data-screen-label="Connected sources"`.
/// Apple Health with the REAL permission state (read-only, primer already
/// shown in onboarding); Oura / WHOOP / Garmin are the designed roadmap rows
/// — v1 never fakes connecting them.
struct ConnectedSourcesV3View: View {
    @Environment(AppModel.self) private var model
    @State private var connecting = false

    var body: some View {
        DataV3Screen {
            DataV3BackLink(label: "Account")

            Text("Connected sources")
                .font(.arcSerif(25))
                .foregroundStyle(Color.ink)
                .padding(.bottom, 6)

            Text("One primary source per metric, so nothing double-counts. Disconnecting keeps your history.")
                .font(.arcSans(12.5))
                .foregroundStyle(Color.arcSecondaryLight)
                .lineSpacing(3)
                .padding(.bottom, 18)

            appleHealthRow
                .padding(.bottom, 9)

            roadmapRow(name: "Oura", sub: "Sleep & readiness via Oura API")
                .padding(.bottom, 9)
            roadmapRow(name: "WHOOP", sub: "Strain & recovery via WHOOP API")
                .padding(.bottom, 9)
            roadmapRow(name: "Garmin", sub: "Training load via Garmin Connect")

            Text("These connections also unlock Android —\nno HealthKit required.")
                .font(.arcSans(11.5))
                .foregroundStyle(Color.arcSecondaryLight)
                .multilineTextAlignment(.center)
                .lineSpacing(4)
                .frame(maxWidth: .infinity)
                .padding(.top, 24)
        }
    }

    // MARK: Apple Health — real permission state

    private var appleHealthRow: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text("Apple Health")
                    .font(.arcSans(13.5, weight: .bold))
                    .foregroundStyle(Color.ink)
                Text(model.healthAuthorized
                        ? "Watch · syncing since July 2026"
                        : "Read-only · HRV, resting heart rate, sleep, VO₂ max")
                    .font(.arcSans(11.5))
                    .foregroundStyle(Color.arcSecondaryLight)
            }
            Spacer()
            if model.healthAuthorized {
                Text("CONNECTED")
                    .font(.arcMono(9.5, weight: .medium))
                    .kerning(0.8)
                    .foregroundStyle(Color.arcDeepGreen)
            } else {
                Button {
                    connect()
                } label: {
                    HStack(spacing: 6) {
                        if connecting { ProgressView() }
                        Text("Connect")
                            .font(.arcSans(12, weight: .semibold))
                            .foregroundStyle(Color.ink)
                    }
                    .padding(.vertical, 8)
                    .padding(.horizontal, 15)
                    .overlay(Capsule().strokeBorder(Color.arcDarkSurface))
                    .contentShape(Capsule())
                }
                .buttonStyle(.plain)
                .disabled(connecting)
            }
        }
        .padding(.vertical, 15)
        .padding(.horizontal, 16)
        .frame(minHeight: 44)
        .dataV3Card(
            radius: 15,
            border: model.healthAuthorized ? ArcDataPalette.greenBorder : Color.arcDarkSurface.opacity(0.1)
        )
    }

    /// Fires the REAL HealthKit request (mock store in the simulator). The
    /// primer-before-sheet lives in onboarding; from Account this is an
    /// explicit member action on an explained permission.
    private func connect() {
        guard !connecting else { return }
        connecting = true
        Task {
            await model.requestHealthAccess()
            connecting = false
        }
    }

    // MARK: Roadmap rows — designed, never faked

    private func roadmapRow(name: String, sub: String) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(name)
                    .font(.arcSans(13.5, weight: .bold))
                    .foregroundStyle(Color.ink)
                Text(sub)
                    .font(.arcSans(11.5))
                    .foregroundStyle(Color.arcSecondaryLight)
            }
            Spacer()
            Text("ON THE ROADMAP")
                .font(.arcMono(9.5, weight: .medium))
                .kerning(0.8)
                .foregroundStyle(Color.arcSecondaryLight)
        }
        .padding(.vertical, 15)
        .padding(.horizontal, 16)
        .frame(minHeight: 44)
        .dataV3Card(radius: 15, border: Color.arcDarkSurface.opacity(0.1))
    }
}

#if DEBUG
#Preview("Connected sources") {
    NavigationStack { ConnectedSourcesV3View() }
        .environment(AppState())
        .environment(AppModel())
}
#endif
