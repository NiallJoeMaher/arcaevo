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
    /// True while the Release build re-checks membership status server-side.
    @State private var checkingPayment = false
    /// True when the backend has NOT (yet) confirmed a paid membership — shows
    /// the honest "we haven't seen your payment yet" state; the plan stays put.
    @State private var paymentNotConfirmed = false

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
                    // Return path until the post-payment universal link lands.
                    // In Release this does NOT activate on tap — it re-fetches
                    // the member's membership status from the backend and only
                    // advances when the backend reports a paid (active)
                    // membership. No client-side free activation. (DEBUG/local
                    // demo keeps the shortcut so the flow stays walkable.)
                    ArcGhostPill(
                        title: checkingPayment
                            ? "Checking your payment…"
                            : (paymentNotConfirmed
                                ? "Check again"
                                : "I've finished checkout — continue"),
                        fontSize: 14,
                        verticalPadding: 14
                    ) {
                        Task { await continueAfterCheckout() }
                    }
                    .disabled(checkingPayment)
                    .padding(.bottom, 10)

                    if paymentNotConfirmed {
                        // Honest, non-activating state: we haven't seen the
                        // payment land server-side yet. Retry via the button above.
                        Text("We haven't seen your payment yet — it can take a moment after you finish on the web. Tap \u{201C}Check again\u{201D} in a few seconds.")
                            .font(.arcSans(12.5))
                            .lineSpacing(12.5 * 0.35)
                            .foregroundStyle(Color.arcSecondaryDark)
                            .padding(.bottom, 10)
                    }

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

    /// Post-checkout continue. Release NEVER activates client-side: it re-checks
    /// the member's membership status on the backend and only advances into the
    /// member shell when the backend reports an *active* (paid) membership.
    /// Anything else (pending, no membership, offline, decode error) leaves the
    /// plan untouched and surfaces the honest "payment not seen yet" retry state.
    private func continueAfterCheckout() async {
        #if DEBUG
        // DEBUG / local demo: the web checkout runs against the local backend
        // (no real Stripe webhook), so keep the shortcut — otherwise the demo
        // and local dev flows could never reach the member shell.
        activate()
        #else
        checkingPayment = true
        paymentNotConfirmed = false
        defer { checkingPayment = false }
        do {
            // Authed re-fetch of the paid-membership signal (status == "active").
            let status = try await appState.api.membershipStatus()
            if status == "active" {
                activate()
            } else {
                // pending / no membership row yet → do NOT flip the plan.
                paymentNotConfirmed = true
            }
        } catch {
            // Couldn't confirm (offline / not signed in / non-2xx) → never
            // activate on an unverified state.
            paymentNotConfirmed = true
        }
        #endif
    }

    /// Flip the local plan and advance to the success screen. Only reached from
    /// a backend-confirmed activation (Release) or the DEBUG/demo shortcut.
    private func activate() {
        appState.plan = tier
        flow.push(.success(tier))
    }
}
