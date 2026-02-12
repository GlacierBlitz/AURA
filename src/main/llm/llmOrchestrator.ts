import type {
  SanitizedPageState,
  PageSummary,
  LLMPrompt,
  LLMResponse,
  SummaryResponse,
  ActionPlanResponse,
  ClarificationResponse,
  ConversationTurn,
} from '@shared/types';
import { LLM_CONFIG } from '@shared/constants';
import type { LLMProviderAdapter } from './llmProviderAdapter';
import { SYSTEM_PROMPT, buildSummaryPrompt, buildActionPrompt } from './promptTemplates';
import { ContentSanitizer } from '../pipeline/contentSanitizer';
import { getLLMCache, type LLMCache } from './llmCache';

/**
 * LLMOrchestrator manages LLM interactions for summarization and action planning.
 * Handles prompt construction, response parsing, and validation.
 * Includes automatic caching to reduce API calls.
 */
export class LLMOrchestrator {
  private provider: LLMProviderAdapter;
  private cache: LLMCache | null = null;
  private static readonly MAX_PROMPT_TOKENS = 20000; // Conservative limit for page context

  constructor(provider: LLMProviderAdapter) {
    this.provider = provider;
    // Initialize cache asynchronously
    this.initializeCache();
  }

  /**
   * Initialize the LLM cache
   */
  private async initializeCache(): Promise<void> {
    try {
      this.cache = await getLLMCache();
      console.log('[LLMOrchestrator] LLM cache initialized');
    } catch (error) {
      console.error('[LLMOrchestrator] Failed to initialize cache:', error);
    }
  }

  /**
   * Clear the LLM response cache
   */
  async clearCache(): Promise<void> {
    if (this.cache) {
      await this.cache.clear();
      console.log('[LLMOrchestrator] Cache cleared');
    }
  }

  /**
   * Generate a summary of the current page state
   */
  async generateSummary(
    pageState: SanitizedPageState,
    previousSummary?: PageSummary
  ): Promise<PageSummary> {
    if (!this.provider.isConfigured()) {
      throw new Error('LLM provider not configured. Please set up API key in settings.');
    }

    // Check token count of page state
    const pageStateTokens = ContentSanitizer.estimateTokens(pageState);
    console.log(`Page state estimated tokens: ${pageStateTokens}`);
    
    if (pageStateTokens > LLMOrchestrator.MAX_PROMPT_TOKENS) {
      console.error(`Page state too large: ${pageStateTokens} tokens (max ${LLMOrchestrator.MAX_PROMPT_TOKENS})`);
      return this.createFallbackSummary(pageState, 'Page too complex to analyze');
    }

    // Check for suspicious content
    if (pageState.sanitizationMetadata?.suspiciousContentDetected) {
      console.warn('Suspicious content detected in page state - proceeding with extra caution');
    }

    // Build the prompt
    const prompt: LLMPrompt = {
      systemPrompt: SYSTEM_PROMPT,
      userInstruction: buildSummaryPrompt(
        pageState,
        previousSummary ? JSON.stringify(previousSummary) : undefined
      ),
      pageContext: pageState,
      responseFormat: 'summary',
    };

    try {
      // Check cache first
      if (this.cache) {
        const cachedResponse = await this.cache.get(prompt);
        if (cachedResponse) {
          console.log('[LLMOrchestrator] Using cached summary response');
          const parsedResponse = this.parseSummaryResponse(cachedResponse.content);
          this.validateSummaryResponse(parsedResponse);
          return {
            purpose: parsedResponse.summary.purpose,
            sections: parsedResponse.summary.sections,
            availableActions: parsedResponse.summary.availableActions,
            accessibilityNotes: parsedResponse.summary.accessibilityNotes,
            confidence: cachedResponse.confidence,
            generatedAt: Date.now(),
          };
        }
      }

      // Send to LLM
      const response: LLMResponse = await this.provider.sendMessage(prompt);

      // Validate confidence threshold
      if (response.confidence < LLM_CONFIG.CONFIDENCE_THRESHOLD) {
        console.warn(
          `Low confidence summary: ${response.confidence} < ${LLM_CONFIG.CONFIDENCE_THRESHOLD}`
        );
      }

      // Parse the response
      const parsedResponse = this.parseSummaryResponse(response.content);

      // Validate the parsed response
      this.validateSummaryResponse(parsedResponse);

      // Extract PageSummary
      const summary: PageSummary = {
        purpose: parsedResponse.summary.purpose,
        sections: parsedResponse.summary.sections,
        availableActions: parsedResponse.summary.availableActions,
        accessibilityNotes: parsedResponse.summary.accessibilityNotes,
        confidence: response.confidence,
        generatedAt: Date.now(),
      };

      // Store in cache for future use
      if (this.cache) {
        await this.cache.set(prompt, response);
      }

      return summary;
    } catch (error: any) {
      console.error('Failed to generate summary:', error);
      
      // Return fallback summary
      return this.createFallbackSummary(pageState);
    }
  }

