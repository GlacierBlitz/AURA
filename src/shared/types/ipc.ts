import type { ActionDescriptor, ActionResult, UserDecision } from './actions';
import type { PageSummary } from './actions';
import type { AccessibilitySettings } from './accessibility';

// ─── IPC Channel Names ──────────────────────────────────────

export const IPC_CHANNELS = {
  // User to Main
  USER_SUBMIT_INSTRUCTION: 'user:submit-instruction',
  USER_NAVIGATE: 'user:navigate',
  USER_NAVIGATE_HOME: 'user:navigate-home',
  USER_SAVE_API_KEY: 'user:save-api-key',
  USER_TOGGLE_CHAT_PANEL: 'user:toggle-chat-panel',
  USER_GO_BACK: 'user:go-back',
  USER_GO_FORWARD: 'user:go-forward',
  USER_REFRESH: 'user:refresh',
  USER_UPDATE_ACCESSIBILITY: 'user:update-accessibility',
  USER_SET_MODAL_OPEN: 'user:set-modal-open',
  USER_TRANSCRIBE_AUDIO: 'user:transcribe-audio',
  USER_SET_SUGGESTIONS_VISIBLE: 'user:set-suggestions-visible',

  // Main to Renderer
  PIPELINE_SUMMARY: 'pipeline:summary',
  PIPELINE_STATUS: 'pipeline:status',
  PIPELINE_MESSAGE: 'pipeline:message',
  PIPELINE_ERROR: 'pipeline:error',

  // Confirmation (bidirectional)
  CONFIRM_REQUEST: 'confirm:request',
  CONFIRM_RESPONSE: 'confirm:response',

  // Action Log
  LOG_QUERY: 'log:query',
  LOG_RESULTS: 'log:results',
} as const;

// ─── IPC Payload Types ──────────────────────────────────────

export interface UserInstructionPayload {
  text: string;
}

export interface NavigatePayload {
  url: string;
}

export interface SaveApiKeyPayload {
  apiKey: string;
  provider: 'openai' | 'anthropic' | 'google';
}

export interface ToggleChatPanelPayload {
  visible: boolean;
}

export interface UpdateAccessibilityPayload extends AccessibilitySettings {}

export interface SetModalOpenPayload {
  isOpen: boolean;
}

export interface PipelineSummaryPayload {
  summary: PageSummary;
  url: string;
  timestamp: string;
}

export type PipelineStatus = 'idle' | 'extracting' | 'processing' | 'executing' | 'error';

export interface PipelineStatusPayload {
  status: PipelineStatus;
  message?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  actionResult?: ActionResult;
}

export interface PipelineMessagePayload {
  message: ChatMessage;
}

export interface ErrorInfo {
  code: string;
  message: string;
  recoverable: boolean;
  details?: string;
}

export interface PipelineErrorPayload {
  error: ErrorInfo;
}

export interface ConfirmationRequestPayload {
  action: ActionDescriptor;
  reason: string;
}

export interface ConfirmationResponsePayload {
  decision: UserDecision;
  modifiedAction?: ActionDescriptor;
}

export interface LogFilter {
  startDate?: string;
  endDate?: string;
  status?: string;
  url?: string;
}

export interface LogQueryPayload {
  filter?: LogFilter;
  limit?: number;
}

export interface LogResultsPayload {
  entries: LogEntry[];
  totalCount: number;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  userInstruction: string;
  interpretedIntent: string;
  actions: ActionResult[];
  pageUrl: string;
  status: 'completed' | 'failed' | 'cancelled';
}

export interface TranscribeAudioPayload {
  audioData: number[]; // Uint8Array converted to array for IPC
  mimeType: string;
}

export interface TranscribeAudioResponse {
  text?: string;
  error?: string;
}

export interface SetSuggestionsVisiblePayload {
  visible: boolean;
}
