import SwiftUI

/// FREE TIER — Plans (light).
/// Three tier cards, prices verbatim (€119 / €329 / €399, annual only).
/// Fusion → checkout (web link-out). Essential/Performance → Eircode gate
/// ONLY when the server-controlled blood-tier gate is ON; while the lab and
/// clinician partners don't exist (`bloodTiersEnabled == false`) they render
/// as "Coming soon" cards that route to the early-access waitlist instead of
/// checkout — the prices stay visible as roadmap, but the tiers aren't buyable.
struct PlansV3View: View {
    @Environment(JourneyFlow.self) private var flow
    @Environment(AppState.self) private var appState

    /// Server flag (fail-safe false): are the paid blood tiers being offered?
    private var bloodTiersEnabled: Bool { appState.bloodTiersEnabled }

    var body: some View {
        ZStack {
            Color.bone.ignoresSafeArea()
            VStack(alignment: .leading, spacing: 0) {
                ArcBackLink { flow.pop() }
                    .padding(.bottom, 2)

                Text("One membership. Tests included.")
                    .font(.arcSerif(27))
                    .lineSpacing(27 * 0.12)
                    .foregroundStyle(Color.ink)
                    .padding(.bottom, 18)

                // Fusion — ALWAYS available (watch + user-uploaded bloods).
                lightPlanCard(
                    name: "Fusion",
                    price: "€119",
                    sub: "Your watch + any past bloodwork · works anywhere, nothing ships",
                    comingSoon: false
                ) {
                    flow.push(.checkout(.fusion))
                }
                .padding(.bottom, 11)

                essentialCard
                    .padding(.bottom, 11)

                // Performance — blood tier: buyable only when the gate is ON.
                lightPlanCard(
                    name: "Performance",
                    price: "€399",
                    sub: "Venous panel · 80+ markers · nurse comes to you, Dublin",
                    comingSoon: !bloodTiersEnabled
                ) {
                    if bloodTiersEnabled {
                        flow.push(.gate(.performance))
                    } else {
                        flow.push(.waitlist(.performance))
                    }
                }
                .padding(.bottom, 16)

                Spacer()

                Text(footerText)
                    .font(.arcSans(11.5))
                    .lineSpacing(11.5 * 0.4)
                    .foregroundStyle(Color.arcSecondaryLight)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: .infinity)
            }
            .padding(EdgeInsets(top: 14, leading: 26, bottom: 26, trailing: 26))
        }
    }

    /// Footer helper — reflects whether the blood tiers are on sale.
    private var footerText: String {
        bloodTiersEnabled
            ? "Tap a plan — payment happens on arcaevo.com.\nEssential & Performance check your Eircode first."
            : "Fusion is available now — payment happens on arcaevo.com.\nEssential & Performance are coming soon — join the waitlist."
    }

    /// Fusion / Performance — #FBFAF6 card, ink-alpha border, radius 18.
    /// When `comingSoon`, the price stays visible (roadmap) but a "Coming soon"
    /// eyebrow + "Join the waitlist →" affordance replace the buy intent.
    private func lightPlanCard(
        name: String,
        price: String,
        sub: String,
        comingSoon: Bool,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 3) {
                if comingSoon {
                    Text("COMING SOON")
                        .font(.arcMono(8.5, weight: .medium))
                        .kerning(8.5 * 0.09)
                        .foregroundStyle(Color.arcSecondaryLight)
                        .padding(.bottom, 1)
                }
                HStack(alignment: .firstTextBaseline) {
                    Text(name)
                        .font(.arcSans(16, weight: .bold))
                        .foregroundStyle(Color.ink)
                    Spacer()
                    (Text(price).font(.arcSerif(22)).foregroundStyle(Color.ink)
                        + Text("/yr").font(.arcSans(12)).foregroundStyle(Color.arcSecondaryLight))
                }
                Text(sub)
                    .font(.arcSans(12))
                    .foregroundStyle(Color.arcSecondaryLight)
                if comingSoon {
                    Text("Join the waitlist →")
                        .font(.arcSans(12, weight: .semibold))
                        .foregroundStyle(Color.arcDeepGreen)
                        .padding(.top, 4)
                }
            }
            .padding(18)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.surface, in: RoundedRectangle(cornerRadius: 18))
            .overlay(
                RoundedRectangle(cornerRadius: 18)
                    .stroke(Color.arcDarkSurface.opacity(0.12), lineWidth: 1)
            )
            .contentShape(RoundedRectangle(cornerRadius: 18))
        }
        .buttonStyle(.plain)
        .accessibilityHint(comingSoon ? "Coming soon. Join the early-access waitlist." : "")
    }

    /// Essential — dark card. When the blood-tier gate is ON it's the MOST
    /// POPULAR pick → Eircode gate. When OFF it becomes a "Coming soon" card
    /// → early-access waitlist (price stays visible as roadmap).
    private var essentialCard: some View {
        let comingSoon = !bloodTiersEnabled
        return Button {
            if comingSoon {
                flow.push(.waitlist(.essential))
            } else {
                flow.push(.gate(.essential))
            }
        } label: {
            VStack(alignment: .leading, spacing: 3) {
                HStack(alignment: .firstTextBaseline) {
                    Text("Essential")
                        .font(.arcSans(16, weight: .bold))
                        .foregroundStyle(Color.arcCream)
                    Spacer()
                    (Text("€329").font(.arcSerif(22)).foregroundStyle(Color.arcCream)
                        + Text("/yr").font(.arcSans(12)).foregroundStyle(Color.arcMutedOnDark))
                        .padding(.trailing, 86)
                }
                Text("2 finger-prick tests a year, kits to your door, clinician-reviewed")
                    .font(.arcSans(12))
                    .foregroundStyle(Color.arcMutedOnDark)
                if comingSoon {
                    Text("Join the waitlist →")
                        .font(.arcSans(12, weight: .semibold))
                        .foregroundStyle(Color.arcBrightGreen)
                        .padding(.top, 4)
                }
            }
            .padding(18)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.arcDarkSurface, in: RoundedRectangle(cornerRadius: 18))
            .overlay(alignment: .topTrailing) {
                Text(comingSoon ? "COMING SOON" : "MOST POPULAR")
                    .font(.arcMono(8.5, weight: .medium))
                    .kerning(8.5 * 0.06)
                    .foregroundStyle(comingSoon ? Color.arcCream : Color.arcBadgeInk)
                    .padding(EdgeInsets(top: 3, leading: 8, bottom: 3, trailing: 8))
                    .background(
                        comingSoon ? Color.white.opacity(0.14) : Color.arcPrimaryGreen,
                        in: Capsule()
                    )
                    .padding(.top, 14)
                    .padding(.trailing, 16)
            }
            .contentShape(RoundedRectangle(cornerRadius: 18))
        }
        .buttonStyle(.plain)
        .accessibilityHint(comingSoon ? "Coming soon. Join the early-access waitlist." : "")
    }
}
