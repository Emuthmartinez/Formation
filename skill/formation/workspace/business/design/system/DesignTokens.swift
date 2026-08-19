// design-token-hash: 1733e29983a172fb
import Foundation

enum DesignTokens {
  enum Color {
    static let background = "#f7f3ec"
    static let surface = "#fffdfa"
    static let primary = "#0c7c59"
    static let accent = "#ff6f5c"
    static let text = "#161512"
  }
  enum Font {
    static let displayFamily = "Fraunces, Georgia, serif"
    static let bodyFamily = "Source Sans 3, Avenir Next, sans-serif"
  }
  enum Radius {
    static let sm = "4px"
    static let md = "8px"
    static let lg = "14px"
  }
  // Cross-platform motion contract. Durations are SwiftUI seconds (Double).
  // framer-motion/motion consumes the CSS-variable form; SwiftUI/Flutter consume these.
  enum Motion {
    static let durationFast: Double = 0.12
    static let durationBase: Double = 0.22
    static let durationSlow: Double = 0.36
    // Celebrate-family spring duration: earned moments only, carried by the
    // PremiumMotion.celebrate / .celebrateLanding presets (PremiumCraft.swift).
    static let durationCelebrate: Double = 0.5
    static let reducedMotionDuration: Double = 0.0
    static let easing = "cubic-bezier(0.2, 0, 0, 1)"
    // Landing/web cinematic lane tokens. The mobile binary keeps to the
    // 120-360ms micro-motion band above; these ship so cross-surface tools
    // read one timing contract (see knowledge/design/landing-motion-craft.md).
    static let durationReveal: Double = 0.6
    static let durationCinematic: Double = 1.2
    static let stagger: Double = 0.06
    static let easingEmphasis = "cubic-bezier(0.16, 1, 0.3, 1)"
    static let easingSpring = "cubic-bezier(0.34, 1.56, 0.64, 1)"
  }
}
