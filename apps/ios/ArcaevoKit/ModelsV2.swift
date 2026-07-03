import Foundation

// MARK: - v2/v3 API shapes (apps/web /api/v1 — zod schemas are the contract)

// MARK: Auth (magic link)

/// `POST /auth/magic-link` → 202. Non-revealing: identical whether or not
/// the email is registered.
struct MagicLinkRequested: Codable, Hashable {
    var ok: Bool
    var message: String
}

/// `POST /auth/magic-link/verify` → a live session.
/// `sessionToken` goes into the keychain and rides as `Authorization: Bearer`.
struct Session: Codable, Hashable {
    struct Member: Codable, Hashable {
        var id: String
        var email: String
        var name: String?
    }

    var ok: Bool
    var member: Member
    var sessionToken: String
    /// True → the GDPR Art. 9 consent gate must be shown next.
    var needsConsent: Bool
}

// MARK: Consents (GDPR Art. 9 — 3 purposes, research off by default)

enum ConsentPurpose: String, Codable, CaseIterable, Hashable {
    /// Required — processing health data at all.
    case healthProcessing = "health_processing"
    /// Required for tests — the clinician reviews results.
    case clinicianReview = "clinician_review"
    /// Optional, OFF by default.
    case research

    var displayName: String {
        switch self {
        case .healthProcessing: return "Process my health data"
        case .clinicianReview: return "Clinician review of my results"
        case .research: return "Anonymised research"
        }
    }

    var isRequired: Bool { self != .research }
}

struct ConsentGrant: Codable, Hashable {
    var purpose: ConsentPurpose
    var granted: Bool
}

/// `GET`/`POST /consents` response.
struct ConsentsState: Codable, Hashable {
    struct Grant: Codable, Hashable {
        var purpose: ConsentPurpose
        var granted: Bool
        var version: String
        var timestamp: Date
        var surface: String
    }

    var version: String
    var consents: [Grant]
    var needsConsent: Bool
    /// Present on GET (nil on POST responses).
    var needsReconsent: Bool?
    /// POST only: withdrawing health_processing starts account closure.
    var closureRequired: Bool?
}

// MARK: Eligibility (the Eircode gate) + waitlist

/// `POST /eligibility/check`. Routing-key-only; nothing stored on pass.
struct EligibilityResult: Codable, Hashable {
    struct FusionAlternative: Codable, Hashable {
        var tier: String
        var priceEur: Int
        var note: String
    }

    var eligible: Bool
    var routingKey: String?
    var county: String?
    var message: String
    /// Present (true) on the fail path — the refusal sells.
    var waitlist: Bool?
    var fusionAlternative: FusionAlternative?
}

/// `POST /waitlist` → county queue position (idempotent per email).
struct WaitlistJoined: Codable, Hashable {
    var ok: Bool
    var alreadyJoined: Bool
    var position: Int
    var county: String
}

/// `GET /waitlist?email=` → position lookup.
struct WaitlistPosition: Codable, Hashable {
    var onWaitlist: Bool
    var position: Int?
    var county: String?
}

// MARK: Bloodwork uploads (AI extraction → user confirms every value)

enum BloodworkUploadKind: String, Codable, Hashable {
    case photo, pdf, manual
}

/// One typed value for `kind: manual` (skips extraction, confidence 1).
struct ManualBloodworkValue: Codable, Hashable {
    var code: String
    var value: Double
    var unit: String
}

/// `POST /uploads/bloodwork` → the confirm screen's data. Nothing enters the
/// timeline until every value is confirmed; low-confidence reads BLOCK.
struct BloodworkExtraction: Codable, Hashable {
    struct Value: Codable, Hashable {
        var code: String
        var name: String
        var unit: String
        var value: Double
        var confidence: Double
        var alternatives: [Double]?
        var lowConfidence: Bool
    }

    struct Flagged: Codable, Hashable {
        var code: String
        var question: String
        var alternatives: [Double]?
    }

    var uploadId: String
    var sourceName: String
    /// "YYYY-MM-DD" document date suggested by the extraction.
    var documentDate: String
    var markersFound: Int
    var values: [Value]
    /// Low-confidence reads ("was this 41 or 47?") — must be resolved
    /// before confirm succeeds.
    var flagged: [Flagged]
}

/// `POST /uploads/bloodwork/confirm` body value.
struct ConfirmedBloodworkValue: Codable, Hashable {
    var code: String
    var value: Double
}

/// Confirm response: readings written as `self_reported` (hollow gold dots).
struct BloodworkConfirmed: Codable, Hashable {
    var ok: Bool
    var uploadId: String
    var readingsAdded: Int
    var source: String
}

// MARK: GP share links

/// One revocable share link (`GET /share`), incl. the access log
/// ("Opened twice — Dublin, 3 July").
struct ShareLinkInfo: Codable, Identifiable, Hashable {
    struct Access: Codable, Hashable {
        var at: Date
        var location: String
    }

    var token: String
    var url: URL
    var createdAt: Date
    var expiresAt: Date
    var revoked: Bool
    var active: Bool
    var accessLog: [Access]
    var openedCount: Int

    var id: String { token }
}

struct ShareLinkList: Codable, Hashable {
    var links: [ShareLinkInfo]
}

/// `POST /share` → a fresh 30-day link.
struct ShareLinkCreated: Codable, Hashable {
    var token: String
    var url: URL
    var expiresAt: Date
}

struct ShareLinkRevoked: Codable, Hashable {
    var ok: Bool
    var revoked: Bool
    var token: String
}
