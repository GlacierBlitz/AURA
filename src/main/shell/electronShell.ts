import { BrowserWindow, BrowserView, app, session } from 'electron';
import { APP_CONFIG } from '@shared/constants';
import path from 'path';
import type Protocol from 'devtools-protocol';

// Vite dev server URL and name injected by @electron-forge/plugin-vite
declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string | undefined;

export class ElectronShell {
  private mainWindow: BrowserWindow | null = null;
  private webView: BrowserView | null = null;
  private cdpSession: Protocol.ProtocolMapping.API | null = null;
  private navigationCallbacks: Array<(url: string) => void> = [];
  private pageLoadCallbacks: Array<(url: string, title: string) => void> = [];

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
        sandbox: true,
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

    // Show window when ready
    this.mainWindow.once('ready-to-show', () => {
      this.mainWindow?.show();
    });

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

    this.webView.setAutoResize({
      width: true,
      height: true,
    });

    // Set up navigation listeners
    this.webView.webContents.on('did-navigate', (_event, url) => {
      this.notifyNavigation(url);
    });

    this.webView.webContents.on('did-navigate-in-page', (_event, url) => {
      this.notifyNavigation(url);
    });

    this.webView.webContents.on('did-finish-load', () => {
      const url = this.webView?.webContents.getURL() || '';
      const title = this.webView?.webContents.getTitle() || '';
      this.notifyPageLoad(url, title);
    });

    // Initialize CDP session
    await this.initializeCDPSession();

    // Load a default page
    await this.webView.webContents.loadURL('about:blank');
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
