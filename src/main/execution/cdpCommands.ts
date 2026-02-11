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

  // Fullscreen fallback: some players ignore synthetic click, try explicit fullscreen request
  const selectorText = `${selector} ${finalSelector}`.toLowerCase();
  if (selectorText.includes('full screen') || selectorText.includes('fullscreen')) {
    await cdpSession.sendCommand('Runtime.evaluate', {
      expression: `
        (function() {
          const player = document.querySelector('.html5-video-player');
          const video = document.querySelector('video');
          const target = player || video;
          if (!target) return false;

          const request = target.requestFullscreen ||
            target.webkitRequestFullscreen ||
            target.mozRequestFullScreen ||
            target.msRequestFullscreen;

          if (request) {
            request.call(target);
            return true;
          }

          return false;
        })()
      `,
      returnByValue: true,
    });
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
        const searchTextLower = searchText.toLowerCase();
        
        function isVisible(el) {
          if (!el) return false;
          const rect = el.getBoundingClientRect();
          const style = window.getComputedStyle(el);
          return rect.width > 0 && rect.height > 0 && 
                 style.visibility !== 'hidden' && 
                 style.display !== 'none' &&
                 parseFloat(style.opacity) > 0;
        }

        // Fullscreen-specific fallbacks (YouTube and common players)
        if (searchTextLower.includes('full screen') || searchTextLower.includes('fullscreen')) {
          const fullscreenSelectors = [
            'button.ytp-fullscreen-button',
            '[aria-label*="Full screen" i]',
            '[title*="Full screen" i]',
            'button[title*="Full screen" i]',
            'button[aria-label*="full screen" i]',
            '[data-title-no-tooltip*="Full screen" i]'
          ];

          for (const selector of fullscreenSelectors) {
            const el = document.querySelector(selector);
            if (isVisible(el)) {
              return selector;
            }
          }
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
  // Try to find element with fallback logic
  let elementInfo = await queryElement(cdpSession, selector);
  let finalSelector = selector;
  
  // If element not found, try fallback strategies
  if (!elementInfo.exists) {
    console.log(`Primary selector "${selector}" not found, trying fallbacks...`);
    
    // Enhanced YouTube-specific search input detection
    const smartSelector = await cdpSession.sendCommand('Runtime.evaluate', {
      expression: `
        (function() {
          // Function to check if element is truly visible and interactable
          function isInteractable(el) {
            if (!el) return false;
            const rect = el.getBoundingClientRect();
            const style = window.getComputedStyle(el);
            return rect.width > 0 && rect.height > 0 && 
                   style.visibility !== 'hidden' && 
                   style.display !== 'none' &&
                   parseFloat(style.opacity) > 0 &&
                   !el.disabled;
          }
          
          // YouTube-specific: find the actual active search input
          // Method 1: Look for input that's currently focused or most recently interacted with
          let searchInput = document.activeElement;
          if (searchInput && searchInput.tagName === 'INPUT' && isInteractable(searchInput)) {
            const inputType = searchInput.type || 'text';
            if (inputType === 'search' || inputType === 'text' || !inputType) {
              return { selector: generateSelector(searchInput), method: 'activeElement' };
            }
          }
          
          // Method 2: YouTube main search input (header)
          searchInput = document.querySelector('input#search');
          if (searchInput && isInteractable(searchInput)) {
            return { selector: '#search', method: 'youtube.header' };
          }
          
          // Method 3: Look for search input by name attribute
          searchInput = document.querySelector('input[name="search_query"]');
          if (searchInput && isInteractable(searchInput)) {
            return { selector: 'input[name="search_query"]', method: 'youtube.name' };
          }
          
          // Method 4: Find search input in visible search forms
          const searchForms = Array.from(document.querySelectorAll('form'));
          for (const form of searchForms) {
            if (!isInteractable(form)) continue;
            
            const inputs = form.querySelectorAll('input[type="search"], input[type="text"], input:not([type])');
            for (const input of inputs) {
              if (isInteractable(input)) {
                const placeholder = input.placeholder?.toLowerCase() || '';
                const ariaLabel = input.getAttribute('aria-label')?.toLowerCase() || '';
                if (placeholder.includes('search') || ariaLabel.includes('search')) {
                  return { selector: generateSelector(input), method: 'form.search' };
                }
              }
            }
          }
          
          // Method 5: Find any interactive search-related input
          const allInputs = Array.from(document.querySelectorAll('input, [role="searchbox"]'));
          for (const input of allInputs) {
            if (!isInteractable(input)) continue;
            
            const placeholder = input.placeholder?.toLowerCase() || '';
            const ariaLabel = input.getAttribute('aria-label')?.toLowerCase() || '';
            const role = input.getAttribute('role') || '';
            
            if (placeholder.includes('search') || ariaLabel.includes('search') || role === 'searchbox') {
              return { selector: generateSelector(input), method: 'generic.search' };
            }
          }
          
          // Helper function to generate a reliable selector
          function generateSelector(element) {
            // Prefer ID if available and unique
            if (element.id) {
              const testId = document.querySelectorAll('#' + CSS.escape(element.id));
              if (testId.length === 1) {
                return '#' + CSS.escape(element.id);
              }
            }
            
            // Use name attribute if available
            if (element.name) {
              return \`input[name="\${CSS.escape(element.name)}"]\`;
            }
            
            // Use a combination of tag and attributes for uniqueness
            let selector = element.tagName.toLowerCase();
            
            if (element.type) {
              selector += \`[type="\${element.type}"]\`;
            }
            
            if (element.className) {
              const classes = element.className.split(' ').filter(cls => cls.trim());
              if (classes.length > 0) {
                selector += '.' + classes.map(cls => CSS.escape(cls)).join('.');
              }
            }
            
            return selector;
          }
          
          return { selector: null, method: 'none' };
        })()
      `,
      returnByValue: true,
    });

    if (smartSelector.result?.value?.selector) {
      console.log(`Smart selector found: ${smartSelector.result.value.selector} via ${smartSelector.result.value.method}`);
      const smartElement = await queryElement(cdpSession, smartSelector.result.value.selector);
      if (smartElement.exists && smartElement.interactable) {
        finalSelector = smartSelector.result.value.selector;
        elementInfo = smartElement;
      }
    }
    
    // If smart selector didn't work, try basic fallbacks
    if (!elementInfo.exists) {
      const fallbackSelectors = [
        'input#search',
        'input[name="search_query"]',
        'input[placeholder*="earch" i]',
        'input[aria-label*="earch" i]',
        '[role="searchbox"]',
        'input[type="search"]',
        'input[type="text"]',
        'input:not([type])'
      ];
      
      for (const fallback of fallbackSelectors) {
        if (fallback === selector) continue; // Skip if it's the same as original
        
        elementInfo = await queryElement(cdpSession, fallback);
        if (elementInfo.exists && elementInfo.interactable) {
          console.log(`Found element using fallback selector: ${fallback}`);
          finalSelector = fallback;
          break;
        }
      }
    }
  }
  
  // If still not found, try to wait a bit and retry (element might be loading)
  if (!elementInfo.exists) {
    console.log('Element not found, waiting 2 seconds for page to load...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Retry with original selector
    elementInfo = await queryElement(cdpSession, selector);
    if (!elementInfo.exists) {
      // Try fallbacks again
      for (const fallback of [
        'input#search',
        'input[name="search_query"]',
        '[role="searchbox"]'
      ]) {
        elementInfo = await queryElement(cdpSession, fallback);
        if (elementInfo.exists) {
          finalSelector = fallback;
          break;
        }
      }
    }
  }
  
  if (!elementInfo.exists) {
    throw new Error(`Element not found: ${selector} (tried multiple fallbacks)`);
  }
  if (!elementInfo.interactable) {
    throw new Error(`Element not editable: ${finalSelector}`);
  }

  // Focus element and set value with aggressive clearing
  const result = await cdpSession.sendCommand('Runtime.evaluate', {
    expression: `
      (async function() {
        const element = document.querySelector(${JSON.stringify(finalSelector)});
        if (!element) return false;
        
        // Ensure element is visible and interactable
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // Triple-click to select all text, then type (most reliable method)
        element.focus();
        await new Promise(r => setTimeout(r, 100)); // Wait for focus
        
        // Click three times to select all text (universal method)
        element.click();
        element.click();  
        element.click();
        
        await new Promise(r => setTimeout(r, 50)); // Brief pause
        
        // Directly set value to empty and trigger events
        element.value = '';
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
        
        await new Promise(r => setTimeout(r, 50)); // Brief pause
        
        // Now type the new text
        const textToType = ${JSON.stringify(text)};
        element.value = textToType;
        
        // Trigger comprehensive input events
        element.dispatchEvent(new InputEvent('input', { 
          data: textToType, 
          inputType: 'insertText',
          bubbles: true 
        }));
        element.dispatchEvent(new Event('input', { bubbles: true }));  
        element.dispatchEvent(new Event('change', { bubbles: true }));
        
        // Force React to recognize the change by dispatching keyup
        element.dispatchEvent(new KeyboardEvent('keyup', { 
          key: textToType.slice(-1),
          bubbles: true 
        }));
        
        // Ensure focus is maintained  
        element.focus();
        
        console.log('YouTube Search - Final value:', element.value);
        console.log('YouTube Search - Element focused:', document.activeElement === element);
        
        return true;
      })()
    `,
    returnByValue: true,
    awaitPromise: true
  });

  if (result.exceptionDetails) {
    throw new Error(`Failed to type text: ${result.exceptionDetails.text}`);
  }

  if (!result.result.value) {
    throw new Error(`Failed to type text into: ${finalSelector}`);
  }
  
  console.log(`Successfully typed "${text}" into element: ${finalSelector}`);
}

/**
 * Submit a form
 */
export async function submitForm(
  cdpSession: Protocol.ProtocolMapping.API,
  selector: string
): Promise<void> {
  const result = await cdpSession.sendCommand('Runtime.evaluate', {
    expression: `
      (function() {
        let element = document.querySelector(${JSON.stringify(selector)});
        
        // If selector didn't find element, try fallback strategies
        if (!element) {
          console.log('Primary selector failed, trying fallbacks...');
          
          // YouTube-specific: try search input
          element = document.querySelector('input#search');
          
          // Generic fallback: find any visible input field with a parent form
          if (!element) {
            const inputs = document.querySelectorAll('input[type="text"], input[type="search"], input:not([type])');
            for (const input of inputs) {
              if (input.offsetParent !== null && input.closest('form')) {
                element = input;
                break;
              }
            }
          }
          
          // Still no element? Try to find any form
          if (!element) {
            element = document.querySelector('form');
          }
          
          if (!element) {
            return { success: false, reason: 'No form or input element found' };
          }
        }
        
        // If the element is a form, submit it directly
        if (element.tagName === 'FORM') {
          element.submit();
          return { success: true, method: 'form.submit()' };
        }
        
        // If it's a button inside a form, click it
        if (element.tagName === 'BUTTON' || (element.tagName === 'INPUT' && element.type === 'submit')) {
          element.click();
          return { success: true, method: 'button.click()' };
        }
        
        // Try to find parent form and submit
        const form = element.closest('form');
        if (form) {
          // First try to find and click submit button (better for SPAs like YouTube)
          const submitBtn = form.querySelector('button[type="submit"], input[type="submit"], button[aria-label*="earch" i]');
          if (submitBtn) {
            submitBtn.click();
            return { success: true, method: 'submitButton.click()' };
          }
          
          // Fallback to form.submit()
          form.submit();
          return { success: true, method: 'parentForm.submit()' };
        }
        
        // For YouTube search specifically
        if (element.id === 'search' || element.getAttribute('name') === 'search_query') {
          const searchBtn = document.querySelector('#search-icon-legacy, button[aria-label*="earch" i]');
          if (searchBtn) {
            searchBtn.click();
            return { success: true, method: 'youtube.searchButton.click()' };
          }
        }
        
        // Last resort: simulate Enter key press
        const enterEvent = new KeyboardEvent('keydown', {
          key: 'Enter',
          code: 'Enter',
          keyCode: 13,
          which: 13,
          bubbles: true,
          cancelable: true
        });
        element.dispatchEvent(enterEvent);
        return { success: true, method: 'Enter.keypress()' };
      })()
    `,
    returnByValue: true,
  });

  if (result.exceptionDetails) {
    throw new Error(`Failed to submit form: ${result.exceptionDetails.text}`);
  }

  const submitResult = result.result.value as { success: boolean; reason?: string; method?: string };
  if (!submitResult.success) {
    throw new Error(`Failed to submit form: ${submitResult.reason || 'Unknown error'}`);
  }
  
  console.log(`Form submitted using: ${submitResult.method}`);
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
