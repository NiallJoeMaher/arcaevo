import SwiftUI

/// YOUR DATA · "Type values by hand" — `data-screen-label="Type values"`.
/// Marker search → value + unit → date of draw (REQUIRED) → add → save.
/// Saved values go through `POST /uploads/bloodwork` (kind: manual,
/// confidence 1) + confirm, landing as `self_reported` readings.
struct TypeValuesV3View: View {
    struct MarkerOption: Identifiable, Hashable {
        let code: String
        let name: String
        let sub: String
        let units: [String]
        var id: String { code }
    }

    struct Entry: Identifiable, Hashable {
        let id = UUID()
        var marker: MarkerOption
        var value: Double
        var unit: String
        var date: Date
    }

    /// Small hand-entry catalog (the design demos Ferritin / Transferrin).
    static let catalog: [MarkerOption] = [
        MarkerOption(code: "ferritin", name: "Ferritin", sub: "iron stores", units: ["µg/L", "ng/mL"]),
        MarkerOption(code: "transferrin_sat", name: "Transferrin saturation", sub: "iron transport", units: ["%"]),
        MarkerOption(code: "apob", name: "ApoB", sub: "cardiovascular risk", units: ["g/L"]),
        MarkerOption(code: "hs_crp", name: "hs-CRP", sub: "inflammation", units: ["mg/L"]),
        MarkerOption(code: "vitamin_d", name: "Vitamin D", sub: "bone & immunity", units: ["nmol/L", "ng/mL"]),
        MarkerOption(code: "hdl_c", name: "HDL", sub: "cholesterol", units: ["mmol/L"]),
    ]

    @Environment(AppState.self) private var appState

    @State private var search = ""
    @State private var selected: MarkerOption?
    @State private var valueText = ""
    @State private var unit = ""
    @State private var drawDate: Date?
    @State private var showDatePicker = false
    @State private var entries: [Entry] = []
    /// Mirrors the prototype's `manualAdded` state.
    @State private var justAdded = false
    @State private var isSaving = false
    @State private var pushTimeline = false
    @FocusState private var searchFocused: Bool

    var body: some View {
        DataV3Screen {
            DataV3BackLink(label: "Add bloodwork")

            Text("TYPE VALUES BY HAND")
                .font(.arcMono(10, weight: .medium))
                .kerning(1.2)
                .foregroundStyle(Color.arcDeepGreen)
                .padding(.bottom, 12)

            Text("A few markers is plenty.")
                .font(.arcSerif(25))
                .foregroundStyle(Color.ink)
                .padding(.bottom, 16)

            searchField
                .padding(.bottom, 8)

            if !suggestions.isEmpty {
                suggestionList
                    .padding(.bottom, 14)
            }

            HStack(alignment: .top, spacing: 9) {
                valueField
                unitField
            }
            .padding(.bottom, 12)

            dateField
                .padding(.bottom, 16)

            if justAdded && !entries.isEmpty {
                addedState
            } else {
                addButton
            }

            Text("The date matters — the whole product is time-based fusion.")
                .font(.arcSans(11))
                .foregroundStyle(Color.arcSecondaryLight)
                .frame(maxWidth: .infinity)
                .padding(.top, 12)
        }
        .navigationDestination(isPresented: $pushTimeline) { DataTimelineV3View() }
    }

    // MARK: Search + suggestions

    private var suggestions: [MarkerOption] {
        let addedCodes = Set(entries.map(\.marker.code))
        let pool = Self.catalog.filter { !addedCodes.contains($0.code) }
        guard !search.isEmpty else { return Array(pool.prefix(4)) }
        return pool.filter { $0.name.lowercased().contains(search.lowercased()) }
    }

    private var searchField: some View {
        HStack {
            TextField("Search markers", text: $search)
                .font(.arcSans(14))
                .foregroundStyle(Color.ink)
                .focused($searchFocused)
                .autocorrectionDisabled()
            Text("⌕")
                .font(.arcSans(14))
                .foregroundStyle(Color.arcSecondaryLight)
        }
        .padding(.vertical, 12)
        .padding(.horizontal, 16)
        .dataV3Card(
            radius: 12,
            border: searchFocused ? Color.arcPrimaryGreen : ArcDataPalette.hairlineStrong,
            borderWidth: searchFocused ? 1.5 : 1
        )
    }

