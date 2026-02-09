import type { Protocol } from 'devtools-protocol';
import type { PageState, AXTree, AXNode, SimplifiedDOM, DOMElement } from '@shared/types';
import { EXTRACTION_CONFIG } from '@shared/constants';

/**
 * PageStateExtractor extracts the current state of a web page using CDP.
 * Primary method: Accessibility tree (semantic, compact, user-meaningful)
 * Fallback method: Simplified DOM snapshot (interactive elements only)
 */
export class PageStateExtractor {
  /**
   * Extract page state from the current page using CDP session
   */
  async extractPageState(
    cdpSession: Electron.Debugger
  ): Promise<PageState> {
    // Wait for page to stabilize
    await this.waitForStabilization(cdpSession);

    // Get basic page info
    const pageInfo = await this.getPageInfo(cdpSession);

    // Try accessibility tree first (primary method)
    const axTree = await this.extractAccessibilityTree(cdpSession);
    
    if (this.isTreeMeaningful(axTree)) {
      return {
        url: pageInfo.url,
        title: pageInfo.title,
        extractionMethod: 'accessibility-tree',
        timestamp: Date.now(),
        axTree,
      };
    }

    // Fallback to simplified DOM if AX tree is insufficient
    console.warn('Accessibility tree insufficient, falling back to simplified DOM');
    const simplifiedDOM = await this.extractSimplifiedDOM(cdpSession);

    return {
      url: pageInfo.url,
      title: pageInfo.title,
      extractionMethod: 'simplified-dom',
      timestamp: Date.now(),
      simplifiedDOM,
    };
  }

  /**
   * Wait for page to stabilize (no DOM mutations for specified duration)
   */
  private async waitForStabilization(
    cdpSession: Electron.Debugger,
    timeout: number = EXTRACTION_CONFIG.STABILIZATION_TIMEOUT
  ): Promise<void> {
    const script = `
      new Promise((resolve) => {
        let mutationTimer;
        const observer = new MutationObserver(() => {
          clearTimeout(mutationTimer);
          mutationTimer = setTimeout(() => {
            observer.disconnect();
            resolve(true);
          }, ${timeout});
        });
        
        observer.observe(document.body, {
          childList: true,
          subtree: true,
          attributes: true,
        });
        
        // Auto-resolve after timeout even if still mutating
        setTimeout(() => {
          observer.disconnect();
          resolve(true);
        }, ${timeout * 2});
      });
    `;

    try {
      await cdpSession.sendCommand('Runtime.evaluate', {
        expression: script,
        awaitPromise: true,
      });
    } catch (error) {
      console.error('Stabilization wait failed:', error);
      // Continue anyway - page might still be usable
    }
  }

  /**
   * Get basic page information (URL, title)
   */
  private async getPageInfo(
    cdpSession: Electron.Debugger
  ): Promise<{ url: string; title: string }> {
    try {
      const result = await cdpSession.sendCommand('Runtime.evaluate', {
        expression: 'JSON.stringify({ url: window.location.href, title: document.title })',
        returnByValue: true,
      });

      if (result.result?.value) {
        return JSON.parse(result.result.value);
      }
    } catch (error) {
      console.error('Failed to get page info:', error);
    }

    return { url: 'about:blank', title: 'Unknown Page' };
  }

  /**
   * Extract accessibility tree from CDP
   */
  private async extractAccessibilityTree(
    cdpSession: Electron.Debugger
  ): Promise<AXTree | undefined> {
    try {
      const response = await cdpSession.sendCommand('Accessibility.getFullAXTree', {});
      
      if (!response || !response.nodes || response.nodes.length === 0) {
        console.warn('Empty accessibility tree returned');
        return undefined;
      }

      // Convert CDP AX nodes to our format
      const nodes: AXNode[] = response.nodes.map((node: Protocol.Accessibility.AXNode) => ({
        nodeId: node.nodeId || '',
        role: node.role?.value || 'unknown',
        name: node.name?.value || '',
        description: node.description?.value,
        value: node.value?.value,
        properties: this.extractAXProperties(node),
        childIds: node.childIds || [],
      }));

      return {
        nodes,
        rootNodeId: nodes[0]?.nodeId || '',
      };
    } catch (error) {
      console.error('Failed to extract accessibility tree:', error);
      return undefined;
    }
  }

