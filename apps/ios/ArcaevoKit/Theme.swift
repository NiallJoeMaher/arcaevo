import SwiftUI

// Brand palette from design_handoff/README.md — shared by iOS + watchOS.
extension Color {
    init(hex: UInt32) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255,
            opacity: 1
        )
    }

    /// Page background.
    static let bone = Color(hex: 0xECE7DD)
    /// Card background.
    static let surface = Color(hex: 0xFBFAF6)
    /// Text / dark sections.
    static let ink = Color(hex: 0x1C2620)
    /// Primary accent, CTAs.
    static let forest = Color(hex: 0x1E5C45)
    /// Highlight green — badges, chart lines, "improved".
    static let vitality = Color(hex: 0x34A07C)
    /// Light vitality tints.
    static let vitalityLight = Color(hex: 0x7FD3AE)
    static let vitalityTint = Color(hex: 0xCFE6DB)
    /// Secondary / warning — "worsened".
    static let amber = Color(hex: 0xD99A4E)
    /// Muted text on light backgrounds.
    static let mutedInk = Color(hex: 0x4A554D)
    /// Muted text on dark backgrounds.
    static let mutedOnDark = Color(hex: 0x8FA89A)
    /// Captions.
    static let caption = Color(hex: 0x7C887F)
    /// Button/text tone on dark ("bone-white").
    static let boneWhite = Color(hex: 0xF4F1EA)
}

enum Brand {
    /// Shown wherever results or insights appear. Wellness, never diagnosis.
    static let disclaimer = "Not a medical device. Not a diagnosis. Consult a doctor."
}

extension RCVVerdict {
    /// Vitality for improved, Amber for worsened, muted for no-real-change.
    var tint: Color {
        switch self {
        case .improved: return .vitality
        case .noRealChange: return .caption
        case .worsened: return .amber
        }
    }
}
