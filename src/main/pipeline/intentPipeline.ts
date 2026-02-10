import type { PageSummary, ActionPlanResponse, ClarificationResponse, ConversationTurn, ActionResult } from '@shared/types';
import type { AccessibilitySettings } from '@shared/types/accessibility';
import { PageStateExtractor } from './pageStateExtractor';
import { ContentSanitizer } from './contentSanitizer';
import { LLMOrchestrator } from '../llm/llmOrchestrator';
import { ActionExecutionEngine, AccessibilityUpdateCallback } from '../execution/actionExecutionEngine';
import { ContextManager } from './contextManager';

/**
 * IntentPipeline orchestrates the full page load and summarization flow
 * Flow: Page Load → Extract State → Sanitize → Summarize → Send to Renderer
 */
export class IntentPipeline {
  private extractor: PageStateExtractor;
  private sanitizer: ContentSanitizer;
  private orchestrator: LLMOrchestrator;
  private actionEngine: ActionExecutionEngine;
  private contextManager: ContextManager;
  private onSummaryCallback?: (summary: PageSummary, url: string) => void;
  private onStatusCallback?: (status: string) => void;
  private onErrorCallback?: (error: Error) => void;
  private onActionPlanCallback?: (plan: ActionPlanResponse) => void;
  private onClarificationCallback?: (clarification: ClarificationResponse) => void;
  private onActionResultCallback?: (result: ActionResult) => void;

  // Cache the current page state to avoid duplicate extraction
  private currentPageState: {
    url: string;
    sanitizedState: any;
    timestamp: number;
  } | null = null;
  private readonly PAGE_STATE_CACHE_TTL = 5000; // 5 seconds

  constructor(orchestrator: LLMOrchestrator, accessibilityCallback?: AccessibilityUpdateCallback) {
    this.extractor = new PageStateExtractor();
    this.sanitizer = new ContentSanitizer();
    this.orchestrator = orchestrator;
    this.actionEngine = new ActionExecutionEngine(accessibilityCallback);
    this.contextManager = new ContextManager();
  }

  /**
   * Register callback for when summary is generated
   */
  onSummary(callback: (summary: PageSummary, url: string) => void): void {
    this.onSummaryCallback = callback;
  }

  /**
   * Register callback for pipeline status updates
   */
  onStatus(callback: (status: string) => void): void {
    this.onStatusCallback = callback;
  }

  /**
   * Register callback for pipeline errors
   */
  onError(callback: (error: Error) => void): void {
    this.onErrorCallback = callback;
  }

  /**
   * Register callback for when action plan is generated
   */
  onActionPlan(callback: (plan: ActionPlanResponse) => void): void {
    this.onActionPlanCallback = callback;
  }

  /**
   * Register callback for when clarification is needed
   */
  onClarification(callback: (clarification: ClarificationResponse) => void): void {
    this.onClarificationCallback = callback;
  }

  /**
   * Register callback for when action result is available
   */
  onActionResult(callback: (result: ActionResult) => void): void {
    this.onActionResultCallback = callback;
  }

  /**
   * Get or extract current page state (with caching to avoid duplicate extractions)
   */
  private async getOrExtractPageState(
    cdpSession: Electron.Debugger,
    url: string
  ): Promise<any> {
    const now = Date.now();
    
    // Check if we have a valid cached state for this URL
    if (this.currentPageState) {
      const cacheAge = now - this.currentPageState.timestamp;
      const urlMatches = this.currentPageState.url === url;
      const notExpired = cacheAge < this.PAGE_STATE_CACHE_TTL;
      
      console.log(`Cache check: url match=${urlMatches}, age=${cacheAge}ms, expired=${!notExpired}`);
      if (!urlMatches) {
        console.log(`  Cached URL: "${this.currentPageState.url}"`);
        console.log(`  Current URL: "${url}"`);
      }
      
      if (urlMatches && notExpired) {
        console.log('✓ Using cached page state (< 5s old)');
        return this.currentPageState.sanitizedState;
      }
    }

    // Extract fresh page state
    console.log('Extracting page state...');
    const pageState = await this.extractor.extractPageState(cdpSession);
    console.log(`Extracted page state using ${pageState.extractionMethod}`);

    // Sanitize content
    console.log('Sanitizing page content...');
    const sanitizedState = this.sanitizer.sanitize(pageState);
    console.log(
      `Sanitized: removed ${sanitizedState.sanitizationMetadata?.removedElements} elements, ` +
      `truncated ${sanitizedState.sanitizationMetadata?.truncatedFields} fields`
    );

    if (sanitizedState.sanitizationMetadata?.suspiciousContentDetected) {
      console.warn('⚠️  Suspicious content detected in page state');
    }

    // Cache the sanitized state
    this.currentPageState = {
      url,
      sanitizedState,
      timestamp: now,
    };

    return sanitizedState;
  }

