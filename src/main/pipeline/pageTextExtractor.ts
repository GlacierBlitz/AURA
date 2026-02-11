/**
 * PageTextExtractor extracts readable text content from a web page
 * Optimized for text-to-speech output
 * Supports both full page extraction and targeted content extraction
 */
export type ContentType = 'full' | 'main' | 'heading' | 'paragraph' | 'first-paragraph' | 'all-paragraphs' | 'headings' | 'list' | 'images' | 'links';

export class PageTextExtractor {
  /**
   * Extract targeted content based on a content type
   * Used when user requests specific content (e.g., "read the first paragraph")
   */
  async extractTargetedContent(cdpSession: Electron.Debugger, contentType: ContentType): Promise<string> {
    const script = this.buildExtractionScript(contentType);

    try {
      const result = await cdpSession.sendCommand('Runtime.evaluate', {
        expression: script,
        returnByValue: true,
      });

      if (result.result?.value && typeof result.result.value === 'string') {
        return result.result.value || 'No content found.';
      }

      return 'Could not extract the requested content.';
    } catch (error) {
      console.error('Failed to extract targeted content:', error);
      return 'Sorry, I could not extract the requested content.';
    }
  }

  /**
   * Build extraction script based on content type
   */
  private buildExtractionScript(contentType: ContentType): string {
    switch (contentType) {
      case 'heading':
      case 'headings':
        return this.getHeadingScript();
      case 'paragraph':
      case 'first-paragraph':
        return this.getFirstParagraphScript();
      case 'all-paragraphs':
        return this.getAllParagraphsScript();
      case 'list':
        return this.getListScript();
      case 'links':
        return this.getLinksScript();
      case 'images':
        return this.getImageDescriptionsScript();
      case 'main':
        return this.getMainContentScript();
      case 'full':
      default:
        return this.getFullPageScript();
    }
  }

  /**
   * Script to extract just the main heading
   */
  private getHeadingScript(): string {
    return `
      (() => {
        function isVisible(el) {
          if (!el) return false;
          const rect = el.getBoundingClientRect();
          const style = window.getComputedStyle(el);
          return rect.height > 0 && 
                 style.visibility !== 'hidden' && 
                 style.display !== 'none' &&
                 parseFloat(style.opacity) > 0;
        }
        
        // Try to find the main heading
        const headings = Array.from(document.querySelectorAll('h1, h2, [role="heading"]')).filter(isVisible);
        if (headings.length > 0) {
          return headings[0].textContent?.trim() || 'No heading found';
        }
        
        return document.title || 'No heading found';
      })();
    `;
  }

  /**
   * Script to extract the first paragraph
   */
  private getFirstParagraphScript(): string {
    return `
      (() => {
        function isVisible(el) {
          if (!el) return false;
          const rect = el.getBoundingClientRect();
          const style = window.getComputedStyle(el);
          return rect.height > 0 && 
                 style.visibility !== 'hidden' && 
                 style.display !== 'none' &&
                 parseFloat(style.opacity) > 0;
        }
        
        // Find main content area
        let mainContent = document.querySelector('main') || 
                          document.querySelector('[role="main"]') || 
                          document.body;
        
        // Find first visible paragraph with meaningful content
        const paragraphs = Array.from(mainContent.querySelectorAll('p')).filter(p => 
          isVisible(p) && p.textContent?.trim().length > 20
        );
        
        if (paragraphs.length > 0) {
          return paragraphs[0].textContent?.trim() || 'No paragraph found';
        }
        
        return 'No paragraph found';
      })();
    `;
  }

  /**
   * Script to extract all paragraphs
   */
  private getAllParagraphsScript(): string {
    return `
      (() => {
        function isVisible(el) {
          if (!el) return false;
          const rect = el.getBoundingClientRect();
          const style = window.getComputedStyle(el);
          return rect.height > 0 && 
                 style.visibility !== 'hidden' && 
                 style.display !== 'none' &&
                 parseFloat(style.opacity) > 0;
        }
        
        // Find main content area
        let mainContent = document.querySelector('main') || 
                          document.querySelector('[role="main"]') || 
                          document.body;
        
        // Get all visible paragraphs
        const paragraphs = Array.from(mainContent.querySelectorAll('p')).filter(p => 
          isVisible(p) && p.textContent?.trim().length > 10
        );
        
        if (paragraphs.length === 0) {
          return 'No paragraphs found';
        }
        
        return paragraphs.map(p => p.textContent?.trim()).join('\\n\\n');
      })();
    `;
  }

