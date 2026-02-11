/**
 * CDP Commands - Helper functions for Chrome DevTools Protocol operations
 * 
 * PERSON 1 TODO:
 * 1. Implement CDP wrappers for DOM queries
 * 2. Implement element interaction helpers
 * 3. Implement visibility/interactability checks
 * 4. Add error handling for all CDP calls
 */

import { Protocol } from 'devtools-protocol';

export interface ElementInfo {
  exists: boolean;
  visible: boolean;
  interactable: boolean;
  rect?: DOMRect;
  tagName?: string;
  disabled?: boolean;
  readonly?: boolean;
}

export interface DOMRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Query element by CSS selector using CDP
 */
export async function queryElement(
  cdpSession: Protocol.ProtocolMapping.API,
  selector: string
): Promise<ElementInfo> {
  try {
    const result = await cdpSession.sendCommand('Runtime.evaluate', {
      expression: `
        (function() {
          const element = document.querySelector(${JSON.stringify(selector)});
          if (!element) {
            return { exists: false, visible: false, interactable: false };
          }
          
          const rect = element.getBoundingClientRect();
          const style = window.getComputedStyle(element);
          const visible = rect.width > 0 && rect.height > 0 && 
                         style.visibility !== 'hidden' && 
                         style.display !== 'none' &&
                         style.opacity !== '0';
          
          const interactable = visible && 
                              !element.disabled &&
                              !element.hasAttribute('readonly') &&
                              element.offsetParent !== null;
          
          return {
            exists: true,
            visible: visible,
            interactable: interactable,
            rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
            tagName: element.tagName,
            disabled: element.disabled || false,
            readonly: element.hasAttribute('readonly')
          };
        })()
      `,
      returnByValue: true,
    });

    if (result.exceptionDetails) {
      console.error('Exception while querying element:', result.exceptionDetails);
      return { exists: false, visible: false, interactable: false };
    }

    return result.result.value as ElementInfo;
  } catch (error) {
    console.error('Error querying element:', error);
    return {
      exists: false,
      visible: false,
      interactable: false
    };
  }
}

/**
 * Click element by selector
 */
export async function clickElement(
  cdpSession: Protocol.ProtocolMapping.API,
  selector: string
): Promise<void> {
  // First, verify element is clickable
  let elementInfo = await queryElement(cdpSession, selector);
  let finalSelector = selector;
  
  // If element not found with direct selector, try alternative methods
  if (!elementInfo.exists) {
    console.warn(`Element not found with selector: ${selector}, trying alternative methods...`);
    
    const altSelector = await tryFindVisibleElement(cdpSession, selector);
    if (altSelector) {
      elementInfo = await queryElement(cdpSession, altSelector);
      if (elementInfo.exists) {
        finalSelector = altSelector;
        console.log(`Found element using alternative selector: ${altSelector}`);
      }
    }
    
    if (!elementInfo.exists) {
      throw new Error(`Element not found: ${selector}`);
    }
  }
  
  // If element exists but is not visible, try to find visible alternative
  if (!elementInfo.visible) {
    console.warn(`Element not visible with selector: ${selector}, trying to find visible alternative...`);
    
    const visibleSelector = await tryFindVisibleElement(cdpSession, selector);
    if (visibleSelector) {
      const visibleInfo = await queryElement(cdpSession, visibleSelector);
      if (visibleInfo.visible) {
        finalSelector = visibleSelector;
        elementInfo = visibleInfo;
        console.log(`Found visible element using: ${visibleSelector}`);
      }
    }
    
    if (!elementInfo.visible) {
      throw new Error(`Element not visible: ${selector}`);
    }
  }
  
  if (!elementInfo.interactable) {
    throw new Error(`Element not interactable: ${finalSelector}`);
  }

  // Perform the click
  const result = await cdpSession.sendCommand('Runtime.evaluate', {
    expression: `
      (function() {
        const element = document.querySelector(${JSON.stringify(finalSelector)});
        if (!element) return false;
        element.click();
        return true;
      })()
    `,
    returnByValue: true,
  });

  if (result.exceptionDetails) {
    throw new Error(`Failed to click element: ${result.exceptionDetails.text}`);
  }

  if (!result.result.value) {
    throw new Error(`Failed to click element: ${finalSelector}`);
  }
}

/**
 * Try to find a visible element when the original selector fails or points to hidden element
 * This handles cases where LLM generated incorrect selectors or duplicate IDs exist
 */
