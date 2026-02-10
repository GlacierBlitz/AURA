// ─── Response Types ─────────────────────────────────────────

export type LLMResponseType = 'action-plan' | 'summary' | 'clarification';

export interface ActionPlanResponse {
  type: 'action-plan';
  confidence: number;
  intent: string;
  steps: ActionDescriptor[];
  explanation: string;
}

export interface SummaryResponse {
  type: 'summary';
  confidence: number;
  summary: PageSummary;
}

export interface ClarificationResponse {
  type: 'clarification';
  confidence: number;
  reason: string;
  options?: string[];
}

export type LLMParsedResponse =
  | ActionPlanResponse
  | SummaryResponse
  | ClarificationResponse;

// ─── Page Summary ───────────────────────────────────────────

export interface PageSummary {
  purpose: string;
  sections: string[];
  availableActions: string[];
  accessibilityNotes?: string;
  confidence: number;
  generatedAt: number;
}

// ─── Action Descriptors ─────────────────────────────────────

export type ActionType =
  | 'navigate'
  | 'click'
  | 'type'
  | 'select'
  | 'submit'
  | 'scroll'
  | 'back'
  | 'forward'
  | 'wait'
  | 'extract'
  | 'summarize';

export interface BaseAction {
  action: ActionType;
  description: string;
}

export interface NavigateAction extends BaseAction {
  action: 'navigate';
  url: string;
}

export interface ClickAction extends BaseAction {
  action: 'click';
  selector: string;
  elementDescription: string;
}

export interface TypeAction extends BaseAction {
  action: 'type';
  selector: string;
  text: string;
  clearFirst?: boolean;
  elementDescription: string;
}

export interface SelectAction extends BaseAction {
  action: 'select';
  selector: string;
  value: string;
  elementDescription: string;
}

export interface SubmitAction extends BaseAction {
  action: 'submit';
  selector: string;
  elementDescription: string;
}

export interface ScrollAction extends BaseAction {
  action: 'scroll';
  direction: 'up' | 'down';
  amount: 'page' | 'end' | 'top' | number;
  container?: string;
}

export interface BackAction extends BaseAction {
  action: 'back';
}

export interface ForwardAction extends BaseAction {
  action: 'forward';
}

export interface WaitAction extends BaseAction {
  action: 'wait';
  duration: number;
}

export interface ExtractAction extends BaseAction {
  action: 'extract';
  selector: string;
  attribute?: ExtractableAttribute;
  elementDescription: string;
}

export interface SummarizeAction extends BaseAction {
  action: 'summarize';
}

export type ActionDescriptor =
  | NavigateAction
  | ClickAction
  | TypeAction
  | SelectAction
  | SubmitAction
  | ScrollAction
  | BackAction
  | ForwardAction
  | WaitAction
  | ExtractAction
  | SummarizeAction;

// ─── Extractable Attributes ─────────────────────────────────

export type ExtractableAttribute =
  | 'textContent'
  | 'innerText'
  | 'value'
  | 'href'
  | 'src'
  | 'alt'
  | 'title'
  | 'aria-label';

// ─── Action Results ─────────────────────────────────────────

export type ActionResultStatus = 'success' | 'failure' | 'cancelled' | 'retried';

export interface ActionResult {
  action: ActionDescriptor;
  status: ActionResultStatus;
  error?: ActionError;
  extractedData?: string;
  timestamp: string;
}

export interface ActionError {
  code: ActionErrorCode;
  message: string;
  retryable: boolean;
}

export type ActionErrorCode =
  | 'INVALID_ACTION_TYPE'
  | 'MISSING_DESCRIPTION'
  | 'MISSING_REQUIRED_FIELD'
  | 'INVALID_FIELD_TYPE'
  | 'UNSAFE_URL_SCHEME'
  | 'DURATION_OUT_OF_RANGE'
  | 'DISALLOWED_ATTRIBUTE'
  | 'UNEXPECTED_FIELD'
  | 'SELECTOR_NO_MATCH'
  | 'SELECTOR_MULTIPLE_MATCHES'
  | 'ELEMENT_NOT_VISIBLE'
  | 'ELEMENT_NOT_INTERACTABLE'
  | 'ELEMENT_NOT_EDITABLE'
  | 'OPTION_NOT_FOUND'
  | 'NOT_A_FORM'
  | 'ACTION_INTENT_MISMATCH'
  | 'SCRIPT_IN_TEXT'
  | 'PLAN_TOO_LONG';

// ─── Confirmation ───────────────────────────────────────────

export type ConfirmationLevel = 'required' | 'optional' | 'none';

export type UserDecision = 'confirm' | 'cancel' | 'modify';