  /**
   * Translate user instruction into action plan or clarification request
   */
  async translateIntent(
    userInstruction: string,
    pageState: SanitizedPageState,
    conversationHistory: ConversationTurn[] = []
  ): Promise<ActionPlanResponse | ClarificationResponse> {
    if (!this.provider.isConfigured()) {
      throw new Error('LLM provider not configured. Please set up API key in settings.');
    }

    // Check token count of page state
    const pageStateTokens = ContentSanitizer.estimateTokens(pageState);
    console.log(`Page state estimated tokens: ${pageStateTokens}`);
    
    if (pageStateTokens > LLMOrchestrator.MAX_PROMPT_TOKENS) {
      console.error(`Page state too large: ${pageStateTokens} tokens (max ${LLMOrchestrator.MAX_PROMPT_TOKENS})`);
      return {
        type: 'clarification',
        confidence: 0.5,
        reason: 'This page is too complex for me to analyze right now. Try a simpler page or refresh.',
        options: [
          'Navigate to a different page',
          'Try a more specific instruction',
        ],
      };
    }

    // Check for suspicious content
    if (pageState.sanitizationMetadata?.suspiciousContentDetected) {
      console.warn('Suspicious content detected in page state - proceeding with extra caution');
    }

    // Build the prompt
    const prompt: LLMPrompt = {
      systemPrompt: SYSTEM_PROMPT,
      userInstruction: buildActionPrompt(userInstruction, pageState, conversationHistory),
      pageContext: pageState,
      conversationHistory,
      responseFormat: 'action-plan',
    };

    try {
      // Check cache first
      if (this.cache) {
        const cachedResponse = await this.cache.get(prompt);
        if (cachedResponse) {
          console.log('[LLMOrchestrator] Using cached action plan response');
          const parsedResponse = this.parseActionResponse(cachedResponse.content);
          if (parsedResponse.type === 'action-plan') {
            this.validateActionPlanResponse(parsedResponse);
          } else {
            this.validateClarificationResponse(parsedResponse);
          }
          return parsedResponse;
        }
      }

      // Send to LLM
      const response: LLMResponse = await this.provider.sendMessage(prompt);

      // Validate confidence threshold
      if (response.confidence < LLM_CONFIG.CONFIDENCE_THRESHOLD) {
        console.warn(
          `Low confidence action plan: ${response.confidence} < ${LLM_CONFIG.CONFIDENCE_THRESHOLD}`
        );
      }

      // Parse the response (could be action-plan or clarification)
      const parsedResponse = this.parseActionResponse(response.content);

      // Validate the parsed response
      if (parsedResponse.type === 'action-plan') {
        this.validateActionPlanResponse(parsedResponse);
      } else {
        this.validateClarificationResponse(parsedResponse);
      }

      // Store in cache for future use
      if (this.cache) {
        await this.cache.set(prompt, response);
      }

      return parsedResponse;
    } catch (error: any) {
      console.error('Failed to translate intent:', error);
      
      // Return clarification request on error
      return {
        type: 'clarification',
        confidence: 0.5,
        reason: 'Unable to process your request. Could you please rephrase it?',
        options: [
          'Try describing what you want in different words',
          'Be more specific about which element to interact with',
        ],
      };
    }
  }

  /**
   * Parse LLM response as SummaryResponse
   */
  private parseSummaryResponse(content: string): SummaryResponse {
    try {
      const parsed = JSON.parse(content);

      if (parsed.type !== 'summary') {
        throw new Error(`Expected type "summary", got "${parsed.type}"`);
      }

      return parsed as SummaryResponse;
    } catch (error: any) {
      console.error('Failed to parse summary response:', error);
      throw new Error(`Invalid summary response format: ${error.message}`);
    }
  }

  /**
   * Validate that summary response has required fields
   */
  private validateSummaryResponse(response: SummaryResponse): void {
    if (!response.summary) {
      throw new Error('Missing summary object');
    }

    if (!response.summary.purpose || typeof response.summary.purpose !== 'string') {
      throw new Error('Missing or invalid summary.purpose');
    }

    if (!Array.isArray(response.summary.sections)) {
      throw new Error('Missing or invalid summary.sections');
    }

    if (!Array.isArray(response.summary.availableActions)) {
      throw new Error('Missing or invalid summary.availableActions');
    }

    if (typeof response.confidence !== 'number' || response.confidence < 0 || response.confidence > 1) {
      throw new Error('Missing or invalid confidence score');
    }
  }

