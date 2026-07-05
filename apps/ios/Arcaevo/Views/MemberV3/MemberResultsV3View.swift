import SwiftUI

/// MEMBER APP · results ("Results" in Prototype.dc.html).
/// The July panel, grouped by system with verdict tints — never a red
/// alarming number. The one group worth acting on navigates to the marker
/// detail (ApoB).
struct MemberResultsV3View: View {
    @Environment(AppModel.self) private var model

    init() {}

    /// The panel's signed clinician note. All readings of one panel share the
    /// same note object, so `AppModel.clinicianNote` already dedupes to one.
    private var note: ClinicianNote? { model.clinicianNote }

    var body: some View {
        NavigationStack {
            ZStack {
                Color.arcDarkSurface.ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: 0) {
                        if model.showsBloodSample {
                            Mv3SampleBanner(detail: "An example blood panel — not your results. Your own appears once your first blood test is in.")
                                .padding(.bottom, 12)
                        }

                        Mv3Eyebrow(text: model.showsBloodSample
                                   ? "SAMPLE PANEL · EXAMPLE DATA"
                                   : "JULY PANEL · REVIEWED · 2 JUL")
                            .padding(.bottom, 6)
                        Text("38 markers, one thing worth doing.")
                            .font(.arcSerif(26))
                            .foregroundStyle(Color.arcCream)
                            .lineSpacing(2)
                            .padding(.bottom, 14)

                        summaryChips

                        // The panel note. For a real reviewed panel this is the
                        // clinician's signed note; for the Sample preview it is
                        // an honest automated-summary card, clearly badged and
                        // never a fabricated clinician sign-off.
                        if model.showsBloodSample {
                            sampleSummaryCard
                                .padding(.bottom, 9)
                        } else if let note {
                            clinicianNoteCard(note)
                                .padding(.bottom, 9)
                        }

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

    // MARK: Clinician note (real reviewed panel only)

    private func clinicianNoteCard(_ note: ClinicianNote) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Mv3Eyebrow(text: "CLINICIAN NOTE · ON EVERY REVIEWED PANEL", size: 9,
                       color: Color.arcHollowGold, kerning: 0.9)
                .padding(.bottom, 6)
            Text("\u{201C}\(note.text)\u{201D}")
                .font(.arcSans(12.5))
                .italic()
                .lineSpacing(4)
                .foregroundStyle(Color(hex: 0xE8E4DA))
            Text(signature(note))
                .font(.arcMono(8.5, weight: .regular))
                .foregroundStyle(Color.arcMutedOnDark)
                .padding(.top, 7)
        }
        .padding(.horizontal, 15)
        .padding(.vertical, 13)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.arcCream.opacity(0.07),
                    in: RoundedRectangle(cornerRadius: 15, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 15, style: .continuous)
                .strokeBorder(Color.arcCream.opacity(0.14), lineWidth: 1)
        )
        .accessibilityElement(children: .combine)
    }

    /// Real signed note only — a registered clinician's name + IMC number,
    /// shown ONLY for an actually-reviewed panel. The Sample preview never
    /// borrows a name or IMC number (it uses `sampleSummaryCard` instead).
    private func signature(_ note: ClinicianNote) -> String {
        var parts = [note.clinicianName.uppercased(), "IMC \(note.imcNumber)"]
        if let readAt = note.readAt {
            parts.append("READ \(DataV3Format.dayMonth(readAt).uppercased())")
        }
        return parts.joined(separator: " · ")
    }

    /// Honest stand-in for the panel note on the Sample preview: framed as an
    /// automated wellness summary (never a diagnosis, never a fabricated
    /// clinician sign-off), badged Sample, with the real promise that a
    /// registered clinician reviews blood-tier results once a lab is onboarded.
    private var sampleSummaryCard: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 8) {
                Mv3Eyebrow(text: "AUTOMATED WELLNESS SUMMARY · NOT A DIAGNOSIS", size: 9,
                           color: Color.arcHollowGold, kerning: 0.9)
                Spacer(minLength: 6)
                Mv3SampleTag()
            }
            .padding(.bottom, 6)
            Text("\u{201C}Nothing here would worry a reviewer. The walks are clearly working — keep them. Ferritin is the one to feed: food first, recheck in January.\u{201D}")
                .font(.arcSans(12.5))
                .italic()
                .lineSpacing(4)
                .foregroundStyle(Color(hex: 0xE8E4DA))
            Text("Example summary. On blood tiers, a registered clinician reviews your results once a lab partner is onboarded.")
                .font(.arcMono(8.5, weight: .regular))
                .lineSpacing(2)
                .foregroundStyle(Color.arcMutedOnDark)
                .padding(.top, 7)
        }
        .padding(.horizontal, 15)
        .padding(.vertical, 13)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.arcCream.opacity(0.07),
                    in: RoundedRectangle(cornerRadius: 15, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 15, style: .continuous)
                .strokeBorder(Color.arcHollowGold.opacity(0.35), lineWidth: 1)
        )
        .accessibilityElement(children: .combine)
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
