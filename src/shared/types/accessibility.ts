// ─── Accessibility Types ────────────────────────────────────

export interface AccessibilitySettings {
  profile: AccessibilityProfile;
  fontSize: number; // 100 = normal, 150 = 50% larger
  lineSpacing: number; // 1.0 = normal, 2.0 = double
  highContrast: boolean;
  colorFilter: ColorFilter;
  simplifyLayout: boolean;
}

export type AccessibilityProfile = 
  | 'default'
  | 'high-contrast'
  | 'large-text'
  | 'color-blind'
  | 'simplified'
  | 'custom';

export type ColorFilter = 
  | 'none'
  | 'protanopia' // Red-blind
  | 'deuteranopia' // Green-blind
  | 'tritanopia' // Blue-blind
  | 'grayscale';

export const DEFAULT_ACCESSIBILITY_SETTINGS: AccessibilitySettings = {
  profile: 'default',
  fontSize: 100,
  lineSpacing: 1.0,
  highContrast: false,
  colorFilter: 'none',
  simplifyLayout: false,
};

export const ACCESSIBILITY_PROFILES: Record<AccessibilityProfile, Partial<AccessibilitySettings>> = {
  'default': {
    fontSize: 100,
    lineSpacing: 1.0,
    highContrast: false,
    colorFilter: 'none',
    simplifyLayout: false,
  },
  'high-contrast': {
    fontSize: 110,
    lineSpacing: 1.3,
    highContrast: true,
    colorFilter: 'none',
    simplifyLayout: false,
  },
  'large-text': {
    fontSize: 150,
    lineSpacing: 1.5,
    highContrast: false,
    colorFilter: 'none',
    simplifyLayout: false,
  },
  'color-blind': {
    fontSize: 110,
    lineSpacing: 1.2,
    highContrast: false,
    colorFilter: 'protanopia',
    simplifyLayout: false,
  },
  'simplified': {
    fontSize: 120,
    lineSpacing: 1.4,
    highContrast: false,
    colorFilter: 'none',
    simplifyLayout: true,
  },
  'custom': {},
};

// ─── Focus Reading Types ────────────────────────────────────

export interface FocusReadingSettings {
  enabled: boolean;
  dimOpacity: number;       // 0-1, how dim the unfocused content should be (default 0.15)
  highlightStyle: FocusHighlightStyle;
}

export type FocusHighlightStyle = 'spotlight' | 'underline' | 'box';

export const DEFAULT_FOCUS_READING_SETTINGS: FocusReadingSettings = {
  enabled: false,
  dimOpacity: 0.15,
  highlightStyle: 'spotlight',
};

export interface FocusReadingStatusPayload {
  active: boolean;
  paragraphIndex: number;
  totalParagraphs: number;
}
