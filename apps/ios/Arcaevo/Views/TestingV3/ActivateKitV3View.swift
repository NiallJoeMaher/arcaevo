import SwiftUI

/// TESTING — Activate kit (light).
/// Link the kit to the member before testing: QR scan (mock — fills the
/// code with a success haptic) or hand-typed code. CTA → sample journey.
struct ActivateKitV3View: View {
    let tier: Membership.Tier

    @Environment(JourneyFlow.self) private var flow
    @State private var code = ""
    @State private var scanned = false

    private var codeReady: Bool {
        code.trimmingCharacters(in: .whitespaces).count >= 8
    }

    var body: some View {
        ZStack {
            Color.bone.ignoresSafeArea()
            VStack(alignment: .leading, spacing: 0) {
                ArcEyebrow(text: "Your kit has arrived", size: 10, color: .arcDeepGreen)
                    .padding(.top, 16)
                    .padding(.bottom, 14)

                Text("Link this kit to you before you begin")
                    .font(.arcSerif(27))
                    .lineSpacing(27 * 0.12)
                    .foregroundStyle(Color.ink)
                    .padding(.bottom, 18)

                // QR scan target — mock scanner: tapping "scans" the tube.
                Button {
                    code = "ARC-7F2K-D8"
                    scanned = true
                } label: {
                    VStack(spacing: 10) {
                        QRGlyph()
                            .frame(width: 54, height: 54)
                            .opacity(0.75)
                        Text(scanned ? "Scanned ✓ — ARC-7F2K-D8" : "Scan the QR on the tube")
                            .font(.arcSans(13, weight: .semibold))
                            .foregroundStyle(scanned ? Color.arcDeepGreen : Color.ink)
                    }
                    .frame(maxWidth: .infinity)
                    .frame(height: 160)
                    .background(.white, in: RoundedRectangle(cornerRadius: 18))
                    .overlay(
                        RoundedRectangle(cornerRadius: 18)
                            .stroke(
                                scanned ? Color.arcPrimaryGreen : Color.arcDarkSurface.opacity(0.25),
                                style: StrokeStyle(lineWidth: 1.5, dash: [6, 5])
                            )
                    )
                    .contentShape(RoundedRectangle(cornerRadius: 18))
                }
                .buttonStyle(.plain)
                .sensoryFeedback(.success, trigger: scanned)
                .padding(.bottom, 14)

                Text("or enter the code by hand")
                    .font(.arcSans(12))
                    .foregroundStyle(Color.arcSecondaryLight)
                    .frame(maxWidth: .infinity)
                    .padding(.bottom, 14)

                TextField("ARC-7F2K-D8", text: $code)
                    .font(.arcMono(16))
                    .kerning(16 * 0.14)
                    .foregroundStyle(Color.ink)
                    .multilineTextAlignment(.center)
                    .textInputAutocapitalization(.characters)
                    .autocorrectionDisabled()
                    .onChange(of: code) { scanned = code == "ARC-7F2K-D8" && scanned }
                    .padding(.vertical, 13)
                    .background(.white, in: RoundedRectangle(cornerRadius: 12))
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(Color.arcDarkSurface.opacity(0.16), lineWidth: 1)
                    )
                    .padding(.bottom, 18)

                Spacer()

                ArcPillButton(
                    title: "It's mine — show me how to test",
                    disabled: !codeReady,
                    fontSize: 14,
                    verticalPadding: 15
                ) {
                    flow.push(.sampleJourney(tier))
                }
            }
            .padding(EdgeInsets(top: 0, leading: 26, bottom: 28, trailing: 26))
        }
    }
}

/// The prototype's QR placeholder glyph — crossed repeating ink lines,
/// 3px on / 4px off, radius 12.
struct QRGlyph: View {
    var body: some View {
        Canvas { context, size in
            let on: CGFloat = 3, period: CGFloat = 7
            var y: CGFloat = 0
            while y < size.height {
                context.fill(
                    Path(CGRect(x: 0, y: y, width: size.width, height: on)),
                    with: .color(.arcDarkSurface)
                )
                y += period
            }
            var x: CGFloat = 0
            while x < size.width {
                context.fill(
                    Path(CGRect(x: x, y: 0, width: on, height: size.height)),
                    with: .color(.arcDarkSurface)
                )
                x += period
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }
}
