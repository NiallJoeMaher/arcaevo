import SwiftUI
import PhotosUI
import UniformTypeIdentifiers

/// YOUR DATA · "Add bloodwork" — Prototype.dc.html `data-screen-label="Add bloodwork"`.
/// Photo / PDF / manual choice; photo + PDF run the mock AI extraction
/// (`POST /uploads/bloodwork`) then push the confirm screen.
struct AddBloodworkV3View: View {
    @Environment(AppState.self) private var appState

    @State private var photoItem: PhotosPickerItem?
    @State private var showFileImporter = false
    @State private var isUploading = false
    @State private var pushConfirm = false
    @State private var pushManual = false

    var body: some View {
        DataV3Screen {
            DataV3BackLink()

            Text("ADD BLOODWORK")
                .font(.arcMono(10, weight: .medium))
                .kerning(1.2)
                .foregroundStyle(Color.arcDeepGreen)
                .padding(.bottom, 12)

            Text("Got old results? They still count.")
                .font(.arcSerif(27))
                .foregroundStyle(Color.ink)
                .lineSpacing(2)
                .padding(.bottom, 8)

            Text("A GP letter, a hospital printout, a PDF from another service — AI reads them all, and you approve every number.")
                .font(.arcSans(13))
                .foregroundStyle(Color.arcSecondaryDark)
                .lineSpacing(4)
                .padding(.bottom, 20)

            // Photograph a printout → PhotosPicker (camera-roll stand-in;
            // the mock extraction doesn't need real bytes).
            PhotosPicker(selection: $photoItem, matching: .images) {
                optionCard(glyph: "⌗", title: "Photograph a printout", sub: "Best in daylight, flat on a table")
            }
            .buttonStyle(.plain)
            .padding(.bottom, 10)

            // Upload a PDF → fileImporter.
            Button { showFileImporter = true } label: {
                optionCard(glyph: "▤", title: "Upload a PDF", sub: "From Files, Mail or another app")
            }
            .buttonStyle(.plain)
            .padding(.bottom, 10)

            // Type values by hand → manual entry screen.
            Button { pushManual = true } label: {
                optionCard(glyph: "✎", title: "Type values by hand", sub: "Just a few markers? Faster to type")
            }
            .buttonStyle(.plain)
            .padding(.bottom, 18)

            if isUploading {
                HStack(spacing: 8) {
                    ProgressView()
                    Text("Reading your document…")
                        .font(.arcSans(12.5))
                        .foregroundStyle(Color.arcSecondaryDark)
                }
                .frame(maxWidth: .infinity)
                .padding(.bottom, 18)
            }

            Text("Processed in the EU · the original file is yours to delete anytime")
                .font(.arcSans(11.5))
                .foregroundStyle(Color.arcSecondaryLight)
                .multilineTextAlignment(.center)
                .lineSpacing(3)
                .frame(maxWidth: .infinity)
                .padding(.top, 24)
        }
        .onChange(of: photoItem) { _, item in
            guard item != nil else { return }
            beginUpload(kind: .photo, fileName: "Photographed printout")
        }
        .fileImporter(isPresented: $showFileImporter, allowedContentTypes: [.pdf]) { result in
            if case .success(let url) = result {
                beginUpload(kind: .pdf, fileName: url.lastPathComponent)
            }
        }
        .navigationDestination(isPresented: $pushConfirm) { ConfirmReadingV3View() }
        .navigationDestination(isPresented: $pushManual) { TypeValuesV3View() }
    }

    private func optionCard(glyph: String, title: String, sub: String) -> some View {
        HStack(alignment: .center, spacing: 13) {
            Text(glyph)
                .font(.arcSans(19))
                .foregroundStyle(Color.ink)
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.arcSans(14, weight: .bold))
                    .foregroundStyle(Color.ink)
                Text(sub)
                    .font(.arcSans(11.5))
                    .foregroundStyle(Color.arcSecondaryLight)
            }
            Spacer(minLength: 0)
        }
        .padding(16)
        .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
        .dataV3Card(radius: 15)
        .contentShape(RoundedRectangle(cornerRadius: 15))
    }

    /// Uploads via AppState (mock AI extraction; demo fallback offline),
    /// then pushes the confirm screen. Nothing enters the timeline until
    /// every extracted value is confirmed there.
    private func beginUpload(kind: BloodworkUploadKind, fileName: String?) {
        guard !isUploading else { return }
        isUploading = true
        Task {
            await appState.beginUpload(kind: kind, fileName: fileName)
            isUploading = false
            photoItem = nil
            pushConfirm = true
        }
    }
}

#if DEBUG
#Preview("Add bloodwork") {
    NavigationStack { AddBloodworkV3View() }
        .environment(AppState())
        .environment(AppModel())
}
#endif
