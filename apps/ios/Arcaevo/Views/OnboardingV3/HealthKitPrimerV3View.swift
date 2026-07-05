import SwiftUI

/// ONBOARDING 5/7 — Apple Health primer (light).
/// Primer-before-sheet: this screen explains first; tapping "Allow" fires
/// the REAL HKHealthStore authorization request (read-only). In the
/// simulator/denied path the MockHealthStore provider takes over, so the
/// flow always continues with data.
struct HealthKitPrimerV3View: View {
    @Environment(AppState.self) private var appState
    @Environment(AppModel.self) private var model
    @State private var requesting = false

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("Let your Watch do the talking")
                .font(.arcSerif(28))
                .lineSpacing(28 * 0.12)
                .foregroundStyle(Color.ink)
                .padding(.bottom, 10)

            Text("We read sleep and its stages, heart rate, HRV, VO₂max, workouts, active energy, steps, respiratory rate, blood oxygen and wrist temperature — read-only, on your device's terms. Cycle tracking is separate, optional and off by default. No Apple account sign-in needed.")
                .font(.arcSans(13.5))
                .lineSpacing(13.5 * 0.4)
                .foregroundStyle(Color.arcSecondaryDark)
                .padding(.bottom, 16)

            ArcGhostPill(
                title: "Not now — I'll add it later",
                fontSize: 13,
                verticalPadding: 13,
                textColor: .arcSecondaryLight,
                borderColor: Color.arcDarkSurface.opacity(0.2)
            ) {
                appState.advanceOnboarding()
            }

            Spacer()
        }
        .padding(EdgeInsets(top: 16, leading: 26, bottom: 0, trailing: 26))
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .overlay(alignment: .bottom) { permissionCard }
    }

    /// The bottom permission card from the design — the primer's request
    /// surface. "Allow" triggers the real system HealthKit sheet.
    private var permissionCard: some View {
        VStack(spacing: 0) {
            Text("\u{201C}Arcaevo\u{201D} would like to access your Health data")
                .font(.arcSans(14, weight: .bold))
                .foregroundStyle(Color.ink)
                .multilineTextAlignment(.center)
                .padding(.bottom, 5)

            Text("Sleep & stages · Heart · HRV · VO₂max · Workouts · Energy · Steps · Respiratory · SpO₂ · Temperature")
                .font(.arcSans(11.5))
                .foregroundStyle(Color.arcSecondaryLight)
                .multilineTextAlignment(.center)
                .lineSpacing(3)
                .padding(.bottom, 16)

            // "Turn On All" — read-only permission, presented as already on; the
            // system sheet is the real decision surface.
            sheetRow {
                Text("Turn On All")
                    .font(.arcSans(13))
                    .foregroundStyle(Color.ink)
                Spacer()
                DataV3StaticToggle(isOn: true)
            }

            // Cycle Tracking — SEPARATE, off by default. A reassurance that it is
            // NOT granted here; the real ask is the Data & privacy cycle-aware
            // toggle (`requestCycleAccess()`), never this sheet.
            sheetRow {
                HStack(spacing: 4) {
                    Text("Cycle Tracking")
                        .font(.arcSans(13))
                        .foregroundStyle(Color.ink)
                    Text("· optional, off by default")
                        .font(.arcSans(11))
                        .foregroundStyle(Color.arcSecondaryLight)
                }
                Spacer()
                DataV3StaticToggle(isOn: false)
            }

            ArcPillButton(title: "Allow", disabled: requesting, fontSize: 14, verticalPadding: 14) {
                requesting = true
                Task {
                    await model.requestHealthAccess()
                    requesting = false
                    appState.advanceOnboarding()
                }
            }
            .padding(.top, 14)
        }
        .padding(EdgeInsets(top: 22, leading: 20, bottom: 26, trailing: 20))
        .background(
            UnevenRoundedRectangle(topLeadingRadius: 20, topTrailingRadius: 20)
                .fill(.white)
                .shadow(color: Color.arcDarkSurface.opacity(0.2), radius: 20, y: -14)
                .ignoresSafeArea(edges: .bottom)
        )
        .padding(.horizontal, 10)
    }

    /// A row inside the faux system sheet — hairline-topped, ≥44pt tall.
    private func sheetRow<Content: View>(@ViewBuilder _ content: () -> Content) -> some View {
        HStack(content: content)
            .padding(EdgeInsets(top: 11, leading: 6, bottom: 11, trailing: 6))
            .frame(minHeight: 44)
            .overlay(alignment: .top) {
                Rectangle().fill(Color.arcDarkSurface.opacity(0.08)).frame(height: 1)
            }
    }
}
