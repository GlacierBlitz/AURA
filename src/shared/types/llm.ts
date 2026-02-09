import type { ActionPlanResponse, PageSummary } from './actions';
import type { SanitizedPageState } from './pageState';

// ─── LLM Provider Types ─────────────────────────────────────

export type LLMProvider = 'openai' | 'anthropic' | 'google';

export interface ProviderConfig {
  provider: LLMProvider;
  apiKey: string;
  model: string;
  endpoint?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface ModelInfo {
  provider: LLMProvider;
  name: string;
  maxContextTokens: number;
  supportsStreaming: boolean;
  supportsFunctionCalling: boolean;
}

// ─── LLM Prompt Types ───────────────────────────────────────

export type ResponseFormat = 'action-plan' | 'summary' | 'clarification';

export interface LLMPrompt {
  systemPrompt: string;
  conversationHistory: ConversationTurn[];
  pageContext: SanitizedPageState;
  userInstruction: string;
  responseFormat: ResponseFormat;
}

export interface ConversationTurn {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
}

// ─── LLM Response Types ─────────────────────────────────────

export interface LLMResponse {
  type: ResponseFormat;
  content: ActionPlanResponse | PageSummary | { reason: string; options?: string[] };
  tokensUsed: TokenUsage;
  confidence: number;
}

export interface TokenUsage {
  prompt: number;
  completion: number;
  total: number;
}

export interface TokenUsageStats {
  totalTokens: number;
  totalCost?: number;
  sessionStartTime: string;
}

// ─── Session Context Types ──────────────────────────────────

export interface SessionContext {
  conversationHistory: ConversationTurn[];
  currentPageState: SanitizedPageState | null;
  navigationHistory: Array<{ url: string; title: string; timestamp: string }>;
  tokenBudget: number;
  tokensUsed: number;
}
