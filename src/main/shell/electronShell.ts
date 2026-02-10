import { BrowserWindow, BrowserView, app, session } from 'electron';
import { APP_CONFIG } from '@shared/constants';
import path from 'path';
import type Protocol from 'devtools-protocol';
import type { AccessibilitySettings } from '@shared/types/accessibility';
import { generateAccessibilityCSS } from '../services/accessibilityService';

// Vite dev server URL and name injected by @electron-forge/plugin-vite
declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string | undefined;

export class ElectronShell {
  private mainWindow: BrowserWindow | null = null;
  private webView: BrowserView | null = null;
  private cdpSession: Protocol.ProtocolMapping.API | null = null;
  private navigationCallbacks: Array<(url: string) => void> = [];
  private pageLoadCallbacks: Array<(url: string, title: string) => void> = [];
  private lastProcessedUrl: string = '';
  private pageLoadDebounceTimer: NodeJS.Timeout | null = null;
  private chatPanelVisible: boolean = true;
  private currentAccessibilitySettings: AccessibilitySettings | null = null;
  private accessibilityCssKey: string | null = null;

  constructor() {}

  /**
   * Create the main application window with split layout
   */
  public async createMainWindow(): Promise<BrowserWindow> {
    this.mainWindow = new BrowserWindow({
      width: APP_CONFIG.WINDOW_WIDTH,
      height: APP_CONFIG.WINDOW_HEIGHT,
      minWidth: APP_CONFIG.MIN_WINDOW_WIDTH,
      minHeight: APP_CONFIG.MIN_WINDOW_HEIGHT,
      title: APP_CONFIG.APP_NAME,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false, // Disable sandbox to allow Web Speech API network requests
        webSecurity: true,
      },
      show: false, // Don't show until ready
    });

