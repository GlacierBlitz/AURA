import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '@shared/types';
import type {
  UserInstructionPayload,
  ConfirmationResponsePayload,
  LogQueryPayload,
  NavigatePayload,
  SaveApiKeyPayload,
  ToggleChatPanelPayload,
  UpdateAccessibilityPayload,
  SetModalOpenPayload,
  TranscribeAudioPayload,
  TranscribeAudioResponse,
  SetSuggestionsVisiblePayload,
  PageContentPayload,
  ReadPagePayload,
} from '@shared/types';
import { PageTextExtractor, type ContentType } from '../pipeline/pageTextExtractor';

let electronShell: any = null;
let configureLLMCallback: ((apiKey: string) => void) | null = null;
let whisperService: any = null;
let intentPipeline: any = null;
let browserWindow: Electron.BrowserWindow | null = null;

/**
 * Handle a read page request with specified content type
 */
async function handleReadPageRequest(
  contentType: string,
  window: Electron.BrowserWindow | null
): Promise<void> {
  if (!electronShell || !window) {
    console.error('Electron shell or browser window not available for read page');
    return;
  }

  try {
    const cdpSession = electronShell.getCDPSession();
    if (!cdpSession) {
      console.error('CDP session not available for read page');
      return;
    }

    const textExtractor = new PageTextExtractor();
    const [text, metadata] = await Promise.all([
      textExtractor.extractTargetedContent(cdpSession, contentType as ContentType),
      textExtractor.extractPageMetadata(cdpSession),
    ]);

    const payload: PageContentPayload = {
      text,
      title: metadata.title,
      url: metadata.url,
    };

    window.webContents.send(IPC_CHANNELS.PAGE_CONTENT_READY, payload);
  } catch (error: any) {
    console.error('Error reading page:', error);
    const errorPayload: PageContentPayload = {
      text: 'Sorry, I could not read the page content. ' + (error?.message || ''),
      title: 'Error',
      url: '',
    };
    window.webContents.send(IPC_CHANNELS.PAGE_CONTENT_READY, errorPayload);
  }
}


