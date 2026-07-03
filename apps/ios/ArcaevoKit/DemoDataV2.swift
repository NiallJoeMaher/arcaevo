import Foundation

/// Offline stand-ins for the v2 endpoints, so every new flow demos without
/// the backend. Deterministic, and shaped exactly like the API responses.
/// Mirrors the prototype's state spec (Prototype.dc.html logic class):
/// Dublin passes the gate, Cork fails to a waitlist position, the demo
/// upload contains the "41 or 47?" flagged ferritin read.
extension DemoDataProvider {

    // MARK: Auth

    static let demoSessionToken = "demo-session-token"

    static func session(needsConsent: Bool = true) -> Session {
        Session(
            ok: true,
            member: .init(id: "demo-member-1", email: "aoife@example.com", name: "Aoife Byrne"),
            sessionToken: demoSessionToken,
            needsConsent: needsConsent
        )
    }

    static func magicLinkRequested(email: String) -> MagicLinkRequested {
        MagicLinkRequested(
            ok: true,
            message: "If \(email.lowercased()) has an account, a sign-in link is on its way. It's valid for 30 minutes."
        )
    }

    // MARK: Consents

    static func consentsState(
        grants: [ConsentGrant] = [
            ConsentGrant(purpose: .healthProcessing, granted: true),
            ConsentGrant(purpose: .clinicianReview, granted: true),
            ConsentGrant(purpose: .research, granted: false),
        ]
    ) -> ConsentsState {
        ConsentsState(
            version: "2026-07-01",
            consents: grants.map {
                .init(
                    purpose: $0.purpose,
                    granted: $0.granted,
                    version: "2026-07-01",
                    timestamp: Date(),
                    surface: "ios"
                )
            },
            needsConsent: false,
            needsReconsent: false,
            closureRequired: grants.contains { $0.purpose == .healthProcessing && !$0.granted }
        )
    }

    // MARK: Eligibility + waitlist (launch allowlist = Dublin routing keys)

    private static let demoAllowedKeys: Set<String> = [
        "D01", "D02", "D03", "D04", "D05", "D06", "D07", "D08", "D09", "D10",
        "D11", "D12", "D13", "D14", "D15", "D16", "D17", "D18", "D20", "D22",
        "D24", "D6W", "A94", "A96", "K32", "K34", "K36", "K45", "K56", "K67", "K78",
    ]

    private static func routingKey(from eircode: String) -> String {
        var key = eircode.uppercased().replacingOccurrences(of: " ", with: "")
        key = String(key.prefix(3))
        return key
    }

    static func eligibility(eircode: String) -> EligibilityResult {
        let key = routingKey(from: eircode)
        if demoAllowedKeys.contains(key) {
            return EligibilityResult(
                eligible: true,
                routingKey: key,
                county: "Dublin",
                message: "You're in the Dublin service area",
                waitlist: nil,
                fusionAlternative: nil
            )
        }
        let county = key.hasPrefix("T") ? "Cork" : "Ireland"
        return EligibilityResult(
            eligible: false,
            routingKey: key,
            county: county,
            message: "Not in \(county) yet — but you're next.",
            waitlist: true,
            fusionAlternative: .init(
                tier: "fusion",
                priceEur: 119,
                note: "Fusion works anywhere: your watch + any past bloodwork."
            )
        )
    }

    static func waitlistJoined(eircode: String) -> WaitlistJoined {
        let key = routingKey(from: eircode)
        return WaitlistJoined(
            ok: true,
            alreadyJoined: false,
            position: 2,
            county: key.hasPrefix("T") ? "Cork" : "Ireland"
        )
    }

    // MARK: Bloodwork upload → confirm (the "41 or 47?" story)

    static func bloodworkExtraction(fileName: String?) -> BloodworkExtraction {
        BloodworkExtraction(
            uploadId: "demo-upload-1",
            sourceName: fileName ?? "GP results, February 2025",
            documentDate: "2025-02-14",
            markersFound: 3,
            values: [
                .init(code: "apob", name: "ApoB", unit: "g/L", value: 1.21, confidence: 0.97, alternatives: nil, lowConfidence: false),
                .init(code: "hs_crp", name: "hs-CRP", unit: "mg/L", value: 1.1, confidence: 0.94, alternatives: nil, lowConfidence: false),
                // The prototype's blocking read: low confidence, 41 or 47?
                .init(code: "ferritin", name: "Ferritin", unit: "µg/L", value: 41, confidence: 0.52, alternatives: [41, 47], lowConfidence: true),
            ],
            flagged: [
                .init(code: "ferritin", question: "Low confidence — was this 41 or 47?", alternatives: [41, 47]),
            ]
        )
    }

    static func bloodworkConfirmed(uploadId: String, count: Int) -> BloodworkConfirmed {
        BloodworkConfirmed(ok: true, uploadId: uploadId, readingsAdded: count, source: "self_reported")
    }

    // MARK: GP share links

    static func shareLinks() -> [ShareLinkInfo] {
        let created = Calendar.current.date(byAdding: .day, value: -4, to: Date()) ?? Date()
        let expires = Calendar.current.date(byAdding: .day, value: 26, to: Date()) ?? Date()
        let opened = Calendar.current.date(byAdding: .day, value: -1, to: Date()) ?? Date()
        return [
            ShareLinkInfo(
                token: "k7f2demo",
                url: URL(string: "https://arcaevo.com/s/k7f2demo")!,
                createdAt: created,
                expiresAt: expires,
                revoked: false,
                active: true,
                accessLog: [
                    .init(at: opened, location: "Dublin"),
                    .init(at: opened.addingTimeInterval(3600), location: "Dublin"),
                ],
                openedCount: 2
            ),
        ]
    }

    static func shareLinkCreated() -> ShareLinkCreated {
        ShareLinkCreated(
            token: "demo-\(UUID().uuidString.prefix(6))",
            url: URL(string: "https://arcaevo.com/s/demo")!,
            expiresAt: Calendar.current.date(byAdding: .day, value: 30, to: Date()) ?? Date()
        )
    }
}