    // Load the renderer UI (chat panel)
    if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
      await this.mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
    } else {
      await this.mainWindow.loadFile(
        path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)
      );
    }

    // Create the BrowserView for target websites
    await this.createWebView();

    // Show window immediately after creating webview and bring to front
    this.mainWindow.show();
    this.mainWindow.focus();

    // Clean up on close
    this.mainWindow.on('closed', () => {
      this.cleanup();
    });

    // Open DevTools in development
    if (process.env.NODE_ENV === 'development') {
      this.mainWindow.webContents.openDevTools({ mode: 'detach' });
    }

    return this.mainWindow;
  }

  /**
   * Create a BrowserView for rendering target websites
   */
  private async createWebView(): Promise<void> {
    if (!this.mainWindow) {
      throw new Error('Main window must be created before web view');
    }

    this.webView = new BrowserView({
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        // Enable web security
        webSecurity: true,
      },
    });

    this.mainWindow.addBrowserView(this.webView);

    // Position the BrowserView (website area) to the left of the chat panel
    const [width, height] = this.mainWindow.getSize();
    const chatPanelWidth = APP_CONFIG.CHAT_PANEL_WIDTH;

    this.webView.setBounds({
      x: 0,
      y: 60, // Leave space for navigation bar
      width: width - chatPanelWidth,
      height: height - 60,
    });

    // Don't use setAutoResize - we'll handle it manually to avoid covering the nav bar
    // this.webView.setAutoResize({
    //   width: true,
    //   height: true,
    // });

    // Handle window resize to keep BrowserView bounds correct
    this.mainWindow.on('resize', () => {
      this.updateBrowserViewBoundsInternal();
    });

    // Set up navigation listeners
    this.webView.webContents.on('did-navigate', (_event, url) => {
      // Clear CSS key since page is reloading - old key is invalid
      this.accessibilityCssKey = null;
      this.notifyNavigation(url);
    });

    this.webView.webContents.on('did-navigate-in-page', (_event, url) => {
      this.notifyNavigation(url);
    });

    this.webView.webContents.on('dom-ready', () => {
      // Re-apply accessibility settings when DOM is ready
      this.applyCurrentAccessibilitySettings();
    });

    this.webView.webContents.on('did-finish-load', () => {
      const url = this.webView?.webContents.getURL() || '';
      const title = this.webView?.webContents.getTitle() || '';
      
      // Debounce to prevent duplicate processing (iframes can trigger this multiple times)
      if (this.pageLoadDebounceTimer) {
        clearTimeout(this.pageLoadDebounceTimer);
      }
      
      // Only process if URL is different or first load
      if (url !== this.lastProcessedUrl) {
        this.pageLoadDebounceTimer = setTimeout(() => {
          this.lastProcessedUrl = url;
          this.notifyPageLoad(url, title);
        }, 1000); // Wait 1 second for page to fully stabilize
      }
    });

    // Initialize CDP session
    await this.initializeCDPSession();
  }

  /**
   * Initialize Chrome DevTools Protocol session
   */
  private async initializeCDPSession(): Promise<void> {
    if (!this.webView) {
      throw new Error('Web view must be created before CDP session');
    }

    try {
      // Attach debugger to the webView
      this.webView.webContents.debugger.attach('1.3');

      // Get CDP session (cast to any to avoid complex typing)
      this.cdpSession = this.webView.webContents.debugger as any;

      console.log('CDP session initialized successfully');
    } catch (error) {
      console.error('Failed to initialize CDP session:', error);
      throw error;
    }
  }

  /**
   * Get the CDP session for DOM manipulation and inspection
   */
  public getCDPSession(): any {
    if (!this.cdpSession) {
      throw new Error('CDP session not initialized');
    }
    return this.cdpSession;
  }

  /**
   * Get the BrowserView webContents
   */
  public getWebContents(): Electron.WebContents | null {
    return this.webView?.webContents || null;
  }

  /**
   * Navigate to a URL in the web view
   */
  public async navigateToURL(url: string): Promise<void> {
    if (!this.webView) {
      throw new Error('Web view not initialized');
    }

    await this.webView.webContents.loadURL(url);
  }

  /**
   * Go back in navigation history
   */
  public goBack(): void {
    if (!this.webView) {
      throw new Error('Web view not initialized');
    }

    if (this.webView.webContents.canGoBack()) {
      this.webView.webContents.goBack();
    }
  }

  /**
   * Go forward in navigation history
   */
  public goForward(): void {
    if (!this.webView) {
      throw new Error('Web view not initialized');
    }

    if (this.webView.webContents.canGoForward()) {
      this.webView.webContents.goForward();
    }
  }

  /**
   * Refresh the current page
   */
  public refresh(): void {
    if (!this.webView) {
      throw new Error('Web view not initialized');
    }

    this.webView.webContents.reload();
  }

  /**
   * Update accessibility settings and apply CSS to webView
   */
  public updateAccessibilitySettings(settings: AccessibilitySettings): void {
    if (!this.webView) {
      console.error('Web view not initialized');
      return;
    }

    // Store settings for re-injection on navigation
    this.currentAccessibilitySettings = settings;
    console.log('Stored accessibility settings:', settings);
    
    // Only reload if we have a real page loaded (not blank or empty)
    const currentUrl = this.webView.webContents.getURL();
    if (currentUrl && currentUrl !== 'about:blank' && !currentUrl.startsWith('devtools://')) {
      console.log('Reloading page to apply new accessibility settings');
      this.webView.webContents.reload();
    } else {
      // No page loaded yet, just apply settings for next navigation
      console.log('No page loaded yet, settings will apply on next navigation');
    }
  }

  /**
   * Apply the current accessibility settings to the webView
   * Called on navigation events to persist settings
   */
  private async applyCurrentAccessibilitySettings(): Promise<void> {
    if (!this.webView || !this.currentAccessibilitySettings) {
      return;
    }

    try {
      const settings = this.currentAccessibilitySettings;
      console.log('Applying accessibility CSS to page:', settings);
      
      // Always remove previous CSS if we have a key
      if (this.accessibilityCssKey) {
        try {
          await this.webView.webContents.removeInsertedCSS(this.accessibilityCssKey);
          console.log('Removed previous accessibility CSS with key:', this.accessibilityCssKey);
        } catch (error) {
          console.error('Failed to remove previous CSS:', error);
        }
        this.accessibilityCssKey = null;
      }
      
      // If default profile, don't insert any CSS (page should be in original state)
      if (settings.profile === 'default') {
        console.log('Default profile - no CSS modifications applied');
        return;
      }
      
      const css = generateAccessibilityCSS(settings);
      
      // Only insert CSS if there are actual modifications
      if (css.trim().length > 0) {
        // Insert CSS into the page with user origin for high priority
        this.accessibilityCssKey = await this.webView.webContents.insertCSS(css, { cssOrigin: 'user' });
        console.log('Accessibility CSS applied successfully with key:', this.accessibilityCssKey);
      } else {
        console.log('No accessibility CSS to apply');
      }
    } catch (error) {
      console.error('Error in applyCurrentAccessibilitySettings:', error);
    }
  }

  /**
   * Set BrowserView visibility (hide when modal is open)
   */
  public setBrowserViewVisible(visible: boolean): void {
    if (!this.mainWindow || !this.webView) {
      return;
    }

    if (visible) {
      // Show the BrowserView
      this.mainWindow.addBrowserView(this.webView);
      this.updateBrowserViewBoundsInternal();
    } else {
      // Hide the BrowserView by removing it
      this.mainWindow.removeBrowserView(this.webView);
    }
  }

  /**
   * Update BrowserView bounds based on chat panel visibility
   */
  public updateBrowserViewBounds(chatPanelVisible: boolean): void {
    this.chatPanelVisible = chatPanelVisible;
    this.updateBrowserViewBoundsInternal();
  }

  /**
   * Internal method to update BrowserView bounds
   */
  private updateBrowserViewBoundsInternal(): void {
    if (!this.mainWindow || !this.webView) {
      return;
    }

    const [width, height] = this.mainWindow.getSize();
    const chatPanelWidth = this.chatPanelVisible ? APP_CONFIG.CHAT_PANEL_WIDTH : 0;

    this.webView.setBounds({
      x: 0,
      y: 60, // Leave space for navigation bar
      width: width - chatPanelWidth,
      height: height - 60,
    });
  }

  /**
   * Register a callback for navigation events
   */
  public onNavigate(callback: (url: string) => void): () => void {
    this.navigationCallbacks.push(callback);
    return () => {
      const index = this.navigationCallbacks.indexOf(callback);
      if (index > -1) {
        this.navigationCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Register a callback for page load complete events
   */
  public onPageLoad(callback: (url: string, title: string) => void): () => void {
    this.pageLoadCallbacks.push(callback);
    return () => {
      const index = this.pageLoadCallbacks.indexOf(callback);
      if (index > -1) {
        this.pageLoadCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Notify all registered navigation callbacks
   */
  private notifyNavigation(url: string): void {
    this.navigationCallbacks.forEach((callback) => callback(url));
  }

  /**
   * Notify all registered page load callbacks
   */
  private notifyPageLoad(url: string, title: string): void {
    this.pageLoadCallbacks.forEach((callback) => callback(url, title));
  }

  /**
   * Clean up resources
   */
  private cleanup(): void {
    if (this.webView?.webContents.debugger.isAttached()) {
      this.webView.webContents.debugger.detach();
    }

    this.mainWindow = null;
    this.webView = null;
    this.cdpSession = null;
    this.navigationCallbacks = [];
    this.pageLoadCallbacks = [];
  }

  /**
   * Get the main window instance
   */
  public getMainWindow(): BrowserWindow | null {
    return this.mainWindow;
  }
}

// Global declarations for Electron Forge Vite plugin
declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;