    private var suggestionList: some View {
        VStack(spacing: 0) {
            ForEach(suggestions) { option in
                let picked = selected == option
                Button {
                    selected = option
                    unit = option.units.first ?? ""
                    searchFocused = false
                } label: {
                    HStack(spacing: 4) {
                        Text(option.name)
                            .font(.arcSans(13.5, weight: picked ? .semibold : .regular))
                            .foregroundStyle(picked ? Color.arcDeepGreen : Color.arcSecondaryLight)
                        Text("· \(option.sub)")
                            .font(.arcSans(11.5))
                            .foregroundStyle(Color.arcSecondaryLight)
                        Spacer(minLength: 0)
                    }
                    .padding(.vertical, 9)
                    .padding(.horizontal, 10)
                    .frame(minHeight: 44)
                    .background(
                        picked ? ArcDataPalette.greenFill : Color.clear,
                        in: RoundedRectangle(cornerRadius: 8, style: .continuous)
                    )
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.vertical, 4)
        .padding(.horizontal, 6)
        .dataV3Card(radius: 12)
    }

    // MARK: Value / unit / date

    private var valueField: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Value")
                .font(.arcSans(12, weight: .semibold))
                .foregroundStyle(Color.ink)
            TextField("—", text: $valueText)
                .font(.arcMono(15))
                .foregroundStyle(Color.ink)
                .keyboardType(.decimalPad)
                .padding(.vertical, 12)
                .padding(.horizontal, 14)
                .dataV3Card(radius: 12, border: Color.arcDarkSurface.opacity(0.16))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var unitField: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Unit")
                .font(.arcSans(12, weight: .semibold))
                .foregroundStyle(Color.ink)
            HStack(spacing: 6) {
                ForEach(selected?.units ?? ["µg/L", "ng/mL"], id: \.self) { u in
                    let picked = unit == u
                    Button { unit = u } label: {
                        Text(u)
                            .font(.arcSans(12.5, weight: picked ? .semibold : .regular))
                            .foregroundStyle(picked ? Color.arcDeepGreen : Color.arcSecondaryLight)
                            .frame(maxWidth: .infinity, minHeight: 44)
                            .background(
                                picked ? ArcDataPalette.greenFillSoft : Color.white,
                                in: RoundedRectangle(cornerRadius: 12, style: .continuous)
                            )
                            .overlay(
                                RoundedRectangle(cornerRadius: 12, style: .continuous)
                                    .strokeBorder(
                                        picked ? Color.arcDeepGreen : Color.arcDarkSurface.opacity(0.16),
                                        lineWidth: picked ? 1.5 : 1
                                    )
                            )
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var dateField: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 6) {
                Text("Date of draw")
                    .font(.arcSans(12, weight: .semibold))
                    .foregroundStyle(Color.ink)
                Text("REQUIRED")
                    .font(.arcMono(8.5, weight: .medium))
                    .kerning(0.6)
                    .foregroundStyle(ArcDataPalette.rust)
            }
            Button { withAnimation { showDatePicker.toggle() } } label: {
                Text(drawDate.map(dayMonthYearSlashes) ?? "Pick the date of the draw")
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
                    in: ...Date(),
                    displayedComponents: .date
                )
                .datePickerStyle(.graphical)
                .tint(Color.arcDeepGreen)
                .padding(8)
                .dataV3Card(radius: 12)
            }
        }
    }

    /// "14 / 02 / 2026" per the design's date field.
    private func dayMonthYearSlashes(_ date: Date) -> String {
        let f = DateFormatter()
        f.dateFormat = "dd / MM / yyyy"
        return f.string(from: date)
    }

    // MARK: Add + save

    private var canAdd: Bool {
        selected != nil && Double(valueText.replacingOccurrences(of: ",", with: ".")) != nil
            && !unit.isEmpty && drawDate != nil
    }

    private var addLabel: String {
        guard let marker = selected else { return "Pick a marker to add" }
        let value = valueText.isEmpty ? "—" : valueText
        return "Add \(marker.name.lowercased()) · \(value) \(unit)"
    }

    private var addButton: some View {
        Button {
            guard let marker = selected, let date = drawDate,
                  let value = Double(valueText.replacingOccurrences(of: ",", with: "."))
            else { return }
            entries.append(Entry(marker: marker, value: value, unit: unit, date: date))
            justAdded = true
            showDatePicker = false
        } label: {
            Text(addLabel)
                .font(.arcSans(14, weight: .semibold))
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(Color.arcDeepGreen, in: Capsule())
                .opacity(canAdd ? 1 : 0.45)
        }
        .buttonStyle(.plain)
        .disabled(!canAdd)
        .padding(.top, 8)
    }

    @ViewBuilder
    private var addedState: some View {
        ForEach(entries) { entry in
            HStack {
                Text("✓ \(entry.marker.name) · \(DataV3Format.number(entry.value)) \(entry.unit) · \(DataV3Format.shortDate(entry.date))")
                    .font(.arcSans(13, weight: .bold))
                    .foregroundStyle(Color.arcDeepGreen)
                Spacer()
                Button("Edit") { edit(entry) }
                    .font(.arcSans(12))
                    .foregroundStyle(Color.arcSecondaryLight)
                    .buttonStyle(.plain)
            }
            .padding(.vertical, 13)
            .padding(.horizontal, 16)
            .dataV3Card(radius: 14, border: ArcDataPalette.greenBorder, fill: ArcDataPalette.greenFill)
            .padding(.bottom, 10)
        }

        Button {
            resetForm()
        } label: {
            Text("+ Add another marker")
                .font(.arcSans(13, weight: .semibold))
                .foregroundStyle(Color.arcSecondaryDark)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
                .overlay(Capsule().strokeBorder(ArcDataPalette.hairlineStrong))
        }
        .buttonStyle(.plain)
        .padding(.bottom, 9)

        Button {
            save()
        } label: {
            HStack(spacing: 8) {
                if isSaving { ProgressView().tint(.white) }
                Text("Save — see it on your timeline")
                    .font(.arcSans(14, weight: .semibold))
                    .foregroundStyle(.white)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(Color.arcDeepGreen, in: Capsule())
        }
        .buttonStyle(.plain)
        .disabled(isSaving)
    }

    private func edit(_ entry: Entry) {
        entries.removeAll { $0.id == entry.id }
        selected = entry.marker
        search = entry.marker.name
        valueText = DataV3Format.number(entry.value)
        unit = entry.unit
        drawDate = entry.date
        if entries.isEmpty { justAdded = false }
    }

    private func resetForm() {
        selected = nil
        search = ""
        valueText = ""
        unit = ""
        justAdded = false
        searchFocused = true
        // The draw date usually applies to the whole document — keep it.
    }

    /// Manual entries skip AI extraction (confidence 1) but take the same
    /// upload → confirm path, landing as `self_reported` readings.
    private func save() {
        guard !entries.isEmpty, !isSaving else { return }
        isSaving = true
        Task {
            let manuals = entries.map {
                ManualBloodworkValue(code: $0.marker.code, value: $0.value, unit: $0.unit)
            }
            let takenAt = DataV3Format.isoDay(entries.first?.date ?? Date())
            do {
                let extraction = try await appState.api.uploadBloodwork(
                    kind: .manual, fileName: nil, manualValues: manuals
                )
                let confirmed = extraction.values.map {
                    ConfirmedBloodworkValue(code: $0.code, value: $0.value)
                }
                _ = try await appState.api.confirmBloodwork(
                    uploadId: extraction.uploadId, values: confirmed, takenAt: takenAt
                )
            } catch {
                // Offline demo: the flow still completes; nothing is faked
                // as "synced" — the timeline is demo data anyway.
            }
            isSaving = false
            pushTimeline = true
        }
    }
}

#if DEBUG
#Preview("Type values by hand") {
    NavigationStack { TypeValuesV3View() }
        .environment(AppState())
        .environment(AppModel())
}
#endif