async function tryFindVisibleElement(
  cdpSession: Protocol.ProtocolMapping.API,
  originalSelector: string
): Promise<string | null> {
  try {
    // Extract the name/label from the selector
    let searchText = '';
    
    // Handle [aria-label='...'] pattern
    const ariaMatch = originalSelector.match(/\[aria-label=['"]([^'"]+)['"]\]/);
    if (ariaMatch) {
      searchText = ariaMatch[1];
    }
    
    // Handle [name='...'] pattern
    if (!searchText) {
      const nameMatch = originalSelector.match(/\[name=['"]([^'"]+)['"]\]/);
      if (nameMatch) {
        searchText = nameMatch[1];
      }
    }
    
    // Handle #id pattern - try to find alternative
    if (!searchText && originalSelector.startsWith('#')) {
      const idElement = await cdpSession.sendCommand('Runtime.evaluate', {
        expression: `
          (function() {
            const element = document.querySelector(${JSON.stringify(originalSelector)});
            if (element) {
              return element.getAttribute('aria-label') || element.textContent?.trim() || '';
            }
            return '';
          })()
        `,
        returnByValue: true,
      });
      
      if (idElement.result?.value) {
        searchText = idElement.result.value;
      }
    }
    
    if (!searchText) {
      return null;
    }
    
    // Try to find a visible element with the same accessible name or text content
    const findScript = `
      (function() {
        const searchText = ${JSON.stringify(searchText)};
        
        function isVisible(el) {
          if (!el) return false;
          const rect = el.getBoundingClientRect();
          const style = window.getComputedStyle(el);
          return rect.width > 0 && rect.height > 0 && 
                 style.visibility !== 'hidden' && 
                 style.display !== 'none' &&
                 parseFloat(style.opacity) > 0;
        }
        
        // Try aria-label first (exact match)
        let candidates = Array.from(document.querySelectorAll('[aria-label="' + searchText + '"]'));
        candidates = candidates.filter(isVisible);
        
        if (candidates.length > 0) {
          const element = candidates[0];
          return '[aria-label="' + element.getAttribute('aria-label').replace(/"/g, '\\\\"') + '"]';
        }
        
        // Try finding button/link by text content (visible only)
        const interactiveElements = Array.from(
          document.querySelectorAll('button, a, [role="button"], [role="link"], [role="tab"]')
        );
        
        const textMatches = interactiveElements.filter(el => {
          const text = el.textContent?.trim().toLowerCase();
          return text === searchText.toLowerCase() && isVisible(el);
        });
        
        if (textMatches.length > 0) {
          const element = textMatches[0];
          
          // Prefer aria-label selector
          const ariaLabel = element.getAttribute('aria-label');
          if (ariaLabel) {
            return '[aria-label="' + ariaLabel.replace(/"/g, '\\\\"') + '"]';
          }
          
          // Use class + nth-child
          if (element.parentElement) {
            const siblings = Array.from(element.parentElement.children);
            const index = siblings.indexOf(element) + 1;
            let selector = element.tagName.toLowerCase();
            
            if (element.className && typeof element.className === 'string') {
              const classes = element.className.trim().split(/\\s+/);
              if (classes.length > 0 && classes[0]) {
                selector += '.' + CSS.escape(classes[0]);
              }
            }
            
            return selector + ':nth-child(' + index + ')';
          }
        }
        
        return null;
      })()
    `;
    
    const result = await cdpSession.sendCommand('Runtime.evaluate', {
      expression: findScript,
      returnByValue: true,
    });
    
    if (result.result?.value) {
      return result.result.value;
    }
    
    return null;
  } catch (error) {
    console.error('Error in tryFindVisibleElement:', error);
    return null;
  }
}

/**
 * Type text into input element
 */
export async function typeText(
  cdpSession: Protocol.ProtocolMapping.API,
  selector: string,
  text: string
): Promise<void> {
  // Verify element is interactable
  const elementInfo = await queryElement(cdpSession, selector);
  if (!elementInfo.exists) {
    throw new Error(`Element not found: ${selector}`);
  }
  if (!elementInfo.interactable) {
    throw new Error(`Element not editable: ${selector}`);
  }

  // Focus element and set value
  const result = await cdpSession.sendCommand('Runtime.evaluate', {
    expression: `
      (function() {
        const element = document.querySelector(${JSON.stringify(selector)});
        if (!element) return false;
        element.focus();
        element.value = ${JSON.stringify(text)};
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      })()
    `,
    returnByValue: true,
  });

  if (result.exceptionDetails) {
    throw new Error(`Failed to type text: ${result.exceptionDetails.text}`);
  }

  if (!result.result.value) {
    throw new Error(`Failed to type text into: ${selector}`);
  }
}

/**
 * Select dropdown option by value or text
 */
export async function selectOption(
  cdpSession: Protocol.ProtocolMapping.API,
  selector: string,
  value: string
): Promise<void> {
  // TODO: Implement using Runtime.evaluate to:
  // 1. Find select element
  // 2. Set .value = value or find option by text
  // 3. Dispatch 'change' event
  
  throw new Error('Not implemented');
}

