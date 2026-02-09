import type { LLMPrompt, LLMResponse, ProviderConfig, ModelInfo, TokenUsageStats } from '@shared/types';

/**
 * LLMProviderAdapter defines the interface for all LLM provider implementations.
 * Supports OpenAI, Anthropic, and Google providers with unified API.
 */
export interface LLMProviderAdapter {
  /**
   * Send a prompt to the LLM and get a response
   */
  sendMessage(prompt: LLMPrompt): Promise<LLMResponse>;

  /**
   * Configure the provider with API key, model, and other settings
   */
  configure(config: ProviderConfig): void;

  /**
   * Get information about the current model
   */
  getModelInfo(): ModelInfo;

  /**
   * Count tokens in a text string (for budget management)
   */
  countTokens(text: string): Promise<number>;

  /**
   * Get maximum context tokens for current model
   */
  getMaxContextTokens(): number;

  /**
   * Get token usage statistics for current session
   */
  getTokenUsage(): TokenUsageStats;

  /**
   * Check if the provider is properly configured
   */
  isConfigured(): boolean;
}

/**
 * Base class for LLM provider adapters with common functionality
 */
export abstract class BaseLLMProviderAdapter implements LLMProviderAdapter {
  protected config: ProviderConfig | null = null;
  protected tokenUsage: TokenUsageStats = {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
  };

  abstract sendMessage(prompt: LLMPrompt): Promise<LLMResponse>;
  abstract countTokens(text: string): Promise<number>;
  abstract getMaxContextTokens(): number;

  configure(config: ProviderConfig): void {
    this.config = config;
  }

  getModelInfo(): ModelInfo {
    if (!this.config) {
      throw new Error('Provider not configured');
    }

    return {
      provider: this.config.provider,
      model: this.config.model,
      maxTokens: this.config.maxTokens || 4000,
      temperature: this.config.temperature || 0.2,
    };
  }

  getTokenUsage(): TokenUsageStats {
    return { ...this.tokenUsage };
  }

  isConfigured(): boolean {
    return this.config !== null && !!this.config.apiKey;
  }

  protected updateTokenUsage(usage: Partial<TokenUsageStats>): void {
    if (usage.promptTokens) {
      this.tokenUsage.promptTokens += usage.promptTokens;
    }
    if (usage.completionTokens) {
      this.tokenUsage.completionTokens += usage.completionTokens;
    }
    if (usage.totalTokens) {
      this.tokenUsage.totalTokens += usage.totalTokens;
    } else {
      this.tokenUsage.totalTokens = this.tokenUsage.promptTokens + this.tokenUsage.completionTokens;
    }
  }
}
