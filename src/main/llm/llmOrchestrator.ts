import type {
  SanitizedPageState,
  PageSummary,
  LLMPrompt,
  LLMResponse,
  SummaryResponse,
} from '@shared/types';
import { LLM_CONFIG } from '@shared/constants';
import type { LLMProviderAdapter } from './llmProviderAdapter';
import { SYSTEM_PROMPT, buildSummaryPrompt } from './promptTemplates';

/**
 * LLMOrchestrator manages LLM interactions for summarization and action planning.
 * Handles prompt construction, response parsing, and validation.
 */
export class LLMOrchestrator {
  private provider: LLMProviderAdapter;

  constructor(provider: LLMProviderAdapter) {
    this.provider = provider;
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

      return summary;
    } catch (error: any) {
      console.error('Failed to generate summary:', error);
      
      // Return fallback summary
      return this.createFallbackSummary(pageState);
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
   * Create a basic fallback summary when LLM fails
   */
  private createFallbackSummary(pageState: SanitizedPageState): PageSummary {
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
        'Unable to generate detailed summary - LLM service unavailable',
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
}
