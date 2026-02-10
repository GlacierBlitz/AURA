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
  AutocompletePayload,
  AutocompleteResponse,
  SetSuggestionsVisiblePayload,
} from '@shared/types';

let electronShell: any = null;
let configureLLMCallback: ((apiKey: string) => void) | null = null;
let whisperService: any = null;
let intentPipeline: any = null;
let serpService: any = null;

/**
 * Register all IPC channel handlers
 */
export function registerIPCHandlers(
  shell?: any,
  configCallback?: (apiKey: string) => void,
  whisper?: any,
  pipeline?: any,
  serp?: any
): void {
  electronShell = shell;
  configureLLMCallback = configCallback;
  whisperService = whisper;
  intentPipeline = pipeline;
  serpService = serp;

  // User navigates to URL
  ipcMain.on(IPC_CHANNELS.USER_NAVIGATE, (event, payload: NavigatePayload) => {
    console.log('Navigate to:', payload.url);
    if (electronShell && electronShell.navigateToURL) {
      electronShell.navigateToURL(payload.url);
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
    console.log('Update accessibility settings:', payload);
    if (electronShell && electronShell.updateAccessibilitySettings) {
      electronShell.updateAccessibilitySettings(payload);
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

  // User requests search autocomplete suggestions
  ipcMain.handle(IPC_CHANNELS.USER_AUTOCOMPLETE, async (event, payload: AutocompletePayload): Promise<AutocompleteResponse> => {
    console.log('Received autocomplete request for:', payload.query);
    
    if (!serpService) {
      return { suggestions: [], error: 'SERP service not available' };
    }

    try {
      const response = await serpService.getAutocomplete(payload.query);
      return response;
    } catch (error: any) {
      console.error('Autocomplete error:', error);
      return { suggestions: [], error: error.message || 'Failed to fetch suggestions' };
    }
  });

  // User sets suggestions visibility (hides BrowserView to allow clicking suggestions)
  ipcMain.handle(IPC_CHANNELS.USER_SET_SUGGESTIONS_VISIBLE, (event, payload: SetSuggestionsVisiblePayload) => {
    console.log('Set suggestions visible:', payload.visible);
    if (electronShell && electronShell.setSuggestionsVisible) {
      electronShell.setSuggestionsVisible(payload.visible);
    }
  });

  console.log('IPC handlers registered successfully');
}

/**
 * Send a message from main to renderer
 */
export function sendToRenderer(window: Electron.BrowserWindow, channel: string, payload: unknown) {
  window.webContents.send(channel, payload);
}
