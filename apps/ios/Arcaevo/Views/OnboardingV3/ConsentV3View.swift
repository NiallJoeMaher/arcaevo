import SwiftUI

/// ONBOARDING 4/7 — GDPR Art. 9 consent (light).
/// Three purposes: two required (fixed on), research OPTIONAL and OFF by
/// default. POSTs via AppState.submitConsents (surface: "ios").
struct ConsentV3View: View {
    @Environment(AppState.self) private var appState
    @Environment(\.openURL) private var openURL

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("Your health data, on your terms")
                .font(.arcSerif(28))
                .lineSpacing(28 * 0.12)
                .foregroundStyle(Color.ink)
                .padding(.bottom, 8)

            Text("Before Arcaevo reads a blood result or a night's sleep, we need your explicit permission. Withdraw — and erase — any time.")
                .font(.arcSans(13))
                .lineSpacing(13 * 0.35)
                .foregroundStyle(Color.arcSecondaryLight)
                .padding(.bottom, 20)

            purposeCard(
                tick: .fixedOn,
                title: "Process my health data",
                badge: "REQUIRED",
                badgeColor: .arcDeepGreen,
                body: "Blood results, wearable metrics and my profile — for baselines, insights and verdicts. EU-hosted, never sold."
            )
            .padding(.bottom, 10)

            purposeCard(
                tick: .fixedOn,
                title: "Clinician review",
                badge: "REQUIRED FOR TESTS",
                badgeColor: .arcDeepGreen,
                body: "A registered clinician signs off my results and contacts me if a value is critical."
            )
            .padding(.bottom, 10)

            Button {
                withAnimation(.easeInOut(duration: 0.15)) {
                    appState.researchConsent.toggle()
                }
            } label: {
                purposeCard(
                    tick: appState.researchConsent ? .on : .off,
                    title: "Anonymised research",
                    badge: "OPTIONAL — TAP TO CHANGE",
                    badgeColor: .arcSecondaryLight,
                    body: "De-identified data may improve Arcaevo's rules and ranges. Off by default."
                )
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .sensoryFeedback(.selection, trigger: appState.researchConsent)

            Spacer(minLength: 22)

            ArcPillButton(title: "Agree & continue", fontSize: 14.5, verticalPadding: 15) {
                Task { await appState.submitConsents() }
            }

            Button {
                openURL(appState.api.webBaseURL.appendingPathComponent("legal/privacy"))
            } label: {
                (Text("Full details in our ")
                    + Text("Health Data Notice").underline()
                    + Text(" · GDPR Art. 9(2)(a)"))
                    .font(.arcSans(11))
                    .foregroundStyle(Color.arcSecondaryLight)
                    .frame(maxWidth: .infinity, minHeight: 44)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
        }
        .padding(EdgeInsets(top: 16, leading: 26, bottom: 16, trailing: 26))
    }

    private enum TickState { case fixedOn, on, off }

    private func purposeCard(
        tick: TickState,
        title: String,
        badge: String,
        badgeColor: Color,
        body: String
    ) -> some View {
        HStack(alignment: .top, spacing: 11) {
            ZStack {
                switch tick {
                case .fixedOn, .on:
                    RoundedRectangle(cornerRadius: 5).fill(Color.arcDeepGreen)
                    Text("✓").font(.arcSans(10)).foregroundStyle(.white)
                case .off:
                    RoundedRectangle(cornerRadius: 5).fill(.white)
                    RoundedRectangle(cornerRadius: 5)
                        .stroke(Color.arcDarkSurface.opacity(0.3), lineWidth: 1.5)
                }
            }
            .frame(width: 17, height: 17)
            .padding(.top, 1)

            VStack(alignment: .leading, spacing: 2) {
                HStack(alignment: .firstTextBaseline, spacing: 6) {
                    Text(title)
                        .font(.arcSans(12.5, weight: .bold))
                        .foregroundStyle(Color.ink)
                    Text(badge)
                        .font(.arcMono(8.5, weight: .medium))
                        .kerning(8.5 * 0.08)
                        .foregroundStyle(badgeColor)
                }
                Text(body)
                    .font(.arcSans(12.5))
                    .lineSpacing(12.5 * 0.3)
                    .foregroundStyle(Color.arcSecondaryLight)
            }
            Spacer(minLength: 0)
        }
        .padding(EdgeInsets(top: 14, leading: 16, bottom: 14, trailing: 16))
        .background(.white, in: RoundedRectangle(cornerRadius: 14))
        .overlay(
            RoundedRectangle(cornerRadius: 14)
                .stroke(Color.arcDarkSurface.opacity(0.12), lineWidth: 1)
        )
    }
}
