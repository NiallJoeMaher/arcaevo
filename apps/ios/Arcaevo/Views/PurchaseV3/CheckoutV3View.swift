import SwiftUI

/// PURCHASE — Checkout (light).
/// Payment ALWAYS links out to the web checkout (Stripe + Apple Pay on
/// web) via SFSafariViewController — NO IAP. This screen is the designed
/// explainer: order summary, secure-checkout eyebrow, refund note.
struct CheckoutV3View: View {
    let tier: Membership.Tier

    @Environment(AppState.self) private var appState
    @Environment(JourneyFlow.self) private var flow
    @State private var showingWebCheckout = false
    @State private var visitedWebCheckout = false

    var body: some View {
        ZStack {
            Color.bone.ignoresSafeArea()
            VStack(alignment: .leading, spacing: 0) {
                ArcBackLink(title: "Plans") { flow.pop() }
                    .padding(.bottom, 2)

                ArcEyebrow(text: "arcaevo.com · Secure checkout · \(tier.journeyLabel)", size: 10, color: .arcDeepGreen)
                    .padding(.bottom, 12)

                // Order summary (verbatim line items).
                VStack(spacing: 0) {
                    HStack {
                        Text("\(tier.displayName) · 1 year")
                            .font(.arcSans(13.5))
                            .foregroundStyle(Color.ink)
                        Spacer()
                        Text(tier.checkoutPrice)
                            .font(.arcMono(13.5))
                            .foregroundStyle(Color.ink)
                    }
                    .padding(.bottom, 5)
                    HStack {
                        Text(tier.checkoutIncludes)
                            .font(.arcSans(12))
                            .foregroundStyle(Color.arcSecondaryLight)
                        Spacer()
                        Text("Included")
                            .font(.arcMono(12))
                            .foregroundStyle(Color.arcSecondaryLight)
                    }
                    Rectangle()
                        .fill(Color.arcDarkSurface.opacity(0.1))
                        .frame(height: 1)
                        .padding(.vertical, 9)
                    HStack {
                        Text("Due today")
                            .font(.arcSans(14, weight: .bold))
                            .foregroundStyle(Color.ink)
                        Spacer()
                        Text(tier.checkoutPrice)
                            .font(.arcMono(14, weight: .medium))
                            .foregroundStyle(Color.ink)
                    }
                }
                .padding(EdgeInsets(top: 15, leading: 16, bottom: 15, trailing: 16))
                .background(.white, in: RoundedRectangle(cornerRadius: 14))
                .overlay(
                    RoundedRectangle(cornerRadius: 14)
                        .stroke(Color.arcDarkSurface.opacity(0.12), lineWidth: 1)
                )
                .padding(.bottom, 14)

                Text("Payment happens on arcaevo.com — Apple Pay or card, plus your delivery details. You'll come straight back here when it's done.")
                    .font(.arcSans(13))
                    .lineSpacing(13 * 0.35)
                    .foregroundStyle(Color.arcSecondaryDark)
                    .padding(.bottom, 14)

                ArcPillButton(title: "Pay \(tier.checkoutPrice) on arcaevo.com", fontSize: 14, verticalPadding: 14) {
                    showingWebCheckout = true
                    visitedWebCheckout = true
                }
                .padding(.bottom, 10)

                if visitedWebCheckout {
                    // Return path until the post-payment universal link lands:
                    // confirms the web checkout finished, then activates.
                    ArcGhostPill(title: "I've finished checkout — continue", fontSize: 14, verticalPadding: 14) {
                        appState.plan = tier
                        flow.push(.success(tier))
                    }
                    .padding(.bottom, 10)

                    #if DEBUG
                    Text("DEV · web checkout runs on the local backend; use the button above after paying (or to simulate offline).")
                        .font(.arcMono(9.5))
                        .foregroundStyle(Color.arcSecondaryLight)
                        .padding(.bottom, 10)
                    #endif
                }

                Spacer()

                Text("Full refund until your kit ships or your draw is booked.")
                    .font(.arcSans(11.5))
                    .foregroundStyle(Color.arcSecondaryLight)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: .infinity)
            }
            .padding(EdgeInsets(top: 14, leading: 26, bottom: 26, trailing: 26))
        }
        .sheet(isPresented: $showingWebCheckout) {
            V3SafariView(url: appState.checkoutURL(for: tier))
                .ignoresSafeArea()
        }
    }
}
