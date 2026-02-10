import type { AccessibilitySettings } from '@shared/types/accessibility';

/**
 * Generate CSS to apply accessibility settings to a webpage
 */
export function generateAccessibilityCSS(settings: AccessibilitySettings): string {
  const styles: string[] = [];

  // Font size adjustment - use zoom for better compatibility
  if (settings.fontSize !== 100) {
    const scale = settings.fontSize / 100;
    styles.push(`
      html {
        zoom: ${scale} !important;
      }
    `);
  }

  // Line spacing adjustment - target text elements more specifically
  if (settings.lineSpacing !== 1.0) {
    styles.push(`
      p, li, div, span, a, h1, h2, h3, h4, h5, h6, td, th, label, button {
        line-height: ${settings.lineSpacing} !important;
      }
    `);
  }

  // High contrast mode - more targeted styling to avoid breaking visual elements
  if (settings.highContrast) {
    styles.push(`
      /* Set page background and text colors */
      body {
        background-color: #000000 !important;
        color: #ffffff !important;
      }
      
      /* Target text-containing elements without affecting media */
      div:not([role="img"]):not([role="presentation"]),
      section, article, main, header, footer, nav,
      p, span, h1, h2, h3, h4, h5, h6, 
      li, td, th, label, legend,
      blockquote, pre, code {
        background-color: #000000 !important;
        color: #ffffff !important;
        border-color: #ffffff !important;
        text-shadow: none !important;
      }
      
      /* Remove background images but preserve element structure */
      *:not(img):not(video):not(svg):not(canvas):not([role="img"]) {
        background-image: none !important;
        box-shadow: none !important;
      }
      
      /* Links */
      a, a:visited, a:hover, a * {
        color: #00d4ff !important;
        text-decoration: underline !important;
      }
      
      /* Interactive elements */
      button, input, select, textarea, [role="button"], [role="tab"] {
        background-color: #1a1a1a !important;
        color: #ffffff !important;
        border: 2px solid #666666 !important;
      }
      
      button:hover, [role="button"]:hover {
        background-color: #2a2a2a !important;
        border-color: #999999 !important;
      }
      
      /* Preserve images and videos - only adjust contrast slightly */
      img, video, canvas, svg, [role="img"] {
        filter: contrast(1.1) brightness(1.05) !important;
        opacity: 1 !important;
        background-color: transparent !important;
      }
      
      /* Icons and graphics that might be SVG or font-based */
      [class*="icon"], [class*="Icon"], 
      svg, svg * {
        fill: #ffffff !important;
        stroke: #ffffff !important;
        color: #ffffff !important;
      }
    `);
  }

  // Color filters for color blindness
  if (settings.colorFilter !== 'none') {
    if (settings.colorFilter === 'grayscale') {
      styles.push(`
        html {
          filter: grayscale(100%) !important;
        }
      `);
    } else if (settings.colorFilter === 'protanopia') {
      // Red-blind - reduce red, enhance blue/green contrast
      styles.push(`
        html {
          filter: saturate(0.8) hue-rotate(10deg) !important;
        }
      `);
    } else if (settings.colorFilter === 'deuteranopia') {
      // Green-blind - adjust green tones
      styles.push(`
        html {
          filter: saturate(0.7) hue-rotate(-10deg) !important;
        }
      `);
    } else if (settings.colorFilter === 'tritanopia') {
      // Blue-blind - enhance yellow/blue contrast
      styles.push(`
        html {
          filter: saturate(0.9) contrast(1.1) !important;
        }
      `);
    }
  }

  // Simplify layout - hide only actual distractions without breaking page structure
  if (settings.simplifyLayout) {
    styles.push(`
      /* Hide common ad and distraction elements */
      [class*="advertisement"],
      [id*="advertisement"],
      [class*="sponsored"],
      [id*="sponsored"],
      iframe[src*="doubleclick"],
      iframe[src*="googlesyndication"],
      [class*="popup"]:not([role="dialog"]):not([aria-modal="true"]),
      [class*="modal"]:not([aria-modal="true"]),
      [class*="overlay"]:not([aria-modal="true"]):not([class*="video"]) {
        display: none !important;
      }
      
      /* Reduce animations and auto-play distractions */
      * {
        animation-duration: 0.01s !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01s !important;
      }
      
      /* Increase focus visibility for keyboard navigation */
      *:focus, *:focus-visible {
        outline: 4px solid #0066cc !important;
        outline-offset: 2px !important;
      }
      
      /* Reduce visual noise from decorative elements */
      body {
        background-image: none !important;
        background-attachment: scroll !important;
      }
    `);
  }

  return styles.join('\n');
}
