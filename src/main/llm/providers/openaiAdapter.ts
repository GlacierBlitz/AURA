import OpenAI from 'openai';
import type { LLMPrompt, LLMResponse, ProviderConfig } from '@shared/types';
import { BaseLLMProviderAdapter } from '../llmProviderAdapter';

/**
 * OpenAI GPT adapter implementing LLMProviderAdapter
 * Supports GPT-4o, GPT-4-turbo, GPT-3.5-turbo
 */
export class OpenAIAdapter extends BaseLLMProviderAdapter {
  private client: OpenAI | null = null;

  configure(config: ProviderConfig): void {
    super.configure(config);

    if (!config.apiKey) {
      throw new Error('OpenAI API key is required');
    }

    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.endpoint,
    });
  }

  async sendMessage(prompt: LLMPrompt): Promise<LLMResponse> {
    if (!this.client || !this.config) {
      throw new Error('OpenAI adapter not configured');
    }

    try {
      // Build messages array
      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

      // System prompt
      if (prompt.systemPrompt) {
        messages.push({
          role: 'system',
          content: prompt.systemPrompt,
        });
      }

      // Conversation history
      if (prompt.conversationHistory) {
        for (const msg of prompt.conversationHistory) {
          messages.push({
            role: msg.role === 'user' ? 'user' : 'assistant',
            content: msg.content,
          });
        }
      }

      // Current user instruction and page context (separated for security)
      let userContent = '';
      
      if (prompt.userInstruction) {
        userContent += `USER INSTRUCTION:\n${prompt.userInstruction}\n\n`;
      }

      if (prompt.pageContext) {
        userContent += `PAGE CONTEXT (UNTRUSTED DATA FROM WEBSITE):\n${JSON.stringify(prompt.pageContext, null, 2)}`;
      }

      messages.push({
        role: 'user',
        content: userContent,
      });

      // Call OpenAI API
      const completion = await this.client.chat.completions.create({
        model: this.config.model,
        messages,
        temperature: this.config.temperature || 0.2,
        max_tokens: this.config.maxTokens || 4000,
        response_format: 
          prompt.responseFormat === 'summary' || prompt.responseFormat === 'action-plan'
            ? { type: 'json_object' }
            : undefined,
      });

      // Extract response
      const choice = completion.choices[0];
      if (!choice || !choice.message || !choice.message.content) {
        throw new Error('Empty response from OpenAI');
      }

      // Update token usage
      if (completion.usage) {
        this.updateTokenUsage({
          promptTokens: completion.usage.prompt_tokens,
          completionTokens: completion.usage.completion_tokens,
          totalTokens: completion.usage.total_tokens,
        });
      }

      return {
        content: choice.message.content,
        confidence: this.calculateConfidence(choice),
        finishReason: choice.finish_reason || 'stop',
        model: completion.model,
        usage: completion.usage
          ? {
              promptTokens: completion.usage.prompt_tokens,
              completionTokens: completion.usage.completion_tokens,
              totalTokens: completion.usage.total_tokens,
            }
          : undefined,
      };
    } catch (error: any) {
      console.error('OpenAI API error:', error);
      throw new Error(`OpenAI API failed: ${error.message || 'Unknown error'}`);
    }
  }

  async countTokens(text: string): Promise<number> {
    // Rough estimation: 1 token ≈ 4 characters for English text
    // For production, use tiktoken library for accurate counting
    return Math.ceil(text.length / 4);
  }

  getMaxContextTokens(): number {
    if (!this.config) {
      return 128000; // Default for GPT-4o
    }

    // Model context windows
    const contextWindows: Record<string, number> = {
      'gpt-4o': 128000,
      'gpt-4-turbo': 128000,
      'gpt-4': 8192,
      'gpt-3.5-turbo': 16385,
    };

    return contextWindows[this.config.model] || 128000;
  }

  /**
   * Calculate confidence score based on finish reason and logprobs
   * Range: 0.0 to 1.0
   */
  private calculateConfidence(choice: OpenAI.Chat.Completions.ChatCompletion.Choice): number {
    // Base confidence on finish reason
    if (choice.finish_reason === 'stop') {
      return 0.9; // Normal completion
    } else if (choice.finish_reason === 'length') {
      return 0.6; // Hit token limit (response may be incomplete)
    } else if (choice.finish_reason === 'content_filter') {
      return 0.3; // Content filtered (likely problematic)
    }

    return 0.5; // Unknown finish reason
  }
}
