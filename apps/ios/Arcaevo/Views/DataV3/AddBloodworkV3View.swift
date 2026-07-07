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
    /// Member-facing problem preparing/sending the file (too large, unreadable).
    @State private var uploadError: String?

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

            // Photograph a printout → PhotosPicker. The chosen image is
            // downscaled + JPEG-compressed to fit the server's 3 MiB cap, then
            // its bytes are sent for real OCR (see BloodworkMediaEncoder).
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
            } else if let uploadError {
                Text(uploadError)
                    .font(.arcSans(12.5))
                    .foregroundStyle(ArcDataPalette.rust)
                    .multilineTextAlignment(.center)
                    .lineSpacing(3)
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
            guard let item else { return }
            Task { await handlePhoto(item) }
        }
        .fileImporter(isPresented: $showFileImporter, allowedContentTypes: [.pdf]) { result in
            if case .success(let url) = result {
                Task { await handlePDF(url) }
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

    /// Photo path: load the picked image bytes, downscale + JPEG-compress them
    /// under the server's 3 MiB decoded cap (off the main thread), then upload.
    @MainActor
    private func handlePhoto(_ item: PhotosPickerItem) async {
        guard !isUploading else { return }
        isUploading = true
        uploadError = nil
        defer { isUploading = false; photoItem = nil }

        guard let data = try? await item.loadTransferable(type: Data.self) else {
            uploadError = "We couldn't open that photo — try choosing it again."
            return
        }
        // Compression is CPU-heavy (decode + redraw + JPEG) — keep it off main.
        let media = await Task.detached(priority: .userInitiated) {
            BloodworkMediaEncoder.encodePhoto(data)
        }.value
        guard let media else {
            uploadError = "We couldn't prepare that photo — try again in good light, or type the values by hand."
            return
        }
        await runUpload(kind: .photo, fileName: "Photographed printout", media: media)
    }

    /// PDF path: read the picked file's bytes as-is (usually small, text-based).
    /// A scanned-image PDF over the server cap is surfaced honestly rather than
    /// sent to a guaranteed 4xx (on-device PDF recompression is out of scope).
    @MainActor
    private func handlePDF(_ url: URL) async {
        guard !isUploading else { return }
        isUploading = true
        uploadError = nil
        defer { isUploading = false }

        let didAccess = url.startAccessingSecurityScopedResource()
        defer { if didAccess { url.stopAccessingSecurityScopedResource() } }

        guard let data = try? Data(contentsOf: url) else {
            uploadError = "We couldn't open that PDF — try again."
            return
        }
        guard data.count <= BloodworkMediaEncoder.maxDecodedBytes else {
            uploadError = "This file is too large — try a photo of the printout instead."
            return
        }
        let media = BloodworkMedia(mime: "application/pdf", base64: data.base64EncodedString())
        await runUpload(kind: .pdf, fileName: url.lastPathComponent, media: media)
    }

    /// Uploads the prepared bytes via AppState (real OCR; demo fallback offline),
    /// then routes: confirm on success, type-by-hand when the server declines to
    /// auto-read. Nothing enters the timeline until confirmed there.
    @MainActor
    private func runUpload(kind: BloodworkUploadKind, fileName: String?, media: BloodworkMedia?) async {
        switch await appState.beginUpload(kind: kind, fileName: fileName, media: media) {
        case .confirm:
            pushConfirm = true
        case .manualEntry:
            pushManual = true
        case .failed:
            // `appState.authError` carries the offline copy; stay put.
            uploadError = appState.authError
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
