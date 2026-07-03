import Foundation

/// Verbatim plan copy from the prototype logic class (`plans` map) —
/// drives the gate/checkout eyebrows and the plan-aware success screen.
extension Membership.Tier {
    /// "FUSION — €119/YR" — mono eyebrow on gate + checkout.
    var journeyLabel: String {
        switch self {
        case .fusion: return "FUSION — €119/YR"
        case .essential: return "ESSENTIAL — €329/YR"
        case .performance: return "PERFORMANCE — €399/YR"
        }
    }

    /// "€119.00" — checkout line items.
    var checkoutPrice: String {
        switch self {
        case .fusion: return "€119.00"
        case .essential: return "€329.00"
        case .performance: return "€399.00"
        }
    }

    /// Checkout "Included" line.
    var checkoutIncludes: String {
        switch self {
        case .fusion: return "Watch fusion, uploads, insights"
        case .essential: return "Kits, postage, lab & clinician review"
        case .performance: return "Nurse visit, venous panel, priority review"
        }
    }

    /// Success screen step 01 (bold, plan-aware).
    var successStep1: String {
        switch self {
        case .fusion: return "You're live now. Upload any past bloodwork to start your baseline today."
        case .essential: return "Your kit ships today. Track it here — typically 1–2 working days."
        case .performance: return "Book your nurse visit — morning slots, we come to you."
        }
    }

    /// Success screen CTA label (plan-aware routing).
    var successCTA: String {
        switch self {
        case .fusion: return "Upload past bloodwork now"
        case .essential: return "My kit arrived — activate it"
        case .performance: return "Book my nurse visit"
        }
    }
}
