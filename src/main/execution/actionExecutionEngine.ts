/**
 * ActionExecutionEngine - Executes validated action descriptors using CDP
 * 
 * PERSON 1 TODO:
 * 1. Implement execution for all 11 action types
 * 2. Add retry logic with exponential backoff
 * 3. Add timeout handling (max 10 seconds per action)
 * 4. Integrate with ActionValidator
 * 5. Return detailed execution results with success/error info
 */

import { Protocol } from 'devtools-protocol';
import type {
  ActionDescriptor,
  ClickAction,
  TypeAction,
  NavigateAction,
  ScrollAction,
  AccessibilityAction,
} from '@shared/types';
import type { AccessibilitySettings } from '@shared/types/accessibility';
import { ActionValidator, ValidationResult } from './actionValidator';
import * as cdp from './cdpCommands';

export interface ExecutionResult {
  success: boolean;
  action: ActionDescriptor;
  error?: string;
  executionTimeMs: number;
  retriesUsed: number;
}

export interface ExecutionConfig {
  maxRetries: number;
  timeoutMs: number;
  waitForStabilization: boolean;
}

export type AccessibilityUpdateCallback = (settings: Partial<AccessibilitySettings>) => void;

const DEFAULT_CONFIG: ExecutionConfig = {
  maxRetries: 3,
  timeoutMs: 10000,
  waitForStabilization: true
};

export class ActionExecutionEngine {
  private validator: ActionValidator;
  private accessibilityCallback?: AccessibilityUpdateCallback;

  constructor(accessibilityCallback?: AccessibilityUpdateCallback) {
    this.validator = new ActionValidator();
    this.accessibilityCallback = accessibilityCallback;
  }

  /**
   * Execute a single action
   */
  async executeAction(
    cdpSession: Protocol.ProtocolMapping.API,
    action: ActionDescriptor,
    pageUrl: string,
    config: Partial<ExecutionConfig> = {}
  ): Promise<ExecutionResult> {
    const finalConfig = { ...DEFAULT_CONFIG, ...config };
    const startTime = Date.now();
    let retriesUsed = 0;

    try {
      // Validate action first
      const validation = await this.validator.validate(action, pageUrl);
      if (!validation.isValid) {
        return {
          success: false,
          action,
          error: `Validation failed: ${validation.errors.join(', ')}`,
          executionTimeMs: Date.now() - startTime,
          retriesUsed: 0
        };
      }

      // Execute with retries
      for (let attempt = 0; attempt <= finalConfig.maxRetries; attempt++) {
        try {
          await this.executeWithTimeout(cdpSession, action, finalConfig.timeoutMs);
          
          // Wait for page to stabilize after action
          if (finalConfig.waitForStabilization) {
            await cdp.waitForStabilization(cdpSession);
          }

          return {
            success: true,
            action,
            executionTimeMs: Date.now() - startTime,
            retriesUsed: attempt
          };
        } catch (error) {
          retriesUsed = attempt + 1;
          if (attempt === finalConfig.maxRetries) {
            throw error; // Final attempt failed
          }
          // Exponential backoff: 1s, 2s, 4s
          await this.delay(Math.pow(2, attempt) * 1000);
        }
      }

      throw new Error('Should not reach here');
    } catch (error) {
      return {
        success: false,
        action,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTimeMs: Date.now() - startTime,
        retriesUsed
      };
    }
  }

  /**
   * Execute action with timeout
   */
  private async executeWithTimeout(
    cdpSession: Protocol.ProtocolMapping.API,
    action: ActionDescriptor,
    timeoutMs: number
  ): Promise<void> {
    return Promise.race([
      this.executeActionByType(cdpSession, action),
      this.timeout(timeoutMs)
    ]);
  }

