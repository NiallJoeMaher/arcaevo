import SwiftUI

/// YOUR DATA · "Confirm reading" — `data-screen-label="Confirm reading"`.
/// Every AI-extracted value is shown for confirmation (units included).
/// Low-confidence reads ("was this 41 or 47?") BLOCK the confirm CTA until
/// the member resolves them; confirm writes `self_reported` readings.
struct ConfirmReadingV3View: View {
    @Environment(AppState.self) private var appState
    @State private var pushTimeline = false
    @State private var confirming = false

    var body: some View {
        DataV3Screen {
            DataV3BackLink()

            if let state = appState.uploadConfirm {
                content(for: state)
            } else {
                // Standalone/preview entry: load the demo extraction so the
                // screen always demos (the "41 or 47?" ferritin fixture).
                ProgressView()
                    .frame(maxWidth: .infinity)
                    .padding(.top, 80)
            }
        }
        .task {
            if appState.uploadConfirm == nil {
                await appState.beginUpload(kind: .photo, fileName: nil)
            }
        }
        .navigationDestination(isPresented: $pushTimeline) { DataTimelineV3View() }
    }

    @ViewBuilder
    private func content(for state: UploadConfirmState) -> some View {
        Text("CHECK THE READING · \(state.values.count) MARKERS FOUND")
            .font(.arcMono(10, weight: .medium))
            .kerning(1.2)
            .foregroundStyle(Color.arcDeepGreen)
            .padding(.bottom, 12)

        Text("\(state.sourceName) · \(documentDateLabel(state)) — look right?")
            .font(.arcSerif(24))
            .foregroundStyle(Color.ink)
            .lineSpacing(2)
            .padding(.bottom, 16)

        ForEach(state.values) { value in
            if value.lowConfidence {
                lowConfidenceCard(value)
                    .padding(.bottom, value.id == state.values.last?.id ? 16 : 8)
            } else {
                valueRow(value)
                    .padding(.bottom, 8)
            }
        }

        if state.isBlocked {
            // Blocked pill — mirrors the backend's 422 `unresolved_low_confidence`.
            Text("Resolve \(firstUnresolvedName(state)) to continue")
                .font(.arcSans(14, weight: .semibold))
                .foregroundStyle(Color.arcSecondaryLight)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(Color.arcDarkSurface.opacity(0.12), in: Capsule())
                .padding(.top, 8)
                .padding(.bottom, 10)
        } else {
            Button {
                guard !confirming else { return }
                confirming = true
                Task {
                    let confirmed = await appState.confirmUpload()
                    confirming = false
                    if confirmed { pushTimeline = true }
                }
            } label: {
                Text("Looks right — add all \(state.values.count)")
                    .font(.arcSans(14, weight: .semibold))
                    .foregroundStyle(Color.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(Color.arcDeepGreen, in: Capsule())
            }
            .buttonStyle(.plain)
            .disabled(confirming)
            .padding(.top, 8)
            .padding(.bottom, 10)
        }

        Text("View the original side-by-side")
            .font(.arcSans(12))
            .foregroundStyle(Color.arcSecondaryLight)
            .frame(maxWidth: .infinity)
    }

    // MARK: Rows

    private func valueRow(_ value: UploadConfirmState.PendingValue) -> some View {
        HStack(alignment: .center) {
            VStack(alignment: .leading, spacing: 2) {
                Text(value.name)
                    .font(.arcSans(13.5, weight: .bold))
                    .foregroundStyle(Color.ink)
                Text(value.unit)
                    .font(.arcSans(11))
                    .foregroundStyle(Color.arcSecondaryLight)
            }
            Spacer()
            Text(DataV3Format.number(value.extractedValue))
                .font(.arcMono(16))
                .foregroundStyle(Color.ink)
        }
        .padding(.vertical, 13)
        .padding(.horizontal, 15)
        .dataV3Card(radius: 13)
    }

    /// The blocking low-confidence card: amber tint, "41 or 47?" chooser.
    private func lowConfidenceCard(_ value: UploadConfirmState.PendingValue) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .center) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(value.name)
                        .font(.arcSans(13.5, weight: .bold))
                        .foregroundStyle(Color.ink)
                    Text(lowConfidenceQuestion(value))
                        .font(.arcSans(11))
                        .foregroundStyle(ArcDataPalette.rust)
                }
                Spacer()
                Text(resolvedDisplay(value))
                    .font(.arcMono(16))
                    .foregroundStyle(Color.ink)
            }
            HStack(spacing: 8) {
                ForEach(value.alternatives ?? [], id: \.self) { alt in
                    let picked = value.resolvedValue == alt
                    Button {
                        appState.resolveUploadValue(code: value.code, value: alt)
                    } label: {
                        Text(DataV3Format.number(alt))
                            .font(.arcMono(13))
                            .foregroundStyle(Color.ink)
                            .frame(maxWidth: .infinity, minHeight: 44)
                            .background(
                                picked ? ArcDataPalette.greenFill : Color.white,
                                in: Capsule()
                            )
                            .overlay(
                                Capsule().strokeBorder(
                                    picked ? Color.arcDeepGreen : ArcDataPalette.hairlineStrong,
                                    lineWidth: picked ? 1.5 : 1
                                )
                            )
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .padding(.vertical, 13)
        .padding(.horizontal, 15)
        .dataV3Card(
            radius: 13,
            border: ArcDataPalette.lowConfidenceBorder,
            borderWidth: 1.5,
            fill: ArcDataPalette.lowConfidenceFill // translucent amber over the cream, per design
        )
    }

    // MARK: Helpers

    private func documentDateLabel(_ state: UploadConfirmState) -> String {
        guard let date = DataV3Format.fromISODay(state.documentDate) else { return state.documentDate }
        return DataV3Format.shortDate(date)
    }

    /// "Low confidence — was this 41 or 47?" built from the alternatives.
    private func lowConfidenceQuestion(_ value: UploadConfirmState.PendingValue) -> String {
        guard let alts = value.alternatives, alts.count >= 2 else {
            return "Low confidence — check this value"
        }
        let list = alts.map(DataV3Format.number).joined(separator: " or ")
        return "Low confidence — was this \(list)?"
    }

    /// Unresolved shows the prototype's "4_" placeholder (shared prefix of
    /// the alternatives padded with underscores); resolved shows the choice.
    private func resolvedDisplay(_ value: UploadConfirmState.PendingValue) -> String {
        if let resolved = value.resolvedValue { return DataV3Format.number(resolved) }
        guard let alts = value.alternatives, !alts.isEmpty else { return "—" }
        let strings = alts.map(DataV3Format.number)
        let shared = strings.dropFirst().reduce(strings[0]) { $0.commonPrefix(with: $1) }
        let maxLen = strings.map(\.count).max() ?? shared.count
        return shared + String(repeating: "_", count: max(1, maxLen - shared.count))
    }

    private func firstUnresolvedName(_ state: UploadConfirmState) -> String {
        state.values.first { $0.lowConfidence && $0.resolvedValue == nil }?.name.lowercased() ?? "flagged values"
    }
}

#if DEBUG
#Preview("Confirm reading") {
    NavigationStack { ConfirmReadingV3View() }
        .environment(AppState())
        .environment(AppModel())
}
#endif
