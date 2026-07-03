import SwiftUI

/// FREE TIER — Plans (light).
/// Three tier cards, prices verbatim (€119 / €329 / €399, annual only).
/// Fusion → checkout (web link-out); Essential/Performance → Eircode gate.
struct PlansV3View: View {
    @Environment(JourneyFlow.self) private var flow

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

                lightPlanCard(
                    name: "Fusion",
                    price: "€119",
                    sub: "Your watch + any past bloodwork · works anywhere, nothing ships"
                ) {
                    flow.push(.checkout(.fusion))
                }
                .padding(.bottom, 11)

                essentialCard
                    .padding(.bottom, 11)

                lightPlanCard(
                    name: "Performance",
                    price: "€399",
                    sub: "Venous panel · 80+ markers · nurse comes to you, Dublin"
                ) {
                    flow.push(.gate(.performance))
                }
                .padding(.bottom, 16)

                Spacer()

                Text("Tap a plan — payment happens on arcaevo.com.\nEssential & Performance check your Eircode first.")
                    .font(.arcSans(11.5))
                    .lineSpacing(11.5 * 0.4)
                    .foregroundStyle(Color.arcSecondaryLight)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: .infinity)
            }
            .padding(EdgeInsets(top: 14, leading: 26, bottom: 26, trailing: 26))
        }
    }

    /// Fusion / Performance — #FBFAF6 card, ink-alpha border, radius 18.
    private func lightPlanCard(
        name: String,
        price: String,
        sub: String,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 3) {
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
    }

    /// Essential — dark card, MOST POPULAR badge, → Eircode gate.
    private var essentialCard: some View {
        Button {
            flow.push(.gate(.essential))
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
            }
            .padding(18)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.arcDarkSurface, in: RoundedRectangle(cornerRadius: 18))
            .overlay(alignment: .topTrailing) {
                Text("MOST POPULAR")
                    .font(.arcMono(8.5, weight: .medium))
                    .kerning(8.5 * 0.06)
                    .foregroundStyle(Color.arcBadgeInk)
                    .padding(EdgeInsets(top: 3, leading: 8, bottom: 3, trailing: 8))
                    .background(Color.arcPrimaryGreen, in: Capsule())
                    .padding(.top, 14)
                    .padding(.trailing, 16)
            }
            .contentShape(RoundedRectangle(cornerRadius: 18))
        }
        .buttonStyle(.plain)
    }
}