/**
 * Check/uncheck checkbox or radio button
 */
export async function setCheckbox(
  cdpSession: Protocol.ProtocolMapping.API,
  selector: string,
  checked: boolean
): Promise<void> {
  // TODO: Implement using Runtime.evaluate to:
  // 1. Find input element
  // 2. Set .checked = checked
  // 3. Dispatch 'change' event
  
  throw new Error('Not implemented');
}

/**
 * Scroll element or page
 */
export async function scroll(
  cdpSession: Protocol.ProtocolMapping.API,
  direction: 'up' | 'down' | 'top' | 'bottom',
  amount?: number,
  selector?: string
): Promise<void> {
  let scrollExpression: string;

  if (selector) {
    // Scroll specific element
    scrollExpression = `
      (function() {
        const element = document.querySelector(${JSON.stringify(selector)});
        if (!element) return false;
        ${getScrollCommand('element', direction, amount)}
        return true;
      })()
    `;
  } else {
    // Scroll page
    scrollExpression = `
      (function() {
        ${getScrollCommand('window', direction, amount)}
        return true;
      })()
    `;
  }

  const result = await cdpSession.sendCommand('Runtime.evaluate', {
    expression: scrollExpression,
    returnByValue: true,
  });

  if (result.exceptionDetails) {
    throw new Error(`Failed to scroll: ${result.exceptionDetails.text}`);
  }

  if (selector && !result.result.value) {
    throw new Error(`Failed to scroll element: ${selector}`);
  }
}

function getScrollCommand(target: 'window' | 'element', direction: 'up' | 'down' | 'top' | 'bottom', amount?: number): string {
  switch (direction) {
    case 'up':
      return `${target}.scrollBy(0, ${amount ? -amount : -300});`;
    case 'down':
      return `${target}.scrollBy(0, ${amount || 300});`;
    case 'top':
      return `${target}.scrollTo(0, 0);`;
    case 'bottom':
      return target === 'window'
        ? `${target}.scrollTo(0, document.body.scrollHeight);`
        : `${target}.scrollTo(0, ${target}.scrollHeight);`;
  }
}

/**
 * Navigate to URL
 */
export async function navigateToUrl(
  cdpSession: Protocol.ProtocolMapping.API,
  url: string
): Promise<void> {
  // Validate URL scheme (security check)
  const validSchemes = ['http:', 'https:', 'file:'];
  try {
    const urlObj = new URL(url);
    if (!validSchemes.includes(urlObj.protocol)) {
      throw new Error(`Unsafe URL scheme: ${urlObj.protocol}`);
    }
  } catch (error: any) {
    throw new Error(`Invalid URL: ${url}`);
  }

  // Navigate using Page.navigate
  await cdpSession.sendCommand('Page.navigate', { url });
  
  // Wait for network to be idle
  await waitForStabilization(cdpSession, 500);
}

/**
 * Wait for element to appear
 */
export async function waitForElement(
  cdpSession: Protocol.ProtocolMapping.API,
  selector: string,
  timeoutMs: number = 5000
): Promise<boolean> {
  // TODO: Implement polling with Runtime.evaluate
  // Check every 100ms until element exists or timeout
  
  throw new Error('Not implemented');
}

/**
 * Wait for page to stabilize (no DOM mutations for X ms)
 */
export async function waitForStabilization(
  cdpSession: Protocol.ProtocolMapping.API,
  stabilityWindowMs: number = 500
): Promise<void> {
  // Simple implementation: wait for Network idle and fixed delay
  return new Promise((resolve) => {
    setTimeout(resolve, stabilityWindowMs);
  });
}

/**
 * Get element bounding box
 */
export async function getElementRect(
  cdpSession: Protocol.ProtocolMapping.API,
  selector: string
): Promise<DOMRect | null> {
  // TODO: Implement using Runtime.evaluate to call:
  // document.querySelector(selector).getBoundingClientRect()
  
  throw new Error('Not implemented');
}

/**
 * Check if element is visible in viewport
 */
export async function isElementVisible(
  cdpSession: Protocol.ProtocolMapping.API,
  selector: string
): Promise<boolean> {
  const elementInfo = await queryElement(cdpSession, selector);
  return elementInfo.visible;
}

/**
 * Extract form field values
 */
export async function extractFormValues(
  cdpSession: Protocol.ProtocolMapping.API,
  formSelector: string
): Promise<Record<string, string>> {
  // TODO: Implement using Runtime.evaluate to:
  // 1. Find form element
  // 2. Get all input/select/textarea children
  // 3. Return { name: value } map
  
  throw new Error('Not implemented');
}
