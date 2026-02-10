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

import type { SanitizedPageState } from '@shared/types';
import type { ActionDescriptor, ActionResult } from '@shared/types';

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  tokens?: number;
}

export interface ContextSnapshot {
  url: string;
  timestamp: Date;
  pageState: SanitizedPageState;
  actions: ActionResult[];
}

export interface ContextSummary {
  conversationHistory: ConversationMessage[];
  currentPageState: SanitizedPageState | null;
  recentActions: ActionResult[];
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
    // Estimate tokens for this message
    const messageTokens = this.estimateTokens(message.content);
    message.tokens = messageTokens;
    
    // Add to history
    this.conversationHistory.push(message);
    this.currentTokenCount += messageTokens;
    
    // Keep only last maxMessages
    if (this.conversationHistory.length > this.maxMessages) {
      const removed = this.conversationHistory.shift();
      if (removed && removed.tokens) {
        this.currentTokenCount -= removed.tokens;
      }
    }
  }

  /**
   * Add a page state snapshot
   */
  addPageState(url: string, pageState: SanitizedPageState, actions: ActionResult[] = []): void {
    const snapshot: ContextSnapshot = {
      url,
      timestamp: new Date(),
      pageState,
      actions
    };
    
    this.pageStateHistory.push(snapshot);
    
    // Keep only last 3 snapshots
    if (this.pageStateHistory.length > 3) {
      this.pageStateHistory.shift();
    }
  }

  /**
   * Get formatted context for LLM prompt
   */
  getFormattedContext(): string {
    let context = '';
    
    // Add conversation history
    if (this.conversationHistory.length > 0) {
      context += 'RECENT CONVERSATION:\n';
      for (const msg of this.conversationHistory) {
        context += `${msg.role}: ${msg.content}\n`;
      }
      context += '\n';
    }
    
    // Add current page info
    if (this.pageStateHistory.length > 0) {
      const current = this.pageStateHistory[this.pageStateHistory.length - 1];
      context += `CURRENT PAGE:\n`;
      context += `URL: ${current.pageState.url}\n`;
      context += `Title: ${current.pageState.title}\n\n`;
    }
    
    // Add recent actions
    const recentActions = this.getRecentActions(3);
    if (recentActions.length > 0) {
      context += 'RECENT ACTIONS:\n';
      for (const action of recentActions) {
        context += `- ${action.status}: ${JSON.stringify(action.action)}\n`;
      }
    }
    
    return context;
  }

  /**
   * Get full context summary
   */
  getContextSummary(): ContextSummary {
    return {
      conversationHistory: [...this.conversationHistory],
      currentPageState: this.getCurrentPageState(),
      recentActions: this.getRecentActions(),
      totalTokens: this.currentTokenCount
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
  getRecentActions(count: number = 3): ActionResult[] {
    const allActions: ActionResult[] = [];
    
    // Collect actions from all snapshots
    for (const snapshot of this.pageStateHistory) {
      allActions.push(...snapshot.actions);
    }
    
    // Return last N actions
    return allActions.slice(-count);
  }

  /**
   * Get current page state
   */
  getCurrentPageState(): SanitizedPageState | null {
    if (this.pageStateHistory.length === 0) {
      return null;
    }
    return this.pageStateHistory[this.pageStateHistory.length - 1].pageState;
  }

  /**
   * Check if we're approaching token limit
   */
  isApproachingTokenLimit(): boolean {
    return this.currentTokenCount > this.maxTokens * 0.8; // 80% threshold
  }
}
