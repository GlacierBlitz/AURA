/**
 * PageTextExtractor extracts readable text content from a web page
 * Optimized for text-to-speech output
 */
export class PageTextExtractor {
  /**
   * Extract readable text from the current page using CDP
   * Focuses on content that would be meaningful to read aloud
   */
  async extractReadableText(cdpSession: Electron.Debugger): Promise<string> {
    const script = `
      (() => {
        // Helper function to get text nodes
        function getReadableText() {
          const contentElements = [];
          
          // Define elements that contain readable content
          const selectorsToInclude = [
            'main', 'article', '[role="main"]', '[role="article"]',
            'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
            'p', 'li', 'dd', 'dt',
            'blockquote', 'pre',
            '[role="navigation"] a',
            'label', 'legend',
            'figcaption',
            '[role="region"]'
          ];
          
          // Elements to skip (would be noise)
          const selectorsToExclude = [
            'script', 'style', 'link', 'meta',
            '[role="navigation"]',
            'nav',
            '.sidebar', '.ads', '.advertisement',
            '.comments', '.footer',
            '[class*="nav"]', '[id*="nav"]',
            '.modal', '.dialog',
            '.hidden', '[hidden]',
            'svg', 'canvas'
          ];
          
          // Get the main content area
          let mainContent = document.querySelector('main');
          if (!mainContent) {
            mainContent = document.querySelector('[role="main"]');
          }
          
          // Use main content if available, otherwise use body
          const targetElement = mainContent || document.body;
          
          // Helper: Check if element is visible
          function isVisible(el) {
            if (!el) return false;
            const rect = el.getBoundingClientRect();
            const style = window.getComputedStyle(el);
            return rect.height > 0 && 
                   style.visibility !== 'hidden' && 
                   style.display !== 'none' &&
                   parseFloat(style.opacity) > 0;
          }
          
          // Helper: Check if element should be skipped
          function shouldSkip(el) {
            // Check if element matches exclude selectors
            for (const selector of selectorsToExclude) {
              if (el.matches(selector)) return true;
            }
            return false;
          }
          
          // Extract text from specific elements
          const textParts = [];
          
          // Add page title
          const title = document.title || document.querySelector('h1')?.textContent;
          if (title) {
            textParts.push(title.trim());
          }
          
          // Process main content area
          const walker = document.createTreeWalker(
            targetElement,
            NodeFilter.SHOW_ELEMENT,
            {
              acceptNode: function(node) {
                if (!isVisible(node)) {
                  return NodeFilter.FILTER_REJECT;
                }
                
                if (shouldSkip(node)) {
                  return NodeFilter.FILTER_REJECT;
                }
                
                const tagName = node.tagName.toLowerCase();
                
                // Include headers
                if (/^h[1-6]$/.test(tagName)) {
                  return NodeFilter.FILTER_ACCEPT;
                }
                
                // Include paragraphs and list items
                if (tagName === 'p' || tagName === 'li' || tagName === 'dd' || tagName === 'blockquote') {
                  return NodeFilter.FILTER_ACCEPT;
                }
                
                // Include interactive labels
                if (tagName === 'label' || tagName === 'legend') {
                  return NodeFilter.FILTER_ACCEPT;
                }
                
                // Include table cells with content
                if ((tagName === 'td' || tagName === 'th') && node.textContent && node.textContent.trim()) {
                  return NodeFilter.FILTER_ACCEPT;
                }
                
                // Include figcaption
                if (tagName === 'figcaption') {
                  return NodeFilter.FILTER_ACCEPT;
                }
                
                // Skip but traverse children
                return NodeFilter.FILTER_SKIP;
              }
            }
          );
          
          let currentNode;
          while (currentNode = walker.nextNode()) {
            const text = currentNode.textContent?.trim();
            if (text && text.length > 0) {
              // Skip very short fragments (single words/numbers that are likely UI)
              if (text.length > 2 || /^[A-Z]/.test(text)) {
                textParts.push(text);
              }
            }
          }
          
          // Join and clean up the text
          let fullText = textParts.join('\\n\\n');
          
          // Remove excessive whitespace and normalize line breaks
          fullText = fullText
            .replace(/\\n\\n+/g, '\\n\\n')  // Multiple line breaks to double
            .replace(/\\s+/g, ' ')           // Multiple spaces to single
            .replace(/\\n /g, '\\n')         // Remove space after line breaks
            .trim();
          
          return fullText;
        }
        
        return getReadableText();
      })();
    `;

    try {
      const result = await cdpSession.sendCommand('Runtime.evaluate', {
        expression: script,
        returnByValue: true,
      });

      if (result.result?.value && typeof result.result.value === 'string') {
        return result.result.value;
      }

      return 'Could not extract page content.';
    } catch (error) {
      console.error('Failed to extract readable text:', error);
      return 'Sorry, I could not read the page content.';
    }
  }

  /**
   * Extract page metadata (title and URL)
   */
  async extractPageMetadata(
    cdpSession: Electron.Debugger
  ): Promise<{ title: string; url: string }> {
    const script = `
      JSON.stringify({
        title: document.title,
        url: window.location.href
      })
    `;

    try {
      const result = await cdpSession.sendCommand('Runtime.evaluate', {
        expression: script,
        returnByValue: true,
      });

      if (result.result?.value) {
        return JSON.parse(result.result.value);
      }

      return { title: 'Page', url: 'about:blank' };
    } catch (error) {
      console.error('Failed to extract page metadata:', error);
      return { title: 'Page', url: 'about:blank' };
    }
  }
}
