import SwiftUI

/// MEMBER APP · insights ("Insights" in Prototype.dc.html).
/// This week's top three, in plain language — each tagged with where the
/// evidence came from (blood, Watch, or both). AI writes the words; the
/// maths comes from the member's own baselines.
struct InsightsV3View: View {
    @Environment(\.dismiss) private var dismiss

    init() {}

    private struct Card: Identifiable {
        let number: String
        let tag: String
        let title: String
        let body: String
        var id: String { number }
    }

    private let cards: [Card] = [
        Card(number: "01", tag: "BLOOD + WATCH",
             title: "The walks are working — keep them exactly as they are.",
             body: "ApoB down 16% over 46 logged walks. Changing nothing is this week's best move."),
        Card(number: "02", tag: "BLOOD",
             title: "Ferritin slipped under range — food first, not pills.",
             body: "29 µg/L, down from 41. Red meat, lentils or a fortified breakfast 3×/week; recheck in January before supplementing."),
        Card(number: "03", tag: "WATCH",
             title: "Your deep sleep still pays for screens after 23:00.",
             body: "On late nights, deep sleep drops 31 minutes. Worth a two-week experiment when the walks are settled."),
    ]

    var body: some View {
        ZStack {
            Color.arcDarkSurface.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    Mv3BackLink(title: "Today") { dismiss() }

                    Mv3Eyebrow(text: "THIS WEEK · TOP 3")
                        .padding(.bottom, 6)
                    Text("Three things your data agrees on.")
                        .font(.arcSerif(26))
                        .foregroundStyle(Color.arcCream)
                        .lineSpacing(2)
                        .padding(.bottom, 16)

                    ForEach(cards) { card in
                        insightCard(card)
                            .padding(.bottom, 10)
                    }

                    Text("AI writes the words. The maths comes from your own baselines —\nnever generic advice.")
                        .font(.arcSans(11.5))
                        .lineSpacing(3)
                        .foregroundStyle(Color.arcRailDim)
                        .multilineTextAlignment(.center)
                        .frame(maxWidth: .infinity)
                        .padding(.top, 8)
                }
                .padding(.horizontal, 24)
                .padding(.top, 8)
                .padding(.bottom, 20)
            }
        }
        .toolbar(.hidden, for: .navigationBar)
    }

    private func insightCard(_ card: Card) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            HStack {
                Text(card.number)
                    .font(.arcMono(10, weight: .regular))
                    .foregroundStyle(Color.arcBrightGreen)
                Spacer()
                Text(card.tag)
                    .font(.arcMono(8.5, weight: .regular))
                    .kerning(0.7)
                    .foregroundStyle(Color.arcMutedOnDark)
            }
            .padding(.bottom, 2)
            Text(card.title)
                .font(.arcSans(14, weight: .bold))
                .lineSpacing(3)
                .foregroundStyle(Color.arcCream)
            Text(card.body)
                .font(.arcSans(12))
                .lineSpacing(3)
                .foregroundStyle(Color.arcMutedOnDark)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 15)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Mv3.cardFill, in: RoundedRectangle(cornerRadius: 15, style: .continuous))
    }
}
