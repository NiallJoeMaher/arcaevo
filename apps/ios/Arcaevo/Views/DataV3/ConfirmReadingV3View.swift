import SwiftUI

/// YOUR DATA · "Confirm reading" — `data-screen-label="Confirm reading"`.
/// Every AI-extracted value is shown for confirmation (units included).
/// Low-confidence reads ("was this 41 or 47?") BLOCK the confirm CTA until
/// the member resolves them; confirm writes `self_reported` readings.
struct ConfirmReadingV3View: View {
    @Environment(AppState.self) private var appState
    @State private var pushTimeline = false
    @State private var confirming = false
    /// The member-confirmed blood-draw date. Real OCR can't read it, so it's
    /// editable here; seeded from the extraction's date (today, on the real
    /// path). This — not the upload day — is what's sent as `takenAt`.
    @State private var drawDate: Date?
    @State private var showDatePicker = false

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

        Text("\(state.sourceName) · \(selectedDateLabel(state)) — look right?")
            .font(.arcSerif(24))
            .foregroundStyle(Color.ink)
            .lineSpacing(2)
            .padding(.bottom, state.unreadableCount > 0 ? 10 : 16)
            .onAppear { seedDrawDate(from: state) }

        // Non-alarming hint when OCR couldn't read some markers — the member
        // can still add them via type-by-hand. Additive `unreadableCount`.
        if state.unreadableCount > 0 {
            Text("\(state.unreadableCount) \(state.unreadableCount == 1 ? "marker" : "markers") couldn't be read automatically — you can add \(state.unreadableCount == 1 ? "it" : "them") by hand.")
                .font(.arcSans(12))
                .foregroundStyle(Color.arcSecondaryDark)
                .lineSpacing(3)
                .padding(.bottom, 16)
        }

        // Editable draw date — real OCR never reads it, so the member sets it.
        // Wrong-dated backfill would corrupt the RCV/baseline math (readings
        // sort by takenAt), so this drives the confirm submission's `takenAt`.
        drawDateField

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
                let takenAt = BloodworkDrawDate.takenAt(from: drawDate ?? Date())
                Task {
                    let confirmed = await appState.confirmUpload(takenAt: takenAt)
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

    // MARK: Draw date

    /// The editable "Date of draw" control. OCR can't read the draw date, so the
    /// member confirms it here; the DatePicker is capped at today (a draw can't
    /// be in the future) and its value flows into the confirm `takenAt`.
    private var drawDateField: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Date of draw")
                .font(.arcSans(12, weight: .semibold))
                .foregroundStyle(Color.ink)
            Text("When was this blood drawn? Check your report — we can't read the date automatically.")
                .font(.arcSans(11))
                .foregroundStyle(Color.arcSecondaryLight)
                .lineSpacing(2)

            Button { withAnimation { showDatePicker.toggle() } } label: {
                Text(drawDate.map(DataV3Format.shortDate) ?? "Pick the date of the draw")
                    .font(.arcSans(14))
                    .foregroundStyle(drawDate == nil ? Color.arcSecondaryLight : Color.ink)
                    .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
                    .padding(.horizontal, 14)
                    .dataV3Card(radius: 12, border: Color.arcDarkSurface.opacity(0.16))
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)

            if showDatePicker {
                DatePicker(
                    "Date of draw",
                    selection: Binding(
                        get: { drawDate ?? Date() },
                        set: { drawDate = $0 }
                    ),
                    in: ...Date(), // a blood draw is today or earlier
                    displayedComponents: .date
                )
                .datePickerStyle(.graphical)
                .tint(Color.arcDeepGreen)
                .padding(8)
                .dataV3Card(radius: 12)
            }
        }
        .padding(.bottom, 16)
    }

    /// Seed the picker once from the extraction's date (today on the real path;
    /// the parsed document date on the mock path). Idempotent.
    private func seedDrawDate(from state: UploadConfirmState) {
        guard drawDate == nil else { return }
        drawDate = DataV3Format.fromISODay(state.documentDate) ?? Date()
    }

    // MARK: Helpers

    /// Header date — reflects the member's current pick so the "look right?"
    /// line and the picker never disagree.
    private func selectedDateLabel(_ state: UploadConfirmState) -> String {
        if let drawDate { return DataV3Format.shortDate(drawDate) }
        return documentDateLabel(state)
    }

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
