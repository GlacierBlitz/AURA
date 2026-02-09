import type { ActionType, ActionErrorCode, ExtractableAttribute } from '../types/actions';

// ─── Supported Action Types ─────────────────────────────────

export const SUPPORTED_ACTION_TYPES: readonly ActionType[] = [
  'navigate',
  'click',
  'type',
  'select',
  'submit',
  'scroll',
  'back',
  'forward',
  'wait',
  'extract',
  'summarize',
] as const;

// ─── Confirmation Classification ────────────────────────────

export const ALWAYS_CONFIRM_ACTIONS: readonly ActionType[] = ['submit'] as const;

export const NEVER_CONFIRM_ACTIONS: readonly ActionType[] = [
  'scroll',
  'back',
  'forward',
  'wait',
  'extract',
  'summarize',
] as const;

// ─── Sensitive Element Patterns ─────────────────────────────

export const SENSITIVE_PATTERNS = {
  PASSWORD_FIELD: ['password'],
  PAYMENT_FIELD: ['cc-', 'card', 'credit', 'payment', 'cvv', 'cvc'],
  DELETE_BUTTON: ['delete', 'remove', 'cancel subscription', 'unsubscribe'],
  ACCOUNT_MODIFICATION: ['account', 'settings', 'password', 'profile', 'email'],
} as const;

// ─── Allowed Extractable Attributes ─────────────────────────

export const ALLOWED_EXTRACT_ATTRIBUTES: readonly ExtractableAttribute[] = [
  'textContent',
  'innerText',
  'value',
  'href',
  'src',
  'alt',
  'title',
  'aria-label',
] as const;

// ─── Validation Constraints ─────────────────────────────────

export const VALIDATION_CONSTRAINTS = {
  MIN_WAIT_DURATION: 100,
  MAX_WAIT_DURATION: 30000,
  MAX_PLAN_STEPS: 20,
  MAX_TEXT_LENGTH: 500,
  ALLOWED_URL_SCHEMES: ['http:', 'https:'],
} as const;

// ─── Error Code Metadata ────────────────────────────────────

export interface ErrorMetadata {
  severity: 'fatal' | 'warning' | 'retryable';
  userMessage: string;
  recoveryAction: string;
}

export const ERROR_METADATA: Record<ActionErrorCode, ErrorMetadata> = {
  INVALID_ACTION_TYPE: {
    severity: 'fatal',
    userMessage: "I couldn't understand what action to take.",
    recoveryAction: 'Request clarification from user',
  },
  MISSING_DESCRIPTION: {
    severity: 'warning',
    userMessage: '',
    recoveryAction: 'Auto-generate description, proceed',
  },
  MISSING_REQUIRED_FIELD: {
    severity: 'fatal',
    userMessage: "I'm missing information needed to perform this action.",
    recoveryAction: 'Re-prompt LLM with field requirements',
  },
  INVALID_FIELD_TYPE: {
    severity: 'fatal',
    userMessage: "I received an invalid response. Retrying...",
    recoveryAction: 'Re-prompt LLM',
  },
  UNSAFE_URL_SCHEME: {
    severity: 'fatal',
    userMessage: "I can't navigate to that type of URL for security reasons.",
    recoveryAction: 'Block action, inform user',
  },
  DURATION_OUT_OF_RANGE: {
    severity: 'warning',
    userMessage: '',
    recoveryAction: 'Clamp to valid range, proceed',
  },
  DISALLOWED_ATTRIBUTE: {
    severity: 'fatal',
    userMessage: "I can't extract that type of information.",
    recoveryAction: 'Re-prompt LLM with allowed attributes',
  },
  UNEXPECTED_FIELD: {
    severity: 'warning',
    userMessage: '',
    recoveryAction: 'Strip unexpected fields, proceed',
  },
  SELECTOR_NO_MATCH: {
    severity: 'retryable',
    userMessage: "I couldn't find that element on the page. Let me try again.",
    recoveryAction: 'Re-extract page state, retry once',
  },
  SELECTOR_MULTIPLE_MATCHES: {
    severity: 'retryable',
    userMessage: 'I found multiple matching elements. Let me be more specific.',
    recoveryAction: 'Re-prompt LLM with disambiguation context',
  },
  ELEMENT_NOT_VISIBLE: {
    severity: 'retryable',
    userMessage: "That element isn't visible on the page right now.",
    recoveryAction: 'Scroll into view, retry',
  },
  ELEMENT_NOT_INTERACTABLE: {
    severity: 'retryable',
    userMessage: "That element can't be interacted with right now.",
    recoveryAction: 'Wait 1s, retry once',
  },
  ELEMENT_NOT_EDITABLE: {
    severity: 'fatal',
    userMessage: "I can't type into that element — it's not an input field.",
    recoveryAction: 'Re-prompt LLM',
  },
  OPTION_NOT_FOUND: {
    severity: 'retryable',
    userMessage: "That option isn't available in the dropdown.",
    recoveryAction: 'Re-extract options, re-prompt LLM',
  },
  NOT_A_FORM: {
    severity: 'fatal',
    userMessage: "I couldn't find a form to submit.",
    recoveryAction: 'Re-prompt LLM',
  },
  ACTION_INTENT_MISMATCH: {
    severity: 'fatal',
    userMessage: "The planned action doesn't match your request. Please try again.",
    recoveryAction: 'Block action, re-prompt LLM',
  },
  SCRIPT_IN_TEXT: {
    severity: 'fatal',
    userMessage: 'I detected potentially unsafe content and blocked it.',
    recoveryAction: 'Block action, inform user',
  },
  PLAN_TOO_LONG: {
    severity: 'warning',
    userMessage: "This task has many steps. I'll break it into smaller parts.",
    recoveryAction: 'Truncate plan, execute first batch',
  },
};
