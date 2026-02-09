import type { PageState, SanitizedPageState } from '@shared/types';
import { EXTRACTION_CONFIG } from '@shared/constants';

/**
 * ContentSanitizer sanitizes page state before sending to LLM.
 * Implements 5-layer prompt injection defense (Layer 1: Input Separation & Sanitization)
 */
export class ContentSanitizer {
  private static readonly SUSPICIOUS_PATTERNS = [
    /ignore\s+(all\s+)?(previous|prior|above)\s+instructions?/gi,
    /disregard\s+(all\s+)?(previous|prior|above)/gi,
    /forget\s+(all\s+)?(previous|prior|above)/gi,
    /new\s+instructions?:/gi,
    /system\s*:/gi,
    /you\s+are\s+(now\s+)?a\s+/gi,
    /act\s+as\s+(if\s+)?/gi,
    /pretend\s+(you\s+are|to\s+be)/gi,
    /rolep lay/gi,
  ];

  private static readonly MAX_TEXT_LENGTH = 500;

  /**
   * Sanitize page state by removing hidden elements, truncating text, and flagging suspicious content
   */
  sanitize(pageState: PageState): SanitizedPageState {
    const sanitized: SanitizedPageState = {
      ...pageState,
      sanitized: true,
      sanitizationMetadata: {
        removedElements: 0,
        truncatedFields: 0,
        suspiciousContentDetected: false,
        sanitizedAt: Date.now(),
      },
    };

    // Sanitize based on extraction method
    if (pageState.extractionMethod === 'accessibility-tree' && pageState.axTree) {
      this.sanitizeAccessibilityTree(sanitized);
    } else if (pageState.extractionMethod === 'simplified-dom' && pageState.simplifiedDOM) {
      this.sanitizeSimplifiedDOM(sanitized);
    }

    return sanitized;
  }

  /**
   * Sanitize accessibility tree
   */
  private sanitizeAccessibilityTree(pageState: SanitizedPageState): void {
    if (!pageState.axTree) return;

    const originalCount = pageState.axTree.nodes.length;
    
    // Filter out meaningless or hidden nodes
    pageState.axTree.nodes = pageState.axTree.nodes.filter((node) => {
      // Remove generic containers with no semantic value
      if (node.role === 'generic' && !node.name && !node.description) {
        return false;
      }

      // Remove nodes marked as hidden
      if (node.properties?.hidden === true) {
        return false;
      }

      return true;
    });

    // Truncate long text fields and check for suspicious content
    pageState.axTree.nodes.forEach((node) => {
      const originalName = node.name;
      const originalDescription = node.description;

      // Truncate name
      if (node.name && node.name.length > ContentSanitizer.MAX_TEXT_LENGTH) {
        node.name = node.name.substring(0, ContentSanitizer.MAX_TEXT_LENGTH) + '...';
        pageState.sanitizationMetadata!.truncatedFields++;
      }

      // Truncate description
      if (node.description && node.description.length > ContentSanitizer.MAX_TEXT_LENGTH) {
        node.description = node.description.substring(0, ContentSanitizer.MAX_TEXT_LENGTH) + '...';
        pageState.sanitizationMetadata!.truncatedFields++;
      }

      // Truncate value
      if (node.value && typeof node.value === 'string' && node.value.length > ContentSanitizer.MAX_TEXT_LENGTH) {
        node.value = node.value.substring(0, ContentSanitizer.MAX_TEXT_LENGTH) + '...';
        pageState.sanitizationMetadata!.truncatedFields++;
      }

      // Check for suspicious patterns
      if (
        this.containsSuspiciousContent(originalName) ||
        this.containsSuspiciousContent(originalDescription) ||
        this.containsSuspiciousContent(typeof node.value === 'string' ? node.value : '')
      ) {
        pageState.sanitizationMetadata!.suspiciousContentDetected = true;
        console.warn('Suspicious content detected in AX node:', node.role, node.name);
      }
    });

    pageState.sanitizationMetadata!.removedElements = originalCount - pageState.axTree.nodes.length;
  }

  /**
   * Sanitize simplified DOM
   */
  private sanitizeSimplifiedDOM(pageState: SanitizedPageState): void {
    if (!pageState.simplifiedDOM) return;

    const originalCount = pageState.simplifiedDOM.elements.length;

    // Filter out elements that shouldn't be included
    pageState.simplifiedDOM.elements = pageState.simplifiedDOM.elements.filter((element) => {
      // Remove disabled or hidden elements
      if (element.attributes?.disabled === true) {
        return false;
      }

      // Remove elements with no meaningful content
      if (!element.name && !element.value && !element.attributes?.placeholder) {
        return false;
      }

      return true;
    });

    // Truncate long text fields and check for suspicious content
    pageState.simplifiedDOM.elements.forEach((element) => {
      const originalName = element.name;
      const originalValue = element.value;

      // Truncate name (text content)
      if (element.name && element.name.length > ContentSanitizer.MAX_TEXT_LENGTH) {
        element.name = element.name.substring(0, ContentSanitizer.MAX_TEXT_LENGTH) + '...';
        pageState.sanitizationMetadata!.truncatedFields++;
      }

      // Truncate value
      if (element.value && element.value.length > ContentSanitizer.MAX_TEXT_LENGTH) {
        element.value = element.value.substring(0, ContentSanitizer.MAX_TEXT_LENGTH) + '...';
        pageState.sanitizationMetadata!.truncatedFields++;
      }

      // Truncate placeholder
      if (element.attributes?.placeholder && element.attributes.placeholder.length > ContentSanitizer.MAX_TEXT_LENGTH) {
        element.attributes.placeholder = element.attributes.placeholder.substring(0, ContentSanitizer.MAX_TEXT_LENGTH) + '...';
        pageState.sanitizationMetadata!.truncatedFields++;
      }

      // Check for suspicious patterns
      if (
        this.containsSuspiciousContent(originalName) ||
        this.containsSuspiciousContent(originalValue) ||
        this.containsSuspiciousContent(element.attributes?.placeholder || '')
      ) {
        pageState.sanitizationMetadata!.suspiciousContentDetected = true;
        console.warn('Suspicious content detected in DOM element:', element.tagName, element.name);
      }
    });

    pageState.sanitizationMetadata!.removedElements = originalCount - pageState.simplifiedDOM.elements.length;
  }

  /**
   * Check if text contains suspicious instructional patterns (prompt injection attempt)
   */
  private containsSuspiciousContent(text: string | undefined): boolean {
    if (!text) return false;

    for (const pattern of ContentSanitizer.SUSPICIOUS_PATTERNS) {
      if (pattern.test(text)) {
        return true;
      }
    }

    return false;
  }
}