export function registerIPCHandlers(
  shell?: any,
  configCallback?: (apiKey: string) => void,
  whisper?: any,
  pipeline?: any,
  window?: Electron.BrowserWindow
): void {
  electronShell = shell;
  configureLLMCallback = configCallback;
  whisperService = whisper;
  intentPipeline = pipeline;
  browserWindow = window || null;

  // Set browser window in pipeline for read commands
  if (intentPipeline && intentPipeline.setBrowserWindow && browserWindow) {
    intentPipeline.setBrowserWindow(browserWindow);
  }

  // Set up read command handler in pipeline
  if (intentPipeline && intentPipeline.onReadCommand) {
    intentPipeline.onReadCommand(async (contentType: string) => {
      console.log('Pipeline requesting read for content type:', contentType);
      await handleReadPageRequest(contentType, browserWindow);
    });
  }

  // User navigates to URL
  ipcMain.on(IPC_CHANNELS.USER_NAVIGATE, (event, payload: NavigatePayload) => {
    console.log('Navigate to:', payload.url);
    if (!electronShell) {
      console.error('Electron shell not available for navigation');
      return;
    }

    // Support special app-* tokens to load packaged resources
    if (typeof payload.url === 'string' && payload.url.startsWith('app:')) {
      console.log('Detected app token navigation:', payload.url);
      if (payload.url === 'app:home' && electronShell.navigateHome) {
        electronShell.navigateHome();
        return;
      }
      // Unknown app: token - log and ignore
      console.warn('Unknown app token:', payload.url);
      return;
    }

    if (electronShell.navigateToURL) {
      electronShell.navigateToURL(payload.url);
    }
  });

  // Dedicated channel to navigate to packaged app homepage
  ipcMain.on(IPC_CHANNELS.USER_NAVIGATE_HOME, () => {
    console.log('Navigate to app homepage');
    if (electronShell && electronShell.navigateHome) {
      electronShell.navigateHome();
    } else {
      console.error('Electron shell or navigateHome not available');
    }
  });

  // User saves API key
  ipcMain.on(IPC_CHANNELS.USER_SAVE_API_KEY, (event, payload: SaveApiKeyPayload) => {
    console.log('Saving API key for provider:', payload.provider);
    if (configureLLMCallback) {
      configureLLMCallback(payload.apiKey);
    }
  });

  // User toggles chat panel
  ipcMain.on(IPC_CHANNELS.USER_TOGGLE_CHAT_PANEL, (event, payload: ToggleChatPanelPayload) => {
    console.log('Toggle chat panel:', payload.visible);
    if (electronShell && electronShell.updateBrowserViewBounds) {
      electronShell.updateBrowserViewBounds(payload.visible);
    }
  });

  // User goes back
  ipcMain.on(IPC_CHANNELS.USER_GO_BACK, () => {
    console.log('Go back');
    if (electronShell && electronShell.goBack) {
      electronShell.goBack();
    }
  });

  // User goes forward
  ipcMain.on(IPC_CHANNELS.USER_GO_FORWARD, () => {
    console.log('Go forward');
    if (electronShell && electronShell.goForward) {
      electronShell.goForward();
    }
  });

  // User refreshes page
  ipcMain.on(IPC_CHANNELS.USER_REFRESH, () => {
    console.log('Refresh page');
    if (electronShell && electronShell.refresh) {
      electronShell.refresh();
    }
  });

  // User updates accessibility settings
  ipcMain.on(IPC_CHANNELS.USER_UPDATE_ACCESSIBILITY, (event, payload: UpdateAccessibilityPayload) => {
    console.log('IPC: Received accessibility settings update:', JSON.stringify(payload, null, 2));
    if (electronShell && electronShell.updateAccessibilitySettings) {
      console.log('IPC: Calling electronShell.updateAccessibilitySettings');
      try {
        electronShell.updateAccessibilitySettings(payload);
        console.log('IPC: Successfully called updateAccessibilitySettings');
      } catch (error) {
        console.error('IPC: Error calling updateAccessibilitySettings:', error);
      }
    } else {
      console.error('IPC: electronShell or updateAccessibilitySettings not available');
      console.error('IPC: electronShell exists:', !!electronShell);
      if (electronShell) {
        console.error('IPC: updateAccessibilitySettings exists:', !!electronShell.updateAccessibilitySettings);
      }
    }
  });

  // User opens/closes modal (hide/show BrowserView)
  ipcMain.on(IPC_CHANNELS.USER_SET_MODAL_OPEN, (event, payload: SetModalOpenPayload) => {
    console.log('Set modal open:', payload.isOpen);
    if (electronShell && electronShell.setBrowserViewVisible) {
      electronShell.setBrowserViewVisible(!payload.isOpen);
    }
  });

  // User requests audio transcription
  ipcMain.handle(IPC_CHANNELS.USER_TRANSCRIBE_AUDIO, async (event, payload: TranscribeAudioPayload): Promise<TranscribeAudioResponse> => {
    console.log('Received audio transcription request, size:', payload.audioData.length);
    
    if (!whisperService) {
      return { error: 'Whisper service not available' };
    }

    try {
      const audioData = new Uint8Array(payload.audioData);
      const text = await whisperService.transcribe(audioData, payload.mimeType);
      return { text };
    } catch (error: any) {
      console.error('Transcription error:', error);
      return { error: error.message || 'Failed to transcribe audio' };
    }
  });

  // User submits an instruction
  ipcMain.on(IPC_CHANNELS.USER_SUBMIT_INSTRUCTION, async (event, payload: UserInstructionPayload) => {
    console.log('Received user instruction:', payload.text);
    
    if (!intentPipeline) {
      console.error('Intent pipeline not available');
      return;
    }

    if (!electronShell) {
      console.error('Electron shell not available');
      return;
    }

    try {
      // Get CDP session from electron shell
      const cdpSession = electronShell.getCDPSession();
      if (!cdpSession) {
        console.error('CDP session not available');
        return;
      }

      // Process the instruction through the pipeline
      // Note: conversation history will be added when ContextManager is implemented
      await intentPipeline.processUserInstruction(payload.text, cdpSession, []);
    } catch (error: any) {
      console.error('Error processing user instruction:', error);
    }
  });

  // User responds to confirmation dialog
  ipcMain.on(IPC_CHANNELS.CONFIRM_RESPONSE, (event, payload: ConfirmationResponsePayload) => {
    console.log('Received confirmation response:', payload.decision);
    // TODO: Forward to ConfirmationService in Phase 3
  });

  // User queries action log
  ipcMain.on(IPC_CHANNELS.LOG_QUERY, (event, payload: LogQueryPayload) => {
    console.log('Received log query:', payload);
    // TODO: Forward to ActionLogger in Phase 4
  });

  // User sets suggestions visibility (hides BrowserView to allow clicking suggestions)
  ipcMain.handle(IPC_CHANNELS.USER_SET_SUGGESTIONS_VISIBLE, (event, payload: SetSuggestionsVisiblePayload) => {
    console.log('Set suggestions visible:', payload.visible);
    if (electronShell && electronShell.setSuggestionsVisible) {
      electronShell.setSuggestionsVisible(payload.visible);
    }
  });

  // User requests to read page content
  ipcMain.handle(IPC_CHANNELS.USER_READ_PAGE, async (event, payload?: ReadPagePayload) => {
    console.log('Received request to read page', payload);

    if (!electronShell) {
      console.error('Electron shell not available for reading page');
      return;
    }

    try {
      // Get CDP session from electron shell
      const cdpSession = electronShell.getCDPSession();
      if (!cdpSession) {
        console.error('CDP session not available for reading page');
        return;
      }

      // Determine content type to extract
      const contentType: ContentType = payload?.contentType || 'full';

      // Extract content and metadata
      const textExtractor = new PageTextExtractor();
      const [text, metadata] = await Promise.all([
        textExtractor.extractTargetedContent(cdpSession, contentType),
        textExtractor.extractPageMetadata(cdpSession),
      ]);

      // Send the page content back to renderer
      const pagePayload: PageContentPayload = {
        text,
        title: metadata.title,
        url: metadata.url,
      };

      // Send via sender to get correct window
      event.sender.send(IPC_CHANNELS.PAGE_CONTENT_READY, pagePayload);
    } catch (error: any) {
      console.error('Error reading page:', error);
      const errorPayload: PageContentPayload = {
        text: 'Sorry, I could not read the page content. ' + (error?.message || ''),
        title: 'Error',
        url: '',
      };
      event.sender.send(IPC_CHANNELS.PAGE_CONTENT_READY, errorPayload);
    }
  });

  console.log('IPC handlers registered successfully');
}

/**
 * Set the browser window for IPC handlers
 * Called after the main window is created
 */
export function setBrowserWindowForIPC(window: Electron.BrowserWindow): void {
  browserWindow = window;
}

/**
 * Send a message from main to renderer
 */
export function sendToRenderer(window: Electron.BrowserWindow, channel: string, payload: unknown) {
  window.webContents.send(channel, payload);
}