  /**
   * Script to extract list content
   */
  private getListScript(): string {
    return `
      (() => {
        function isVisible(el) {
          if (!el) return false;
          const rect = el.getBoundingClientRect();
          const style = window.getComputedStyle(el);
          return rect.height > 0 && 
                 style.visibility !== 'hidden' && 
                 style.display !== 'none' &&
                 parseFloat(style.opacity) > 0;
        }
        
        // Find main content area
        let mainContent = document.querySelector('main') || 
                          document.querySelector('[role="main"]') || 
                          document.body;
        
        // Get first visible list
        const lists = Array.from(mainContent.querySelectorAll('ul, ol, [role="list"]')).filter(isVisible);
        if (lists.length === 0) {
          return 'No lists found';
        }
        
        const listItems = Array.from(lists[0].querySelectorAll('li, [role="listitem"]')).filter(isVisible);
        if (listItems.length === 0) {
          return 'No items found in list';
        }
        
        return listItems.map(item => item.textContent?.trim()).join('\\n');
      })();
    `;
  }

  /**
   * Script to extract links
   */
  private getLinksScript(): string {
    return `
      (() => {
        function isVisible(el) {
          if (!el) return false;
          const rect = el.getBoundingClientRect();
          const style = window.getComputedStyle(el);
          return rect.height > 0 && 
                 style.visibility !== 'hidden' && 
                 style.display !== 'none' &&
                 parseFloat(style.opacity) > 0;
        }
        
        // Find main content area
        let mainContent = document.querySelector('main') || 
                          document.querySelector('[role="main"]') || 
                          document.body;
        
        // Get all visible links
        const links = Array.from(mainContent.querySelectorAll('a[href]')).filter(isVisible);
        if (links.length === 0) {
          return 'No links found';
        }
        
        return links.map(link => {
          const text = link.textContent?.trim();
          const href = link.getAttribute('href');
          return text ? \`\${text}: \${href}\` : href;
        }).join('\\n');
      })();
    `;
  }

  /**
   * Script to extract image descriptions
   */
  private getImageDescriptionsScript(): string {
    return `
      (() => {
        function isVisible(el) {
          if (!el) return false;
          const rect = el.getBoundingClientRect();
          const style = window.getComputedStyle(el);
          return rect.height > 0 && 
                 style.visibility !== 'hidden' && 
                 style.display !== 'none' &&
                 parseFloat(style.opacity) > 0;
        }
        
        // Find main content area
        let mainContent = document.querySelector('main') || 
                          document.querySelector('[role="main"]') || 
                          document.body;
        
        // Get all visible images
        const images = Array.from(mainContent.querySelectorAll('img')).filter(isVisible);
        if (images.length === 0) {
          return 'No images found';
        }
        
        return images.map(img => {
          const alt = img.getAttribute('alt') || 'Image with no description';
          const title = img.getAttribute('title');
          return title ? \`\${alt}: \${title}\` : alt;
        }).join('\\n');
      })();
    `;
  }

