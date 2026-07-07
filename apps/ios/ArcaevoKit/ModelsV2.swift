import Foundation

// MARK: - v2/v3 API shapes (apps/web /api/v1 — zod schemas are the contract)

// MARK: App config (public feature gates — no auth)

/// `GET /api/v1/config` (public, no auth) — server-controlled feature gates.
///
/// `bloodTiersEnabled` gates the paid BLOOD-TESTING tiers (Essential €329 /
/// Performance €399) and the testing journey (Eircode gate, activate-kit,
/// nurse-booking, venous draw). While the lab/clinician partners don't exist,
/// production returns `false` so the app offers ONLY the Fusion tier.
///
/// FAIL-SAFE: the custom decoder defaults a missing/garbled field to `false`,
/// so an unknown flag never renders the blood tiers as purchasable.
struct AppConfig: Codable, Hashable {
    var bloodTiersEnabled: Bool

    init(bloodTiersEnabled: Bool = false) {
        self.bloodTiersEnabled = bloodTiersEnabled
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        // decodeIfPresent → false: a `{}` body, a null, or an absent field all
        // resolve to the safe default rather than throwing.
        bloodTiersEnabled = try container.decodeIfPresent(Bool.self, forKey: .bloodTiersEnabled) ?? false
    }
}

// MARK: Biomarker rules (public canonical RCV thresholds — no auth)

/// One rule row from `GET /api/v1/biomarker-rules` — the CANONICAL RCV
/// threshold (the % a marker must move before a change is "real"). The web
/// side owns these numbers (`apps/web/src/lib/biomarker-rules.ts`); the app
/// fetches them so the two engines can't disagree, and falls back to the
/// matching hardcoded `BiomarkerRuleLite.defaults` when offline.
struct ServerBiomarkerRule: Codable, Hashable {
    var code: String
    var rcvPercent: Double
    var unit: String?
    var direction: String?
}

/// `GET /api/v1/biomarker-rules` → `{ "rules": [...] }`.
struct BiomarkerRulesResponse: Codable, Hashable {
    var rules: [ServerBiomarkerRule]

    /// `code → rcvPercent` (lowercased codes) for merging onto the defaults.
    var rcvPercentByCode: [String: Double] {
        Dictionary(rules.map { ($0.code.lowercased(), $0.rcvPercent) }, uniquingKeysWith: { _, last in last })
    }
}

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

/// Real-OCR media for a photo/PDF upload: the raw bytes as a MIME type + a
/// STANDARD base64 string. Matches the server's `BloodworkMediaInput`
/// (`apps/web/src/lib/models.ts`): the mime must be one of `image/jpeg`,
/// `image/png`, `application/pdf`, and the base64 must decode to ≤ 3 MiB.
/// GDPR Art.9 health data — sent once, in-flight only; NEVER persisted by the
/// app (kept out of the UserDefaults snapshot; see AppState `uploadConfirm`).
struct BloodworkMedia: Codable, Hashable, Sendable {
    var mime: String
    var base64: String
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

    /// nil on the honest manual-entry response (no confirm screen to build).
    var uploadId: String?
    /// nil on the honest manual-entry response.
    var sourceName: String?
    /// "YYYY-MM-DD" document date. NULLABLE: real OCR doesn't read the draw
    /// date, so the server sends `null` and the member sets it at confirm.
    var documentDate: String?
    var markersFound: Int
    var values: [Value]
    /// Low-confidence reads ("was this 41 or 47?") — must be resolved
    /// before confirm succeeds.
    var flagged: [Flagged]
    /// Server signalled it couldn't reliably read the document — re-submit as
    /// `kind:"manual"` (the app routes the member to type-by-hand).
    var manualEntryRequired: Bool? = nil
    /// Additive: N markers the OCR saw but couldn't trust — shown as a
    /// non-alarming hint on the confirm screen ("add them by hand").
    var unreadableCount: Int? = nil

    /// True when the server declined to extract (production with no OCR, or
    /// OCR found nothing legible) — there is no confirm payload to show.
    var isManualEntryRequired: Bool { manualEntryRequired == true || uploadId == nil }
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

// MARK: Clinician note (Phase 22 — a human note on EVERY reviewed panel)

/// The short human-written note Dr. Nolan leaves on every reviewed panel —
/// template-assisted, but a person signs it (name + IMC number + read date).
/// Field names are locked in the Phase 22 shared contract; the web embeds
/// this on the results payload per reviewed panel and `APIClient.results()`
/// decodes it via `BiomarkerReading.clinicianNote`.
struct ClinicianNote: Codable, Hashable {
    var text: String
    var clinicianName: String
    var imcNumber: String
    var readAt: Date?
    /// Optional linkage the web may include (`panelKey/orderId`).
    var panelKey: String?
    var orderId: String?
}

// MARK: Recheck order (Phase 22 — the €69 kit, the ONLY sell)

/// Client shape for the €69 recheck kit — closing the experiment → recheck →
/// verdict loop. Maps onto the EXISTING add-on order path (`POST /orders`
/// with `isAddOn: true`); no new endpoint. Never a supplement.
struct RecheckOrder: Codable, Hashable {
    /// Marker code being rechecked, e.g. "ferritin".
    var markerId: String
    /// The experiment whose verdict the recheck closes, when there is one.
    var experimentId: String?
    /// Contractual price — always €69 for the recheck kit.
    var priceEur: Int

    static let recheckPriceEur = 69

    init(markerId: String, experimentId: String? = nil, priceEur: Int = RecheckOrder.recheckPriceEur) {
        self.markerId = markerId
        self.experimentId = experimentId
        self.priceEur = priceEur
    }

    /// The existing add-on order path this maps to.
    func asCreateOrderRequest(markerName: String) -> CreateOrderRequest {
        CreateOrderRequest(kind: .kit, panel: "Recheck — \(markerName)", isAddOn: true)
    }
}

// MARK: Watch session (golden-watch-login handoff)

/// `POST /auth/watch-session` — PHONE-authed (the member session bearer).
/// Mints a device-scoped, INDEPENDENTLY REVOCABLE watch token. The phone
/// hands `watchSessionToken` to the watch over WatchConnectivity
/// (`updateApplicationContext`); the watch then uses it as its own Bearer.
struct WatchSessionMinted: Codable, Hashable {
    var watchSessionToken: String
    var expiresAt: Date
    var device: String
}

/// `POST /auth/session/refresh` — WATCH-authed (the watch token bearer).
/// 200 slides expiry and returns the member (so the wrist works over
/// LTE/Wi-Fi with the phone away); 401 `{error:"session_invalid"}` when the
/// token is dead → the watch clears it and shows the "open iPhone" state.
struct WatchSessionRefreshed: Codable, Hashable {
    struct Member: Codable, Hashable {
        var id: String
        var name: String?
        var email: String?
    }

    var member: Member
    var device: String?
    var expiresAt: Date
}
