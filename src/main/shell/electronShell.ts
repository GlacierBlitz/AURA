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
  private accessibilityApplyToken: number = 0;
  private readonly accessibilityStyleElementId: string = 'aura-accessibility-style';
  private suggestionsVisible: boolean = false;
  private initialPageLoadComplete: boolean = false;

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
        // Allow fullscreen API
        allowRunningInsecureContent: false,
        experimentalFeatures: false,
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
      console.log('Navigation detected');
      this.notifyNavigation(url);
    });

    this.webView.webContents.on('did-navigate-in-page', (_event, url) => {
      this.notifyNavigation(url);

      const title = this.webView?.webContents.getTitle() || '';
      if (url !== this.lastProcessedUrl) {
        console.log(`[did-navigate-in-page] URL changed from ${this.lastProcessedUrl} to ${url}, scheduling processPageLoad`);
        this.lastProcessedUrl = url;
        if (this.pageLoadDebounceTimer) {
          clearTimeout(this.pageLoadDebounceTimer);
        }
        this.pageLoadDebounceTimer = setTimeout(() => {
          this.notifyPageLoad(url, title);
        }, 500);
      } else {
        console.log(`[did-navigate-in-page] URL unchanged (${url}), skipping`);
      }
    });

    // Handle fullscreen video requests
    this.webView.webContents.on('enter-full-screen', () => {
      console.log('Video entered fullscreen mode');
      if (this.mainWindow) {
        this.mainWindow.setFullScreen(true);
      }
    });

    this.webView.webContents.on('leave-full-screen', () => {
      console.log('Video left fullscreen mode');
      if (this.mainWindow) {
        this.mainWindow.setFullScreen(false);
      }
    });

    // Handle Escape key to exit fullscreen
    this.webView.webContents.on('before-input-event', (event, input) => {
      if (input.key === 'Escape' && this.mainWindow?.isFullScreen()) {
        console.log('Escape pressed, exiting fullscreen');
        this.mainWindow.setFullScreen(false);
      }
    });

    this.webView.webContents.on('did-start-loading', () => {
      // Reset initial load flag when starting a new navigation
      this.initialPageLoadComplete = false;
      console.log('Page loading started');
    });

    this.webView.webContents.on('dom-ready', () => {
      // Re-apply accessibility settings when DOM is ready
      this.applyCurrentAccessibilitySettings();
    });

    this.webView.webContents.on('did-finish-load', () => {
      const url = this.webView?.webContents.getURL() || '';
      const title = this.webView?.webContents.getTitle() || '';
      
      console.log(`[did-finish-load] fired for: ${url}`);
      
      // Mark initial load as complete
      this.initialPageLoadComplete = true;
      
      // Debounce to prevent duplicate processing (iframes can trigger this multiple times)
      if (this.pageLoadDebounceTimer) {
        clearTimeout(this.pageLoadDebounceTimer);
      }
      
      // Only process if URL is different or first load
      if (url !== this.lastProcessedUrl) {
        console.log(`[did-finish-load] URL changed from ${this.lastProcessedUrl} to ${url}, scheduling processPageLoad`);
        // Update immediately to prevent duplicate scheduling
        this.lastProcessedUrl = url;
        
        this.pageLoadDebounceTimer = setTimeout(() => {
          this.notifyPageLoad(url, title);
        }, 1000); // Wait 1 second for page to fully stabilize
      } else {
        console.log(`[did-finish-load] URL unchanged (${url}), skipping`);
      }
    });

    // Initialize CDP session
    await this.initializeCDPSession();

    // Load homepage by default
    const homepagePath = this.resolveAssetPath('homepage.html');
    await this.webView.webContents.loadFile(homepagePath);
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

    // If a caller accidentally passes our internal app token, handle it gracefully
    if (typeof url === 'string' && url === 'app:home') {
      console.log('[ElectronShell] navigateToURL received app:home token, routing to navigateHome');
      return this.navigateHome();
    }

    await this.webView.webContents.loadURL(url);
  }

  /**
   * Navigate back to the app homepage (assets/homepage.html)
   */
  public async navigateHome(): Promise<void> {
    if (!this.webView) {
      throw new Error('Web view not initialized');
    }

    const homepagePath = this.resolveAssetPath('homepage.html');
    await this.webView.webContents.loadFile(homepagePath);
  }

  /**
   * Resolve path to asset file, handling both development and production
   */
  private resolveAssetPath(filename: string): string {
    // In development, app.getAppPath() points to .vite/build/
    // We need to go to the project root
    const appPath = app.getAppPath();
    
    // Check if we're in development (path contains .vite/build)
    if (appPath.includes('.vite')) {
      // Go up from .vite/build to project root
      return path.join(appPath, '..', '..', 'assets', filename);
    }
    
    // In production, assets should be in the app directory
    return path.join(appPath, 'assets', filename);
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
    const applyToken = ++this.accessibilityApplyToken;
    console.log('Stored accessibility settings:', settings);
    console.log('WebView state - isLoading:', this.webView.webContents.isLoading());
    console.log('WebView state - URL:', this.webView.webContents.getURL());
    console.log('WebView state - initialPageLoadComplete:', this.initialPageLoadComplete);
    
    // Apply settings immediately to current page - check if webContents has a valid page
    const currentUrl = this.webView.webContents.getURL();
    const hasValidUrl = currentUrl && 
                       currentUrl !== 'about:blank' && 
                       !currentUrl.startsWith('devtools://') &&
                       !currentUrl.startsWith('chrome-extension://');
    
    if (hasValidUrl && !this.webView.webContents.isLoading()) {
      console.log('Applying accessibility settings to current page without reload');
      this.applyCurrentAccessibilitySettings(applyToken).catch(error => {
        console.error('Failed to apply accessibility settings immediately:', error);
        console.error('Error details:', error.stack);
      });
    } else {
      // Page not loaded or loading, settings will apply when DOM is ready
      console.log('Page not ready for immediate settings application, will apply on DOM ready');
      console.log('  hasValidUrl:', hasValidUrl);
      console.log('  isLoading:', this.webView.webContents.isLoading());
    }
  }

  /**
   * Apply the current accessibility settings to the webView
   * Called on navigation events to persist settings
   */
  private async applyCurrentAccessibilitySettings(applyToken?: number): Promise<void> {
    if (!this.webView || !this.currentAccessibilitySettings) {
      return;
    }

    try {
      const activeToken = applyToken ?? this.accessibilityApplyToken;
      const settings = this.currentAccessibilitySettings;
      console.log('Applying accessibility CSS to page:', settings);
      
      // Wait for webContents to be ready if it's still loading
      if (this.webView.webContents.isLoading()) {
        console.log('WebContents still loading, waiting for completion...');
        await new Promise((resolve) => {
          const onceLoaded = () => {
            this.webView?.webContents.off('did-finish-load', onceLoaded);
            resolve(void 0);
          };
          this.webView?.webContents.once('did-finish-load', onceLoaded);
        });
      }

      if (activeToken !== this.accessibilityApplyToken) {
        console.log('Accessibility settings changed during apply, skipping stale run');
        return;
      }

      if (activeToken !== this.accessibilityApplyToken) {
        console.log('Accessibility settings changed during clear, skipping stale run');
        return;
      }

      const css = settings.profile === 'default' ? '' : generateAccessibilityCSS(settings);
      const styleId = this.accessibilityStyleElementId;

      await this.webView.webContents.executeJavaScript(
        `
          (function() {
            const styleId = ${JSON.stringify(styleId)};
            const cssText = ${JSON.stringify(css)};
            let styleEl = document.getElementById(styleId);

            if (!cssText) {
              if (styleEl && styleEl.parentNode) {
                styleEl.parentNode.removeChild(styleEl);
              }
              return true;
            }

            if (!styleEl) {
              styleEl = document.createElement('style');
              styleEl.id = styleId;
              styleEl.type = 'text/css';
              const target = document.head || document.documentElement;
              if (target) {
                target.appendChild(styleEl);
              }
            }

            styleEl.textContent = cssText;
            return true;
          })()
        `,
        true
      );

      if (css.trim().length > 0) {
        console.log('Accessibility CSS applied via style element');
        console.log('Applied CSS length:', css.length, 'characters');
      } else {
        console.log('Default profile - accessibility style element removed');
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
   * Set suggestions dropdown visibility (hide BrowserView to allow clicking)
   */
  public setSuggestionsVisible(visible: boolean): void {
    this.suggestionsVisible = visible;
    // Hide the BrowserView entirely when suggestions are shown
    // This allows React dropdown clicks to work
    this.setBrowserViewVisible(!visible);
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
