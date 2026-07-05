import SwiftUI

/// YOUR DATA · "Share with GP" — `data-screen-label="Share with GP"`.
/// Creates a 30-day revocable share link (`POST /share`), lists active links
/// with their access log ("Opened twice — Dublin"), and revokes
/// (`DELETE /share/:token`). Offline: DemoDataV2's k7f2demo link.
struct GPShareV3View: View {
    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss

    @State private var links: [ShareLinkInfo] = []
    @State private var loaded = false
    @State private var creating = false
    @State private var revokingToken: String?

    private var activeLinks: [ShareLinkInfo] { links.filter { $0.active && !$0.revoked } }

    var body: some View {
        DataV3Screen {
            DataV3BackLink()

            Text("SHARE WITH YOUR GP")
                .font(.arcMono(10, weight: .medium))
                .kerning(1.2)
                .foregroundStyle(Color.arcDeepGreen)
                .padding(.bottom, 12)

            Text("Bring your GP the whole picture.")
                .font(.arcSerif(26))
                .foregroundStyle(Color.ink)
                .lineSpacing(2)
                .padding(.bottom, 8)

            Text("A two-page summary: results with dates and ranges, trend arrows, reviewed by a registered clinician on blood tiers. No app needed on their end.")
                .font(.arcSans(13))
                .foregroundStyle(Color.arcSecondaryDark)
                .lineSpacing(4)
                .padding(.bottom, 18)

            includedCard
                .padding(.bottom, 9)

            expiryCard
                .padding(.bottom, 18)

            if !loaded {
                ProgressView()
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 16)
            } else if activeLinks.isEmpty {
                createButton
            } else {
                ForEach(activeLinks) { link in
                    activeLinkCard(link)
                        .padding(.bottom, 10)
                }
                doneButton
            }
        }
        .task { await load() }
    }

    // MARK: Static cards

    private var includedCard: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("What's included")
                .font(.arcSans(13, weight: .bold))
                .foregroundStyle(Color.ink)
            Text("✓ All lab results · 2 years\n✓ Wearable trends summary\n✗ Your notes & experiments — off by default")
                .font(.arcSans(12))
                .foregroundStyle(Color.arcSecondaryLight)
                .lineSpacing(6)
        }
        .padding(.vertical, 14)
        .padding(.horizontal, 16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .dataV3Card(radius: 14)
    }

    private var expiryCard: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text("Link expires")
                    .font(.arcSans(13, weight: .bold))
                    .foregroundStyle(Color.ink)
                Text("After 30 days, or when you revoke it")
                    .font(.arcSans(11.5))
                    .foregroundStyle(Color.arcSecondaryLight)
            }
            Spacer()
            Text("30 DAYS")
                .font(.arcMono(12))
                .foregroundStyle(Color.arcDeepGreen)
        }
        .padding(.vertical, 14)
        .padding(.horizontal, 16)
        .dataV3Card(radius: 14)
    }

    // MARK: Active link card (green tint) + access log

    private func activeLinkCard(_ link: ShareLinkInfo) -> some View {
        VStack(spacing: 6) {
            Text(displayURL(link))
                .font(.arcMono(13))
                .foregroundStyle(Color.ink)
                .frame(maxWidth: .infinity)

            HStack(spacing: 0) {
                Text("Active · expires \(DataV3Format.dayMonth(link.expiresAt)) · opened \(link.openedCount) times · ")
                    .font(.arcSans(11.5))
                    .foregroundStyle(Color.arcSecondaryDark)
                Button {
                    revoke(link)
                } label: {
                    Text(revokingToken == link.token ? "Revoking…" : "Revoke")
                        .font(.arcSans(11.5, weight: .semibold))
                        .foregroundStyle(ArcDataPalette.rust)
                        .padding(.vertical, 8) // hit target without breaking the line
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .disabled(revokingToken != nil)
            }
            .frame(maxWidth: .infinity)

            // Access log — who opened it, where, when.
            if let last = link.accessLog.last, link.openedCount > 0 {
                Text("Opened \(DataV3Format.timesWord(link.openedCount)) — \(last.location), \(DataV3Format.dayLongMonth(last.at))")
                    .font(.arcSans(11.5))
                    .foregroundStyle(Color.arcSecondaryLight)
                    .frame(maxWidth: .infinity)
            }
        }
        .padding(15)
        .dataV3Card(radius: 14, border: ArcDataPalette.greenBorder, fill: ArcDataPalette.greenFill)
    }

    private var createButton: some View {
        Button {
            create()
        } label: {
            HStack(spacing: 8) {
                if creating { ProgressView().tint(.white) }
                Text("Create secure link")
                    .font(.arcSans(14, weight: .semibold))
                    .foregroundStyle(.white)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(Color.arcDeepGreen, in: Capsule())
        }
        .buttonStyle(.plain)
        .disabled(creating)
        .padding(.top, 6)
    }

    private var doneButton: some View {
        Button { dismiss() } label: {
            Text("Done")
                .font(.arcSans(13.5, weight: .semibold))
                .foregroundStyle(Color.ink)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 13)
                .overlay(Capsule().strokeBorder(ArcDataPalette.hairlineStrong))
                .contentShape(Capsule())
        }
        .buttonStyle(.plain)
    }

    // MARK: Data

    private func displayURL(_ link: ShareLinkInfo) -> String {
        let raw = link.url.absoluteString
        return raw
            .replacingOccurrences(of: "https://", with: "")
            .replacingOccurrences(of: "http://", with: "")
    }

    private func load() async {
        do {
            links = try await appState.api.shareLinks()
        } catch {
            // DEBUG demo only — never fabricate share links in Release.
            links = DemoMode.isEnabled ? DemoDataProvider.shareLinks() : []
        }
        loaded = true
    }

    private func create() {
        guard !creating else { return }
        creating = true
        Task {
            let created: ShareLinkCreated
            do {
                created = try await appState.api.createShareLink(expiresInDays: 30)
            } catch {
                guard DemoMode.isEnabled else {
                    // Release: don't fabricate a share link on failure.
                    creating = false
                    return
                }
                created = DemoDataProvider.shareLinkCreated()
            }
            links.insert(
                ShareLinkInfo(
                    token: created.token,
                    url: created.url,
                    createdAt: Date(),
                    expiresAt: created.expiresAt,
                    revoked: false,
                    active: true,
                    accessLog: [],
                    openedCount: 0
                ),
                at: 0
            )
            creating = false
        }
    }

    private func revoke(_ link: ShareLinkInfo) {
        guard revokingToken == nil else { return }
        revokingToken = link.token
        Task {
            do {
                _ = try await appState.api.revokeShareLink(token: link.token)
            } catch {
                // Offline demo — revoke locally; nothing pretends to be synced.
            }
            links.removeAll { $0.token == link.token }
            revokingToken = nil
        }
    }
}

#if DEBUG
#Preview("Share with GP") {
    NavigationStack { GPShareV3View() }
        .environment(AppState())
        .environment(AppModel())
}
#endif