  /**
   * Parse LLM response as ActionPlanResponse or ClarificationResponse
   */
  private parseActionResponse(content: string): ActionPlanResponse | ClarificationResponse {
    try {
      const parsed = JSON.parse(content);

      if (parsed.type !== 'action-plan' && parsed.type !== 'clarification') {
        throw new Error(`Expected type "action-plan" or "clarification", got "${parsed.type}"`);
      }

      return parsed as ActionPlanResponse | ClarificationResponse;
    } catch (error: any) {
      console.error('Failed to parse action response:', error);
      throw new Error(`Invalid action response format: ${error.message}`);
    }
  }

  /**
   * Validate that action plan response has required fields
   */
  private validateActionPlanResponse(response: ActionPlanResponse): void {
    if (!response.intent || typeof response.intent !== 'string') {
      throw new Error('Missing or invalid intent');
    }

    if (!response.steps || !Array.isArray(response.steps)) {
      throw new Error('Missing or invalid steps array');
    }

    if (response.steps.length === 0) {
      throw new Error('Action plan must contain at least one step');
    }

    if (response.steps.length > 10) {
      throw new Error('Action plan contains too many steps (max 10)');
    }

    // Validate each step has required fields
    for (let i = 0; i < response.steps.length; i++) {
      const step = response.steps[i];
      if (!step.action) {
        throw new Error(`Step ${i + 1} missing action type`);
      }
      if (!step.description) {
        throw new Error(`Step ${i + 1} missing description`);
      }
    }

    if (!response.explanation || typeof response.explanation !== 'string') {
      throw new Error('Missing or invalid explanation');
    }

    if (typeof response.confidence !== 'number' || response.confidence < 0 || response.confidence > 1) {
      throw new Error('Missing or invalid confidence score');
    }
  }

  /**
   * Validate that clarification response has required fields
   */
  private validateClarificationResponse(response: ClarificationResponse): void {
    if (!response.reason || typeof response.reason !== 'string') {
      throw new Error('Missing or invalid reason');
    }

    if (response.options && !Array.isArray(response.options)) {
      throw new Error('Invalid options array');
    }

    if (typeof response.confidence !== 'number' || response.confidence < 0 || response.confidence > 1) {
      throw new Error('Missing or invalid confidence score');
    }
  }

  /**
   * Create a basic fallback summary when LLM fails
   */
  private createFallbackSummary(pageState: SanitizedPageState, reason?: string): PageSummary {
    const title = pageState.title || 'Unknown Page';
    const url = pageState.url || 'about:blank';

    // Count interactive elements
    let interactiveCount = 0;
    if (pageState.extractionMethod === 'accessibility-tree' && pageState.axTree) {
      const interactiveRoles = new Set(['button', 'link', 'textbox', 'searchbox', 'combobox']);
      interactiveCount = pageState.axTree.nodes.filter((n) => interactiveRoles.has(n.role)).length;
    } else if (pageState.extractionMethod === 'simplified-dom' && pageState.simplifiedDOM) {
      interactiveCount = pageState.simplifiedDOM.elements.length;
    }

    return {
      purpose: `This is "${title}" at ${url}`,
      sections: [
        `Page contains ${interactiveCount} interactive elements`,
        reason || 'Unable to generate detailed summary - LLM service unavailable',
      ],
      availableActions: [
        'Navigate to a different page',
        'Try refreshing to generate summary again',
      ],
      accessibilityNotes: 'Summary generation failed. Page structure may be complex or LLM service is unavailable.',
      confidence: 0.1,
      generatedAt: Date.now(),
    };
  }

  /**
   * Get current token usage from provider
   */
  getTokenUsage() {
    return this.provider.getTokenUsage();
  }

  /**
   * Get LLM cache statistics
   */
  async getCacheStats(): Promise<{
    size: number;
    memorySizeKb: number;
    oldestEntry: number | null;
    newestEntry: number | null;
  }> {
    if (!this.cache) {
      return { size: 0, memorySizeKb: 0, oldestEntry: null, newestEntry: null };
    }
    return this.cache.getStats();
  }

  /**
   * Clear the LLM cache
   */
  async clearCache(): Promise<void> {
    if (this.cache) {
      await this.cache.clear();
    }
  }
}