  /**
   * Route to specific action implementation
   */
  private async executeActionByType(
    cdpSession: Protocol.ProtocolMapping.API,
    action: ActionDescriptor
  ): Promise<void> {
    switch (action.action) {
      case 'click':
        return this.executeClick(cdpSession, action as ClickAction);
      case 'type':
        return this.executeType(cdpSession, action as TypeAction);
      case 'navigate':
        return this.executeNavigate(cdpSession, action as NavigateAction);
      case 'scroll':
        return this.executeScroll(cdpSession, action as ScrollAction);
      case 'accessibility':
        return this.executeAccessibility(cdpSession, action as AccessibilityAction);
      case 'select':
      case 'submit':
      case 'wait':
      case 'extract':
      case 'back':
      case 'forward':
      case 'summarize':
        throw new Error(`Action type '${action.action}' not yet implemented`);
      default:
        throw new Error(`Unknown action type: ${(action as any).action}`);
    }
  }

  // ─── Core Action Implementations ───────────────────────────

  private async executeClick(cdpSession: Protocol.ProtocolMapping.API, action: ClickAction): Promise<void> {
    console.log(`Executing CLICK on selector: ${action.selector}`);
    await cdp.clickElement(cdpSession, action.selector);
  }

  private async executeType(cdpSession: Protocol.ProtocolMapping.API, action: TypeAction): Promise<void> {
    console.log(`Executing TYPE on selector: ${action.selector}, text: "${action.text}"`);
    await cdp.typeText(cdpSession, action.selector, action.text);
  }

  private async executeNavigate(cdpSession: Protocol.ProtocolMapping.API, action: NavigateAction): Promise<void> {
    console.log(`Executing NAVIGATE to URL: ${action.url}`);
    await cdp.navigateToUrl(cdpSession, action.url);
  }

  private async executeScroll(cdpSession: Protocol.ProtocolMapping.API, action: ScrollAction): Promise<void> {
    console.log(`Executing SCROLL ${action.direction}`);
    const amount = typeof action.amount === 'number' ? action.amount : undefined;
    await cdp.scroll(cdpSession, action.direction, amount, action.container);
  }

  private async executeAccessibility(cdpSession: Protocol.ProtocolMapping.API, action: AccessibilityAction): Promise<void> {
    console.log(`Executing ACCESSIBILITY: ${action.setting} = ${action.value}`);
    
    if (!this.accessibilityCallback) {
      throw new Error('Accessibility callback not configured');
    }

    // Build the settings update object
    const settingsUpdate: Partial<AccessibilitySettings> = {
      [action.setting]: action.value
    };

    // If setting a profile, this will handle all the associated settings
    if (action.setting === 'profile') {
      settingsUpdate.profile = action.value as any;
    }

    // Call the callback to update settings
    this.accessibilityCallback(settingsUpdate);

    // Small delay to allow settings to apply
    await this.delay(100);
  }

  // ─── Placeholder implementations for other actions ───────────
  
  private async executeSelect(cdpSession: Protocol.ProtocolMapping.API, action: ActionDescriptor): Promise<void> {
    throw new Error('SELECT action not yet implemented');
  }

  private async executeSubmit(cdpSession: Protocol.ProtocolMapping.API, action: ActionDescriptor): Promise<void> {
    throw new Error('SUBMIT action not yet implemented');
  }

  private async executeWait(cdpSession: Protocol.ProtocolMapping.API, action: ActionDescriptor): Promise<void> {
    throw new Error('WAIT action not yet implemented');
  }

  private async executeExtract(cdpSession: Protocol.ProtocolMapping.API, action: ActionDescriptor): Promise<void> {
    throw new Error('EXTRACT action not yet implemented');
  }

  private async executeCheck(cdpSession: Protocol.ProtocolMapping.API, action: ActionDescriptor): Promise<void> {
    throw new Error('CHECK action not yet implemented');
  }

  private async executeHover(cdpSession: Protocol.ProtocolMapping.API, action: ActionDescriptor): Promise<void> {
    throw new Error('HOVER action not yet implemented');
  }

  private async executeFocus(cdpSession: Protocol.ProtocolMapping.API, action: ActionDescriptor): Promise<void> {
    throw new Error('FOCUS action not yet implemented');
  }

  /**
   * Helper: Delay for X milliseconds
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Helper: Timeout promise
   */
  private timeout(ms: number): Promise<never> {
    return new Promise((_, reject) => 
      setTimeout(() => reject(new Error(`Action timed out after ${ms}ms`)), ms)
    );
  }
}
