/**
 * ContextManager - Manages conversation history and page state for multi-step tasks
 * 
 * PERSON 2 TODO:
 * 1. Implement conversation history storage (last 5 messages)
 * 2. Implement token budget tracking (~8000 tokens for GPT-4o)
 * 3. Implement automatic summarization when approaching limits
 * 4. Store page state snapshots for context
 * 5. Provide formatted context for LLM prompts
 */

import { PageState } from '../../shared/types/pageState';
import { ActionDescriptor } from '../../shared/types/actions';

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  tokens?: number;
}

export interface ContextSnapshot {
  url: string;
  timestamp: Date;
  pageState: PageState;
  actions: ActionDescriptor[];
}

export interface ContextSummary {
  conversationHistory: ConversationMessage[];
  currentPageState: PageState | null;
  recentActions: ActionDescriptor[];
  totalTokens: number;
}

export class ContextManager {
  private conversationHistory: ConversationMessage[] = [];
  private pageStateHistory: ContextSnapshot[] = [];
  private maxMessages: number = 5;
  private maxTokens: number = 8000; // Reserve ~8K tokens for context
  private currentTokenCount: number = 0;

  /**
   * Add a message to conversation history
   */
  addMessage(message: ConversationMessage): void {
    // TODO: Implement
    // 1. Add message to history
    // 2. Estimate tokens (rough: 1 token ≈ 4 characters)
    // 3. Update currentTokenCount
    // 4. If over maxMessages or maxTokens, trigger summarization
    
    throw new Error('Not implemented');
  }

  /**
   * Add a page state snapshot
   */
  addPageState(url: string, pageState: PageState, actions: ActionDescriptor[] = []): void {
    // TODO: Implement
    // 1. Add to pageStateHistory
    // 2. Keep only last 3 snapshots
    
    throw new Error('Not implemented');
  }

  /**
   * Get formatted context for LLM prompt
   */
  getFormattedContext(): string {
    // TODO: Implement
    // Return formatted string with:
    // - Conversation history (last 5 messages or summarized)
    // - Current page state (title, URL, key elements)
    // - Recent actions (last 3)
    
    throw new Error('Not implemented');
  }

  /**
   * Get full context summary
   */
  getContextSummary(): ContextSummary {
    // TODO: Implement
    return {
      conversationHistory: [],
      currentPageState: null,
      recentActions: [],
      totalTokens: 0
    };
  }

  /**
   * Summarize old conversation when approaching token limit
   */
  private async summarizeOldConversation(): Promise<void> {
    // TODO: Implement
    // 1. Take oldest messages (beyond last 5)
    // 2. Create summary message (e.g., "User asked about X, assistant did Y")
    // 3. Replace old messages with single summary message
    // 4. Recalculate token count
    
    throw new Error('Not implemented');
  }

  /**
   * Estimate token count for text
   */
  private estimateTokens(text: string): number {
    // Rough estimate: 1 token ≈ 4 characters
    return Math.ceil(text.length / 4);
  }

  /**
   * Clear all context (for new session)
   */
  clearContext(): void {
    this.conversationHistory = [];
    this.pageStateHistory = [];
    this.currentTokenCount = 0;
  }

  /**
   * Get recent actions (last N)
   */
  getRecentActions(count: number = 3): ActionDescriptor[] {
    // TODO: Implement
    return [];
  }

  /**
   * Get current page state
   */
  getCurrentPageState(): PageState | null {
    // TODO: Implement
    return null;
  }

  /**
   * Check if we're approaching token limit
   */
  isApproachingTokenLimit(): boolean {
    return this.currentTokenCount > this.maxTokens * 0.8; // 80% threshold
  }
}
