import SwiftUI

/// MEMBER APP · Widgets gallery ("Widgets" in Prototype.dc.html).
///
/// The in-app explainer for the before-you-open-the-app surfaces (ALGORITHM
/// §1.8 ten-second rule): Lock Screen widget, watch Smart Stack, and the
/// complication set. One number per surface. This is the marketing/preview
/// screen; the real WidgetKit + complication extension is Wave 2c's target.
struct WidgetsGalleryV3View: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(AppModel.self) private var model

    init() {}

    private var readiness: Int { model.readinessResult?.final ?? 62 }
    private var decision: ReadinessDecision { model.readinessResult?.decision ?? .goEasy }
    private var energy: Int { model.energyDay?.value(at: Date()) ?? 54 }
    private var exertion: Int { model.readinessResult?.exertionCeiling ?? 4 }

    var body: some View {
        ZStack {
            Color.bone.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    backLink
                    Mv3Eyebrow(text: "BEFORE THE APP OPENS", size: 10, color: .arcDeepGreen, kerning: 1.2)
                        .padding(.bottom, 12)
                    Text("Lock Screen, Smart Stack, watch face.")
                        .font(.arcSerif(25))
                        .foregroundStyle(Color.ink)
                        .lineSpacing(1)
                        .padding(.bottom, 8)
                    Text("The morning read should cost ten seconds and zero taps. Choose what lives where.")
                        .font(.arcSans(13))
                        .foregroundStyle(Color.arcSecondaryDark)
                        .lineSpacing(2)
                        .padding(.bottom, 16)

                    lockScreenCard
                    smartStackCard
                    complicationsCard
                    footnote
                }
                .padding(.horizontal, 26)
                .padding(.top, 4)
                .padding(.bottom, 26)
            }
        }
        .toolbar(.hidden, for: .navigationBar)
        .task { if model.readinessResult == nil { await model.loadAll() } }
    }

    private var backLink: some View {
        Button { dismiss() } label: {
            Text("‹ Today")
                .font(.arcSans(13))
                .foregroundStyle(Color.arcSecondaryDark)
                .frame(minHeight: 44, alignment: .leading)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    // MARK: Lock Screen widget

    private var lockScreenCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Mv3Eyebrow(text: "LOCK SCREEN WIDGET", size: 9, kerning: 0.9)
            HStack(spacing: 16) {
                miniRing(value: "\(readiness)", color: Mv3.goEasyAmber)
                VStack(alignment: .leading, spacing: 2) {
                    Text(decision.headline.replacingOccurrences(of: ".", with: ""))
                        .font(.arcSans(14, weight: .bold))
                        .foregroundStyle(Color.arcCream)
                    Text("HRV below your band · ceiling \(exertion) of 10")
                        .font(.arcSans(11.5))
                        .foregroundStyle(Color.arcMutedOnDark)
                }
            }
        }
        .padding(.horizontal, 18)
        .padding(.vertical, 16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.arcDarkSurface, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        .padding(.bottom, 10)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Lock Screen widget. Readiness \(Mv3.spell(readiness)), \(decision.headline.lowercased().dropLast()).")
    }

    private func miniRing(value: String, color: Color) -> some View {
        ZStack {
            Circle().stroke(Color.white.opacity(0.14), lineWidth: 6)
            Circle()
                .trim(from: 0, to: 0.62)
                .stroke(color, style: StrokeStyle(lineWidth: 6, lineCap: .round))
                .rotationEffect(.degrees(-90))
            Text(value)
                .font(.arcMono(14))
                .foregroundStyle(Color.arcCream)
        }
        .frame(width: 54, height: 54)
    }

    // MARK: Smart Stack

    private var smartStackCard: some View {
        VStack(alignment: .leading, spacing: 11) {
            HStack {
                Mv3Eyebrow(text: "SMART STACK · WATCH", size: 9, kerning: 0.9)
                Spacer()
                Text("AT YOUR WAKE TIME")
                    .font(.arcMono(9))
                    .foregroundStyle(Color.arcBrightGreen)
            }
            VStack(alignment: .leading, spacing: 2) {
                Text("Readiness \(readiness) — go easy")
                    .font(.arcSans(13, weight: .bold))
                    .foregroundStyle(Color.arcCream)
                Text("Rises to the top of the stack at ~06:45, then gets out of the way.")
                    .font(.arcSans(11))
                    .foregroundStyle(Color.arcMutedOnDark)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.white.opacity(0.06), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        }
        .padding(.horizontal, 18)
        .padding(.vertical, 16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.arcDarkSurface, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        .padding(.bottom, 10)
    }

    // MARK: Complications

    private var complicationsCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Mv3Eyebrow(text: "COMPLICATIONS · EVERY FACE FAMILY", size: 9, color: .arcSecondaryLight, kerning: 0.9)
            HStack(spacing: 14) {
                complication(value: "\(readiness)", label: "READINESS", border: Mv3.goEasyAmber, valueColor: .arcCream, size: 14)
                complication(value: "\(energy)%", label: "ENERGY", border: .arcPrimaryGreen, valueColor: .arcCream, size: 12)
                complication(value: "T−12", label: "NEXT TEST", border: Color.arcHollowGold.opacity(0.5), valueColor: .arcHollowGold, size: 12)
            }
            .frame(maxWidth: .infinity)
        }
        .padding(.horizontal, 18)
        .padding(.vertical, 16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.surface, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .strokeBorder(Color.arcDarkSurface.opacity(0.12), lineWidth: 1)
        )
        .padding(.bottom, 12)
    }

    private func complication(value: String, label: String, border: Color, valueColor: Color, size: CGFloat) -> some View {
        VStack(spacing: 6) {
            ZStack {
                Circle().fill(Color.arcDarkSurface)
                Circle().strokeBorder(border, lineWidth: 3)
                Text(value)
                    .font(.arcMono(size))
                    .foregroundStyle(valueColor)
            }
            .frame(width: 52, height: 52)
            Text(label)
                .font(.arcMono(8))
                .kerning(0.6)
                .foregroundStyle(Color.arcSecondaryLight)
        }
        .frame(maxWidth: .infinity)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(label) complication, \(value).")
    }

    private var footnote: some View {
        Text("One number per surface — if you need to open the app,\nthe widget has already failed.")
            .font(.arcSans(11.5))
            .foregroundStyle(Color.arcSecondaryLight)
            .multilineTextAlignment(.center)
            .lineSpacing(3)
            .frame(maxWidth: .infinity)
            .padding(.top, 6)
    }
}

#if DEBUG
#Preview("Widgets gallery") {
    MemberV3ScreenPreview { NavigationStack { WidgetsGalleryV3View() } }
}
#endif