  /**
   * Process page load: extract, sanitize, summarize
   */
  async processPageLoad(cdpSession: Electron.Debugger, url: string): Promise<void> {
    console.log(`[processPageLoad] Starting for URL: ${url}`);
    try {
      // Update status: extracting
      this.updateStatus('extracting');

      // Step 1: Get or extract page state (uses cache if available)
      const sanitizedState = await this.getOrExtractPageState(cdpSession, url);

      // Update status: processing (sending to LLM)
      this.updateStatus('processing');

      // Step 2: Generate summary
      console.log('Generating summary with LLM...');
      const summary = await this.orchestrator.generateSummary(sanitizedState);
      console.log(`Summary generated with confidence ${summary.confidence}`);

      // Step 3: Send to renderer
      this.updateStatus('idle');
      
      if (this.onSummaryCallback) {
        this.onSummaryCallback(summary, url);
      }

    } catch (error: any) {
      console.error('Pipeline error:', error);
      this.updateStatus('error');
      
      if (this.onErrorCallback) {
        this.onErrorCallback(error);
      }
    }
  }

  /**
   * Process user instruction: extract current page state, translate intent to actions
   */
  async processUserInstruction(
    instruction: string,
    cdpSession: Electron.Debugger,
    conversationHistory: ConversationTurn[] = []
  ): Promise<void> {
    try {
      // Update status: extracting
      this.updateStatus('extracting');

      // Step 1: Get or extract current page state (uses cache if available)
      // Note: We need to get the current URL from the CDP session
      const urlResult = await cdpSession.sendCommand('Runtime.evaluate', {
        expression: 'window.location.href',
        returnByValue: true,
      });
      const currentUrl = urlResult.result.value as string;

      const sanitizedState = await this.getOrExtractPageState(cdpSession, currentUrl);

      // Update status: processing (sending to LLM)
      this.updateStatus('processing');

      // Step 3: Translate intent to action plan
      console.log('Translating instruction with LLM...');
      const response = await this.orchestrator.translateIntent(
        instruction,
        sanitizedState,
        conversationHistory
      );
      console.log(`Response type: ${response.type}, confidence: ${response.confidence}`);

      // Step 4: Handle response type
      if (response.type === 'clarification') {
        // User instruction was unclear
        console.log('Clarification needed:', response.reason);
        this.updateStatus('idle');
        if (this.onClarificationCallback) {
          this.onClarificationCallback(response);
        }
        return;
      }

      // Action plan generated successfully
      console.log(`Action plan generated with ${response.steps.length} steps`);
      if (this.onActionPlanCallback) {
        this.onActionPlanCallback(response);
      }

      // Step 5: Execute actions
      this.updateStatus('executing');
      console.log('Executing action plan...');

      const actionResults: ActionResult[] = [];
      for (let i = 0; i < response.steps.length; i++) {
        const step = response.steps[i];
        console.log(`Executing step ${i + 1}/${response.steps.length}: ${step.action} - ${step.description}`);

        try {
          const executionResult = await this.actionEngine.executeAction(
            cdpSession,
            step,
            sanitizedState.url
          );

          const actionResult: ActionResult = {
            action: step,
            status: executionResult.success ? 'success' : 'failure',
            error: executionResult.error ? {
              code: 'EXECUTION_ERROR',
              message: executionResult.error,
              retryable: executionResult.retriesUsed < 3
            } : undefined,
            timestamp: new Date().toISOString(),
          };

          actionResults.push(actionResult);

          // Send result to renderer
          console.log(`[intentPipeline] Calling onActionResultCallback for action: ${step.description}`);
          if (this.onActionResultCallback) {
            this.onActionResultCallback(actionResult);
          } else {
            console.warn('[intentPipeline] onActionResultCallback is not set!');
          }

          // If action failed and not retryable, stop execution
          if (!executionResult.success && executionResult.error) {
            console.error(`Action ${i + 1} failed: ${executionResult.error}`);
            break;
          }

          console.log(`Action ${i + 1} completed successfully in ${executionResult.executionTimeMs}ms`);
        } catch (error: any) {
          console.error(`Fatal error executing action ${i + 1}:`, error);
          const actionResult: ActionResult = {
            action: step,
            status: 'failure',
            error: {
              code: 'EXECUTION_ERROR',
              message: error.message || 'Unknown error',
              retryable: false
            },
            timestamp: new Date().toISOString(),
          };
          actionResults.push(actionResult);
          if (this.onActionResultCallback) {
            this.onActionResultCallback(actionResult);
          }
          break;
        }
      }

      // Step 6: Invalidate page state cache (page changed due to actions)
      this.currentPageState = null;
      
      // Step 7: Update context with results
      this.contextManager.addPageState(sanitizedState.url, sanitizedState, actionResults);

      this.updateStatus('idle');
      console.log(`Action execution complete. ${actionResults.length} actions executed.`);

    } catch (error: any) {
      console.error('Pipeline error during instruction processing:', error);
      this.updateStatus('error');
      
      if (this.onErrorCallback) {
        this.onErrorCallback(error);
      }
    }
  }

  /**
   * Update pipeline status
   */
  private updateStatus(status: string): void {
    if (this.onStatusCallback) {
      this.onStatusCallback(status);
    }
  }
}
