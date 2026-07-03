import SwiftUI

/// PURCHASE — Eircode gate (light). STEP 1 OF 3.
/// Routing-key-only check via POST /eligibility/check (demo allowlist
/// offline). Pass (e.g. D08) → checkout · fail (e.g. T12) → waitlist,
/// with the Cork copy. The gate resets on entry, like the prototype.
struct EircodeGateV3View: View {
    let tier: Membership.Tier

    @Environment(AppState.self) private var appState
    @Environment(JourneyFlow.self) private var flow
    @State private var eircode = ""
    @State private var checking = false
    @State private var passed = false

    var body: some View {
        ZStack {
            Color.bone.ignoresSafeArea()
            VStack(alignment: .leading, spacing: 0) {
                ArcBackLink(title: "Plans") { flow.pop() }
                    .padding(.bottom, 2)

                ArcEyebrow(text: "Step 1 of 3 · \(tier.journeyLabel)", size: 10, color: .arcDeepGreen)
                    .padding(.bottom, 14)

                Text("First — can we reach you?")
                    .font(.arcSerif(27))
                    .lineSpacing(27 * 0.12)
                    .foregroundStyle(Color.ink)
                    .padding(.bottom, 8)

                Text("Kits go by courier and nurses travel, so we're starting where we can do both well: Dublin.")
                    .font(.arcSans(13))
                    .lineSpacing(13 * 0.35)
                    .foregroundStyle(Color.arcSecondaryLight)
                    .padding(.bottom, 22)

                (Text("Your Eircode ").font(.arcSans(13, weight: .semibold)).foregroundStyle(Color.ink)
                    + Text("· tap one to try").font(.arcSans(13)).foregroundStyle(Color.arcSecondaryLight))
                    .padding(.bottom, 8)

                // Free-typed Eircode — checks on submit.
                TextField("D08 XY24", text: $eircode)
                    .font(.arcMono(14))
                    .kerning(14 * 0.06)
                    .foregroundStyle(Color.ink)
                    .multilineTextAlignment(.center)
                    .textInputAutocapitalization(.characters)
                    .autocorrectionDisabled()
                    .submitLabel(.go)
                    .onSubmit { check(eircode) }
                    .padding(.vertical, 13)
                    .background(.white, in: RoundedRectangle(cornerRadius: 12))
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(Color.arcDarkSurface.opacity(0.16), lineWidth: 1)
                    )
                    .padding(.bottom, 9)

                // The prototype's "tap one to try" sample codes.
                HStack(spacing: 9) {
                    sampleCode("D08 XY24", highlight: dublinTried ? .pass : nil)
                    sampleCode("T12 AB90", highlight: corkTried ? .fail : nil)
                }
                .padding(.bottom, 18)

                switch appState.eircodeGate {
                case .pass(_, let county):
                    HStack(spacing: 9) {
                        Text("✓")
                            .font(.arcSans(12))
                            .foregroundStyle(Color.arcDeepGreen)
                            .frame(width: 22, height: 22)
                            .background(Color.arcPrimaryGreen.opacity(0.16), in: Circle())
                        Text("You're in the \(county ?? "Dublin") service area")
                            .font(.arcSans(14, weight: .semibold))
                            .foregroundStyle(Color.arcDeepGreen)
                    }
                    .padding(.bottom, 22)

                    ArcPillButton(title: "Continue to your details", fontSize: 14.5, verticalPadding: 15) {
                        flow.push(.checkout(tier))
                    }

                case .fail(let key, let county):
                    HStack(spacing: 9) {
                        Text("→")
                            .font(.arcSans(12))
                            .foregroundStyle(Color.arcGateFail)
                            .frame(width: 22, height: 22)
                            .background(Color.arcGateFail.opacity(0.12), in: Circle())
                        Text("\(county ?? key) — not in the service area yet")
                            .font(.arcSans(14, weight: .semibold))
                            .foregroundStyle(Color.arcGateFail)
                    }
                    .padding(.bottom, 22)

                    ArcPillButton(title: "See your options", fontSize: 14.5, verticalPadding: 15) {
                        flow.push(.waitlist(tier))
                    }

                case .unchecked:
                    if !eircode.trimmingCharacters(in: .whitespaces).isEmpty {
                        ArcPillButton(
                            title: checking ? "Checking…" : "Check my Eircode",
                            disabled: checking || eircode.trimmingCharacters(in: .whitespaces).count < 3,
                            fontSize: 14.5,
                            verticalPadding: 15
                        ) {
                            check(eircode)
                        }
                    }
                }

                Spacer()

                Text("Only the routing key is checked — we don't store it until you order.")
                    .font(.arcSans(11.5))
                    .foregroundStyle(Color.arcSecondaryLight)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: .infinity)
            }
            .padding(EdgeInsets(top: 14, leading: 26, bottom: 28, trailing: 26))
        }
        .sensoryFeedback(.success, trigger: passed)
        .onAppear {
            // Fresh check every time the gate is entered (prototype: code = null).
            appState.eircodeGate = .unchecked
        }
    }

    private enum SampleHighlight { case pass, fail }

    private var dublinTried: Bool {
        if case .pass = appState.eircodeGate, eircode.hasPrefix("D08") { return true }
        return false
    }

    private var corkTried: Bool {
        if case .fail = appState.eircodeGate, eircode.hasPrefix("T12") { return true }
        return false
    }

    private func sampleCode(_ code: String, highlight: SampleHighlight?) -> some View {
        Button {
            eircode = code
            check(code)
        } label: {
            Text(code)
                .font(.arcMono(14))
                .kerning(14 * 0.06)
                .foregroundStyle(Color.ink)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 13)
                .background(
                    RoundedRectangle(cornerRadius: 12).fill(
                        highlight == .pass ? Color.arcPrimaryGreen.opacity(0.08)
                            : highlight == .fail ? Color.arcAmber.opacity(0.08)
                            : Color.white
                    )
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 12).stroke(
                        highlight == .pass ? Color.arcPrimaryGreen
                            : highlight == .fail ? Color.arcAmber
                            : Color.arcDarkSurface.opacity(0.16),
                        lineWidth: highlight == nil ? 1 : 1.5
                    )
                )
                .contentShape(RoundedRectangle(cornerRadius: 12))
                .frame(minHeight: 44)
        }
        .buttonStyle(.plain)
    }

    private func check(_ code: String) {
        let trimmed = code.trimmingCharacters(in: .whitespaces)
        guard trimmed.count >= 3, !checking else { return }
        checking = true
        flow.lastEircode = trimmed
        Task {
            await appState.checkEircode(trimmed)
            checking = false
            if case .pass = appState.eircodeGate { passed.toggle() }
        }
    }
}
