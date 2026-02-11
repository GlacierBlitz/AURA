import type { ContentType } from './pageTextExtractor';

export interface DetectedReadCommand {
  isReadCommand: boolean;
  contentType?: ContentType;
  originalText: string;
}

/**
 * Detects and parses read commands from user instructions
 * Examples:
 * - "read the page"
 * - "read the first paragraph"
 * - "read all headings"
 * - "read the list"
 * - "read main content"
 * - "tell me about the images on this page"
 */
export function detectReadCommand(instruction: string): DetectedReadCommand {
  const text = instruction.toLowerCase().trim();

  // Check if this is a read command
  const readPatterns = [
    /^read\b/,
    /^please read\b/,
    /^can you read\b/,
    /^tell me about/,
    /^what\s+(?:are|is)\b.*\b(?:on|in)\s+(?:this\s+)?page/,
  ];

  const isReadCommand = readPatterns.some((pattern) => pattern.test(text));

  if (!isReadCommand) {
    return {
      isReadCommand: false,
      originalText: instruction,
    };
  }

  // Extract the content type from the instruction
  const contentType = parseContentType(text);

  return {
    isReadCommand: true,
    contentType: contentType || 'main',
    originalText: instruction,
  };
}

/**
 * Parse and determine the content type from a read command
 */
function parseContentType(text: string): ContentType | undefined {
  // Check for specific content types
  const patterns: Array<[RegExp, ContentType]> = [
    // Headings
    [/heading|title|h[1-6]/, 'heading'],
    [/all\s+heading/, 'headings'],

    // Paragraphs
    [/first\s+paragraph/, 'first-paragraph'],
    [/all\s+paragraph/, 'all-paragraphs'],
    [/paragraph/, 'paragraph'],

    // Lists
    [/list|bullet/, 'list'],

    // Links
    [/link/, 'links'],

    // Images
    [/image|picture|photo/, 'images'],

    // Main content
    [/main\s+content|main\s+article|article/, 'main'],

    // Full page (default for "read the page")
    [/(?:the\s+)?page|everything|all|full/, 'full'],
  ];

  for (const [pattern, type] of patterns) {
    if (pattern.test(text)) {
      return type;
    }
  }

  // Default to full page
  return undefined;
}
