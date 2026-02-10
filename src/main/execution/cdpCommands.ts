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
  const elementInfo = await queryElement(cdpSession, selector);
  if (!elementInfo.exists) {
    throw new Error(`Element not found: ${selector}`);
  }
  if (!elementInfo.visible) {
    throw new Error(`Element not visible: ${selector}`);
  }
  if (!elementInfo.interactable) {
    throw new Error(`Element not interactable: ${selector}`);
  }

  // Perform the click
  const result = await cdpSession.sendCommand('Runtime.evaluate', {
    expression: `
      (function() {
        const element = document.querySelector(${JSON.stringify(selector)});
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
    throw new Error(`Failed to click element: ${selector}`);
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
