import SwiftUI

/// MEMBER APP · results ("Results" in Prototype.dc.html).
/// The July panel, grouped by system with verdict tints — never a red
/// alarming number. The one group worth acting on navigates to the marker
/// detail (ApoB).
struct MemberResultsV3View: View {
    init() {}

    var body: some View {
        NavigationStack {
            ZStack {
                Color.arcDarkSurface.ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: 0) {
                        Mv3Eyebrow(text: "JULY PANEL · SIGNED OFF BY DR. NOLAN · 2 JUL")
                            .padding(.bottom, 6)
                        Text("38 markers, one thing worth doing.")
                            .font(.arcSerif(26))
                            .foregroundStyle(Color.arcCream)
                            .lineSpacing(2)
                            .padding(.bottom, 14)

                        summaryChips

                        // Cardiovascular — the one worth acting on → detail.
                        NavigationLink {
                            MarkerDetailV3View()
                        } label: {
                            groupRow(
                                title: "Cardiovascular",
                                sub: "ApoB above optimal — moving the right way",
                                subColor: Mv3.watchAmber,
                                trailing: .chevron,
                                border: Mv3.amber.opacity(0.35)
                            )
                        }
                        .buttonStyle(.plain)

                        groupRow(title: "Metabolic", sub: "HbA1c, glucose, insulin — all in range",
                                 subColor: .arcMutedOnDark, trailing: .check)
                        groupRow(title: "Nutrients", sub: "Ferritin 29 — just under, worth watching",
                                 subColor: Mv3.watchAmber, trailing: .chevron)
                        groupRow(title: "Inflammation", sub: "CRP low and steady",
                                 subColor: .arcMutedOnDark, trailing: .check)
                        groupRow(title: "Hormones", sub: "Thyroid panel — all in range",
                                 subColor: .arcMutedOnDark, trailing: .check)

                        Text("Compared with February: 5 improved · 1 slipped · 32 steady")
                            .font(.arcSans(12))
                            .foregroundStyle(Color.arcMutedOnDark)
                            .frame(maxWidth: .infinity)
                            .multilineTextAlignment(.center)
                            .padding(.top, 5)
                    }
                    .padding(.horizontal, 24)
                    .padding(.top, 14)
                    .padding(.bottom, 20)
                }
            }
            .toolbar(.hidden, for: .navigationBar)
        }
    }

    // MARK: "34 IN RANGE · 3 WATCH · 1 ACT"

    private var summaryChips: some View {
        HStack(spacing: 8) {
            summaryChip("34 IN RANGE", text: .arcBrightGreen, fill: Color.arcPrimaryGreen.opacity(0.14))
            summaryChip("3 WATCH", text: Mv3.watchAmber, fill: Mv3.amber.opacity(0.14))
            summaryChip("1 ACT", text: Mv3.actRose, fill: Color(hex: 0xB3543A).opacity(0.16))
        }
        .padding(.bottom, 16)
    }

    private func summaryChip(_ label: String, text: Color, fill: Color) -> some View {
        Text(label)
            .font(.arcMono(11, weight: .regular))
            .foregroundStyle(text)
            .padding(.vertical, 6)
            .padding(.horizontal, 12)
            .background(fill, in: Capsule())
    }

    // MARK: Group rows

    private enum Trailing { case chevron, check }

    private func groupRow(
        title: String,
        sub: String,
        subColor: Color,
        trailing: Trailing,
        border: Color? = nil
    ) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.arcSans(13.5, weight: .bold))
                    .foregroundStyle(Color.arcCream)
                Text(sub)
                    .font(.arcSans(11.5))
                    .foregroundStyle(subColor)
            }
            Spacer()
            switch trailing {
            case .chevron:
                Text("›")
                    .font(.arcSans(15))
                    .foregroundStyle(Color.arcMutedOnDark)
            case .check:
                Text("✓")
                    .font(.arcMono(10, weight: .regular))
                    .foregroundStyle(Color.arcBrightGreen)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Mv3.cardFill, in: RoundedRectangle(cornerRadius: 15, style: .continuous))
        .overlay {
            if let border {
                RoundedRectangle(cornerRadius: 15, style: .continuous)
                    .strokeBorder(border, lineWidth: 1)
            }
        }
        .contentShape(RoundedRectangle(cornerRadius: 15))
        .padding(.bottom, 9)
    }
}
