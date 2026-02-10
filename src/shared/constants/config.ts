// ─── Application Configuration ──────────────────────────────

export const APP_CONFIG = {
  APP_NAME: 'BeyondBinary',
  VERSION: '0.1.0',
  WINDOW_WIDTH: 1400,
  WINDOW_HEIGHT: 900,
  MIN_WINDOW_WIDTH: 1024,
  MIN_WINDOW_HEIGHT: 768,
  CHAT_PANEL_WIDTH: 400,
} as const;

// ─── LLM Configuration ──────────────────────────────────────

export const LLM_CONFIG = {
  DEFAULT_PROVIDER: 'openai' as const,
  DEFAULT_MODEL: {
    openai: 'gpt-4o',
    anthropic: 'claude-3-5-sonnet-20240620',
    google: 'gemini-1.5-pro',
  },
  DEFAULT_TEMPERATURE: 0.2,
  DEFAULT_MAX_TOKENS: 4000,
  CONFIDENCE_THRESHOLD: 0.7,
  MAX_CONTEXT_TOKENS: {
    openai: 128000,
    anthropic: 200000,
    google: 1000000,
  },
} as const;

// ─── Token Budget Allocation ────────────────────────────────

export const TOKEN_BUDGET = {
  SYSTEM_PROMPT: 1000,
  CURRENT_PAGE_STATE_MIN: 5000,
  CURRENT_PAGE_STATE_MAX: 20000,
  RECENT_CONVERSATION: 5000,
  SUMMARIZED_HISTORY: 2000,
  USER_INSTRUCTION: 200,
  RESERVED_FOR_RESPONSE: 4000,
} as const;

// ─── Page State Extraction ──────────────────────────────────

export const EXTRACTION_CONFIG = {
  STABILIZATION_TIMEOUT: 5000,
  MIN_INTERACTIVE_NODES_FOR_MEANINGFUL_TREE: 5,
  MAX_TEXT_NODE_LENGTH: 500,
  SCROLL_WAIT_DURATION: 1000,
} as const;

// ─── Action Execution ───────────────────────────────────────

export const EXECUTION_CONFIG = {
  DEFAULT_RETRY_COUNT: 1,
  RETRY_DELAY: 1000,
  ELEMENT_INTERACTION_TIMEOUT: 5000,
  PAGE_LOAD_TIMEOUT: 30000,
} as const;

// ─── TTS Configuration ──────────────────────────────────────

export const TTS_CONFIG = {
  DEFAULT_RATE: 0.95,
  DEFAULT_PITCH: 0.9,
  DEFAULT_VOLUME: 0.9,
  AUTO_READ_SUMMARIES: true,
  AUTO_READ_MESSAGES: false,
  // Add voice quality preferences
  PREFER_FEMALE: true,     // Most systems have better female voices
} as const;

// ─── Logging Configuration ──────────────────────────────────

export const LOG_CONFIG = {
  MAX_LOG_ENTRIES: 1000,
  LOG_RETENTION_DAYS: 30,
  REDACT_SENSITIVE_FIELDS: true,
} as const;

// ─── Accessibility Configuration ────────────────────────────

export const A11Y_CONFIG = {
  WCAG_LEVEL: 'AA' as const,
  MIN_CONTRAST_RATIO: 4.5,
  FOCUS_INDICATOR_WIDTH: 2,
  ANIMATION_DURATION_REDUCED: 200,
  ANIMATION_DURATION_NORMAL: 300,
} as const;
