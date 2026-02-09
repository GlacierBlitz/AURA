import type { PageSummary } from '@shared/types';
import { PageStateExtractor } from './pageStateExtractor';
import { ContentSanitizer } from './contentSanitizer';
import { LLMOrchestrator } from '../llm/llmOrchestrator';

/**
 * IntentPipeline orchestrates the full page load and summarization flow
 * Flow: Page Load → Extract State → Sanitize → Summarize → Send to Renderer
 */
export class IntentPipeline {
  private extractor: PageStateExtractor;
  private sanitizer: ContentSanitizer;
  private orchestrator: LLMOrchestrator;
  private onSummaryCallback?: (summary: PageSummary, url: string) => void;
  private onStatusCallback?: (status: string) => void;
  private onErrorCallback?: (error: Error) => void;

  constructor(orchestrator: LLMOrchestrator) {
    this.extractor = new PageStateExtractor();
    this.sanitizer = new ContentSanitizer();
    this.orchestrator = orchestrator;
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
   * Process page load: extract, sanitize, summarize
   */
  async processPageLoad(cdpSession: Electron.Debugger, url: string): Promise<void> {
    try {
      // Update status: extracting
      this.updateStatus('extracting');

      // Step 1: Extract page state
      console.log('Extracting page state...');
      const pageState = await this.extractor.extractPageState(cdpSession);
      console.log(`Extracted page state using ${pageState.extractionMethod}`);

      // Step 2: Sanitize content
      console.log('Sanitizing page content...');
      const sanitizedState = this.sanitizer.sanitize(pageState);
      console.log(
        `Sanitized: removed ${sanitizedState.sanitizationMetadata?.removedElements} elements, ` +
        `truncated ${sanitizedState.sanitizationMetadata?.truncatedFields} fields`
      );

      if (sanitizedState.sanitizationMetadata?.suspiciousContentDetected) {
        console.warn('⚠️  Suspicious content detected in page state');
      }

      // Update status: processing (sending to LLM)
      this.updateStatus('processing');

      // Step 3: Generate summary
      console.log('Generating summary with LLM...');
      const summary = await this.orchestrator.generateSummary(sanitizedState);
      console.log(`Summary generated with confidence ${summary.confidence}`);

      // Step 4: Send to renderer
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
   * Update pipeline status
   */
  private updateStatus(status: string): void {
    if (this.onStatusCallback) {
      this.onStatusCallback(status);
    }
  }
}
