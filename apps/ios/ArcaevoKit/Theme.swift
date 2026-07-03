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

    // MARK: v3 tokens (design_handoff_ios_watch/README.md)

    /// Dark surface — member app, watch, timeline screens.
    static let arcDarkSurface = Color(hex: 0x1C2620)
    /// Cream — light screens background / dark-screen text.
    static let arcCream = Color(hex: 0xF4F1EA)
    /// Primary green — accents, toggles-on, positive.
    static let arcPrimaryGreen = Color(hex: 0x34A07C)
    /// Deep green — eyebrow labels, primary buttons on light.
    static let arcDeepGreen = Color(hex: 0x1E5C45)
    /// Bright green — active states on dark.
    static let arcBrightGreen = Color(hex: 0x7FD3AE)
    /// Muted green-grey — secondary text on dark.
    static let arcMutedOnDark = Color(hex: 0x8FA89A)
    /// Secondary text on light (lighter of the pair).
    static let arcSecondaryLight = Color(hex: 0x7C887F)
    /// Secondary text on light (darker of the pair).
    static let arcSecondaryDark = Color(hex: 0x4A554D)
    /// Self-reported data points — hollow gold dots, visually distinct
    /// from lab values forever.
    static let arcHollowGold = Color(hex: 0xD9C9A4)
    /// Rail / tertiary text tones on dark.
    static let arcRailLight = Color(hex: 0xCFD6CF)
    static let arcRailDim = Color(hex: 0x5E6E64)
    /// Member tab-bar background (slightly darker than the dark surface).
    static let arcTabBarSurface = Color(hex: 0x141B17)
    /// Warning / "worsened" amber used on flagged chat borders etc.
    static let arcAmber = Color(hex: 0xD99A4E)
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
