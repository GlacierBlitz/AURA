/**
 * ActionValidator - Validates action descriptors against schema, runtime, and security constraints
 * 
 * PERSON 1 TODO:
 * 1. Implement schema validation (V-001 through V-008)
 * 2. Implement runtime validation (R-001 through R-006)
 * 3. Implement security validation (S-001 through S-004)
 * 4. Add unit tests in tests/unit/actionValidator.test.ts
 */

import { ActionDescriptor } from '../../shared/types/actions';

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

    // V-001: Action type must be one of 11 supported types
    // TODO: Implement

    // V-002: Required fields must be present based on action type
    // TODO: Implement

    // V-003: Field data types must match schema
    // TODO: Implement

    // V-004: Text length constraints (maxLength: 500)
    // TODO: Implement

    // V-005: Selector format validation (CSS selector syntax)
    // TODO: Implement

    // V-006: URL format validation for NAVIGATE actions
    // TODO: Implement

    // V-007: Enum value validation (e.g., scrollDirection: 'up' | 'down')
    // TODO: Implement

    // V-008: Confidence score range [0.0, 1.0]
    // TODO: Implement

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
   * Helper: Detect sensitive field patterns
   */
  private isSensitiveField(selector: string, text?: string): boolean {
    // TODO: Check for password, credit card, SSN patterns in selector/text
    return false;
  }
}
