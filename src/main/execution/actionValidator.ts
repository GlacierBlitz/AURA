/**
 * ActionValidator - Validates action descriptors against schema, runtime, and security constraints
 * 
 * PERSON 1 TODO:
 * 1. Implement schema validation (V-001 through V-008)
 * 2. Implement runtime validation (R-001 through R-006)
 * 3. Implement security validation (S-001 through S-004)
 * 4. Add unit tests in tests/unit/actionValidator.test.ts
 */

import type { ActionDescriptor, NavigateAction, ClickAction, TypeAction, ScrollAction, AccessibilityAction } from '@shared/types';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export class ActionValidator {
  /**
   * Validates an action descriptor against all validation rules
   */
  async validate(action: ActionDescriptor, pageUrl: string): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // TODO: Implement schema validation
    const schemaErrors = this.validateSchema(action);
    errors.push(...schemaErrors);

    // TODO: Implement runtime validation
    const runtimeErrors = await this.validateRuntime(action, pageUrl);
    errors.push(...runtimeErrors);

    // TODO: Implement security validation
    const securityResult = this.validateSecurity(action, pageUrl);
    errors.push(...securityResult.errors);
    warnings.push(...securityResult.warnings);

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Schema Validation Rules (V-001 through V-008)
   */
  private validateSchema(action: ActionDescriptor): string[] {
    const errors: string[] = [];

    // V-001: Action type must be one of 12 supported types
    const validTypes = [
      'navigate', 'click', 'type', 'select', 'submit',
      'scroll', 'back', 'forward', 'wait', 'extract', 'summarize', 'accessibility',
      'open_accessibility_panel'
    ];
    if (!validTypes.includes(action.action)) {
      errors.push(`Invalid action type: ${action.action}`);
      return errors; // Early return if action type is invalid
    }

    // V-002: Required fields must be present based on action type
    if (!action.description || action.description.trim() === '') {
      errors.push('Missing required field: description');
    }

    // Type-specific required field validation
    switch (action.action) {
      case 'navigate':
        const navAction = action as NavigateAction;
        if (!navAction.url || navAction.url.trim() === '') {
          errors.push('NAVIGATE action missing required field: url');
        } else {
          // V-006: URL format validation for NAVIGATE actions
          if (!this.isValidUrl(navAction.url)) {
            errors.push(`Invalid URL format: ${navAction.url}`);
          }
          // Check URL scheme for security
          const securityError = this.validateUrlScheme(navAction.url);
          if (securityError) {
            errors.push(securityError);
          }
        }
        break;
      
      case 'click':
        const clickAction = action as ClickAction;
        if (!clickAction.selector || clickAction.selector.trim() === '') {
          errors.push('CLICK action missing required field: selector');
        }
        break;
      
      case 'type':
        const typeAction = action as TypeAction;
        if (!typeAction.selector || typeAction.selector.trim() === '') {
          errors.push('TYPE action missing required field: selector');
        }
        if (!typeAction.text && typeAction.text !== '') {
          errors.push('TYPE action missing required field: text');
        }
        // V-004: Text length constraints
        if (typeAction.text && typeAction.text.length > 500) {
          errors.push(`Text too long: ${typeAction.text.length} characters (max 500)`);
        }
        break;
      
      case 'scroll':
        const scrollAction = action as ScrollAction;
        if (!scrollAction.direction) {
          errors.push('SCROLL action missing required field: direction');
        }
        // V-007: Enum value validation
        if (scrollAction.direction && !['up', 'down'].includes(scrollAction.direction)) {
          errors.push(`Invalid scroll direction: ${scrollAction.direction}`);
        }
        break;
      
      case 'accessibility':
        const accessibilityAction = action as AccessibilityAction;
        if (!accessibilityAction.setting) {
          errors.push('ACCESSIBILITY action missing required field: setting');
        }
        if (accessibilityAction.value === undefined || accessibilityAction.value === null) {
          errors.push('ACCESSIBILITY action missing required field: value');
        }
        // Validate setting and value types
        const validSettings = ['fontSize', 'lineSpacing', 'highContrast', 'colorFilter', 'simplifyLayout', 'profile'];
        if (accessibilityAction.setting && !validSettings.includes(accessibilityAction.setting)) {
          errors.push(`Invalid accessibility setting: ${accessibilityAction.setting}`);
        }
        // Type validation
        if (accessibilityAction.setting === 'fontSize' || accessibilityAction.setting === 'lineSpacing') {
          if (typeof accessibilityAction.value !== 'number') {
            errors.push(`${accessibilityAction.setting} value must be a number`);
          } else {
            // Range validation
            if (accessibilityAction.setting === 'fontSize' && (accessibilityAction.value < 50 || accessibilityAction.value > 300)) {
              errors.push('fontSize must be between 50 and 300');
            }
            if (accessibilityAction.setting === 'lineSpacing' && (accessibilityAction.value < 1.0 || accessibilityAction.value > 3.0)) {
              errors.push('lineSpacing must be between 1.0 and 3.0');
            }
          }
        } else if (accessibilityAction.setting === 'highContrast' || accessibilityAction.setting === 'simplifyLayout') {
          if (typeof accessibilityAction.value !== 'boolean') {
            errors.push(`${accessibilityAction.setting} value must be a boolean`);
          }
        } else if (accessibilityAction.setting === 'colorFilter') {
          const validFilters = ['none', 'protanopia', 'deuteranopia', 'tritanopia', 'grayscale'];
          if (typeof accessibilityAction.value !== 'string' || !validFilters.includes(accessibilityAction.value)) {
            errors.push(`colorFilter value must be one of: ${validFilters.join(', ')}`);
          }
        } else if (accessibilityAction.setting === 'profile') {
          const validProfiles = ['default', 'high-contrast', 'large-text', 'color-blind', 'simplified', 'custom'];
          if (typeof accessibilityAction.value !== 'string' || !validProfiles.includes(accessibilityAction.value)) {
            errors.push(`profile value must be one of: ${validProfiles.join(', ')}`);
          }
        }
        break;
      case 'open_accessibility_panel':
        break;
    }

    return errors;
  }

  /**
   * Runtime Validation Rules (R-001 through R-006)
   */
  private async validateRuntime(action: ActionDescriptor, pageUrl: string): Promise<string[]> {
    const errors: string[] = [];

    // R-001: Element existence check (selector must match an element)
    // TODO: Implement using CDP Runtime.evaluate

    // R-002: Element visibility check (element must be visible)
    // TODO: Implement

    // R-003: Element interactability check (not disabled, not readonly for inputs)
    // TODO: Implement

    // R-004: Form validation (required fields, correct types)
    // TODO: Implement

    // R-005: Page state consistency (page hasn't changed during validation)
    // TODO: Implement

    // R-006: Duplicate action prevention (same action not executed within 2 seconds)
    // TODO: Implement

    return errors;
  }

  /**
   * Security Validation Rules (S-001 through S-004)
   */
  private validateSecurity(action: ActionDescriptor, pageUrl: string): { errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // S-001: Cross-origin navigation check (warn on domain change)
    // TODO: Implement

    // S-002: Sensitive field detection (password, credit card, SSN patterns)
    // TODO: Implement

    // S-003: Destructive action detection (delete, remove, close account)
    // TODO: Implement

    // S-004: File upload restriction (only allow specific file types)
    // TODO: Implement

    return { errors, warnings };
  }

  /**
   * Helper: Check if selector is valid CSS selector syntax
   */
  private isValidSelector(selector: string): boolean {
    // TODO: Implement
    return true;
  }

  /**
   * Helper: Check if URL is valid
   */
  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Helper: Validate URL scheme for security
   */
  private validateUrlScheme(url: string): string | null {
    try {
      const urlObj = new URL(url);
      const allowedSchemes = ['http:', 'https:', 'file:'];
      if (!allowedSchemes.includes(urlObj.protocol)) {
        return `Unsafe URL scheme: ${urlObj.protocol} (allowed: http, https, file)`;
      }
      // Warn about javascript: and data: schemes
      if (urlObj.protocol === 'javascript:' || urlObj.protocol === 'data:') {
        return `Blocked dangerous URL scheme: ${urlObj.protocol}`;
      }
      return null;
    } catch {
      return 'Invalid URL';
    }
  }

  /**
   * Helper: Detect sensitive field patterns
   */
  private isSensitiveField(selector: string, text?: string): boolean {
    // TODO: Check for password, credit card, SSN patterns in selector/text
    return false;
  }
}