  /**
   * Extract relevant properties from AX node
   */
  private extractAXProperties(node: Protocol.Accessibility.AXNode): Record<string, any> {
    const props: Record<string, any> = {};

    // Extract important boolean properties
    if (node.properties) {
      for (const prop of node.properties) {
        const name = prop.name;
        const value = prop.value.value;
        
        // Only include meaningful properties
        if (
          name === 'focused' ||
          name === 'disabled' ||
          name === 'required' ||
          name === 'readonly' ||
          name === 'invalid' ||
          name === 'checked' ||
          name === 'expanded' ||
          name === 'pressed'
        ) {
          props[name] = value;
        }
      }
    }

    return props;
  }

  /**
   * Check if accessibility tree has sufficient information
   */
  private isTreeMeaningful(tree: AXTree | undefined): boolean {
    if (!tree || !tree.nodes || tree.nodes.length === 0) {
      return false;
    }

    // Count interactive elements (buttons, links, inputs, etc.)
    const interactiveRoles = new Set([
      'button',
      'link',
      'textbox',
      'searchbox',
      'combobox',
      'listbox',
      'checkbox',
      'radio',
      'slider',
      'spinbutton',
      'switch',
      'tab',
      'menuitem',
    ]);

    const interactiveCount = tree.nodes.filter((node) =>
      interactiveRoles.has(node.role)
    ).length;

    return interactiveCount >= EXTRACTION_CONFIG.MIN_INTERACTIVE_NODES_FOR_MEANINGFUL_TREE;
  }

  /**
   * Extract simplified DOM (fallback method)
   * Query only interactive elements
   */
  private async extractSimplifiedDOM(
    cdpSession: Electron.Debugger
  ): Promise<SimplifiedDOM> {
    const script = `
      (() => {
        const selector = 'a, button, input, select, textarea, [role="button"], [role="link"], [role="textbox"], h1, h2, h3, h4, h5, h6, [contenteditable="true"]';
        const elements = Array.from(document.querySelectorAll(selector));
        
        return elements.map((el, index) => {
          const rect = el.getBoundingClientRect();
          const isVisible = rect.width > 0 && rect.height > 0 && 
                           window.getComputedStyle(el).visibility !== 'hidden' &&
                           window.getComputedStyle(el).display !== 'none';
          
          if (!isVisible) return null;
          
          return {
            id: el.id || 'element-' + index,
            tagName: el.tagName.toLowerCase(),
            role: el.getAttribute('role') || el.tagName.toLowerCase(),
            name: el.textContent?.trim().substring(0, 200) || '',
            value: el.value || '',
            selector: el.id ? '#' + el.id : el.tagName.toLowerCase() + ':nth-of-type(' + (Array.from(el.parentElement?.children || []).indexOf(el) + 1) + ')',
            attributes: {
              type: el.getAttribute('type'),
              href: el.getAttribute('href'),
              placeholder: el.getAttribute('placeholder'),
              'aria-label': el.getAttribute('aria-label'),
              disabled: el.hasAttribute('disabled'),
              required: el.hasAttribute('required'),
            },
          };
        }).filter(el => el !== null);
      })();
    `;

    try {
      const result = await cdpSession.sendCommand('Runtime.evaluate', {
        expression: script,
        returnByValue: true,
      });

      const elements: DOMElement[] = result.result?.value || [];
      
      return {
        elements,
        extractedAt: Date.now(),
      };
    } catch (error) {
      console.error('Failed to extract simplified DOM:', error);
      return {
        elements: [],
        extractedAt: Date.now(),
      };
    }
  }
}