  /**
   * Script to extract main content only (less aggressive than full page)
   */
  private getMainContentScript(): string {
    return `
      (() => {
        function isVisible(el) {
          if (!el) return false;
          const rect = el.getBoundingClientRect();
          const style = window.getComputedStyle(el);
          return rect.height > 0 && 
                 style.visibility !== 'hidden' && 
                 style.display !== 'none' &&
                 parseFloat(style.opacity) > 0;
        }
        
        function shouldSkip(el) {
          const skipSelectors = [
            'script', 'style', 'link', 'meta',
            'nav', '[role="navigation"]',
            '.sidebar', '.ads', '.advertisement',
            '.comments', '.footer', 'footer',
            '[class*="nav"]', '[id*="nav"]',
            '.modal', '.dialog',
            '.hidden', '[hidden]'
          ];
          
          for (const selector of skipSelectors) {
            if (el.matches(selector)) return true;
          }
          return false;
        }
        
        // Find main content area
        let mainContent = document.querySelector('main') || 
                          document.querySelector('[role="main"]') ||
                          document.querySelector('article') ||
                          document.querySelector('[role="article"]');
        
        if (!mainContent) {
          // Fallback: Try to find the largest text block
          const candidates = Array.from(document.querySelectorAll('div, section')).filter(el => {
            const text = el.textContent?.trim() || '';
            return text.length > 200 && isVisible(el) && !shouldSkip(el);
          });
          
          if (candidates.length > 0) {
            mainContent = candidates.sort((a, b) => 
              b.textContent?.length || 0 - (a.textContent?.length || 0)
            )[0];
          } else {
            mainContent = document.body;
          }
        }
        
        const textParts = [];
        const walker = document.createTreeWalker(
          mainContent,
          NodeFilter.SHOW_ELEMENT,
          {
            acceptNode: function(node) {
              if (!isVisible(node) || shouldSkip(node)) {
                return NodeFilter.FILTER_REJECT;
              }
              
              const tagName = node.tagName.toLowerCase();
              if (/^h[1-6]$/.test(tagName) || tagName === 'p' || tagName === 'li') {
                return NodeFilter.FILTER_ACCEPT;
              }
              
              return NodeFilter.FILTER_SKIP;
            }
          }
        );
        
        let currentNode;
        while (currentNode = walker.nextNode()) {
          const text = currentNode.textContent?.trim();
          if (text && text.length > 2) {
            textParts.push(text);
          }
        }
        
        return textParts.join('\\n\\n') || 'No content found';
      })();
    `;
  }

  /**
   * Script to extract the entire page readable text
   */
  private getFullPageScript(): string {
    return `
      (() => {
        function getReadableText() {
          const contentElements = [];
          
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
          
          let mainContent = document.querySelector('main');
          if (!mainContent) {
            mainContent = document.querySelector('[role="main"]');
          }
          
          const targetElement = mainContent || document.body;
          
          function isVisible(el) {
            if (!el) return false;
            const rect = el.getBoundingClientRect();
            const style = window.getComputedStyle(el);
            return rect.height > 0 && 
                   style.visibility !== 'hidden' && 
                   style.display !== 'none' &&
                   parseFloat(style.opacity) > 0;
          }
          
          function shouldSkip(el) {
            for (const selector of selectorsToExclude) {
              if (el.matches(selector)) return true;
            }
            return false;
          }
          
          const textParts = [];
          
          const title = document.title || document.querySelector('h1')?.textContent;
          if (title) {
            textParts.push(title.trim());
          }
          
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
                
                if (/^h[1-6]$/.test(tagName)) {
                  return NodeFilter.FILTER_ACCEPT;
                }
                
                if (tagName === 'p' || tagName === 'li' || tagName === 'dd' || tagName === 'blockquote') {
                  return NodeFilter.FILTER_ACCEPT;
                }
                
                if (tagName === 'label' || tagName === 'legend') {
                  return NodeFilter.FILTER_ACCEPT;
                }
                
                if ((tagName === 'td' || tagName === 'th') && node.textContent && node.textContent.trim()) {
                  return NodeFilter.FILTER_ACCEPT;
                }
                
                if (tagName === 'figcaption') {
                  return NodeFilter.FILTER_ACCEPT;
                }
                
                return NodeFilter.FILTER_SKIP;
              }
            }
          );
          
          let currentNode;
          while (currentNode = walker.nextNode()) {
            const text = currentNode.textContent?.trim();
            if (text && text.length > 0) {
              if (text.length > 2 || /^[A-Z]/.test(text)) {
                textParts.push(text);
              }
            }
          }
          
          let fullText = textParts.join('\\n\\n');
          
          fullText = fullText
            .replace(/\\n\\n+/g, '\\n\\n')
            .replace(/\\s+/g, ' ')
            .replace(/\\n /g, '\\n')
            .trim();
          
          return fullText;
        }
        
        return getReadableText();
      })();
    `;
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
