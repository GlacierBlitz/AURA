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
  SetVoiceModePayload,
  FocusReadingTogglePayload,
  FocusReadingUpdateSettingsPayload,
} from '@shared/types';

let electronShell: any = null;
let configureLLMCallback: ((apiKey: string) => void) | null = null;
let whisperService: any = null;
let intentPipeline: any = null;

/**
 * Check if user instruction is a voice mode switch command
 * Returns the mode to switch to, or null if not a mode switch command
 */
function checkVoiceModeSwitchCommand(instruction: string): 'push-to-talk' | 'toggle' | null {
  const normalized = instruction.toLowerCase().trim();
  
  // Push-to-talk patterns
  const pushToTalkPatterns = [
    /switch.*to.*push.*to.*talk/,
    /change.*to.*push.*to.*talk/,
    /use.*push.*to.*talk/,
    /enable.*push.*to.*talk/,
    /set.*mode.*push.*to.*talk/,
    /set.*voice.*mode.*push.*to.*talk/,
    /hold.*to.*talk/,
    /hold.*spacebar/,
  ];
  
  // Toggle patterns
  const togglePatterns = [
    /switch.*to.*toggle/,
    /change.*to.*toggle/,
    /use.*toggle/,
    /enable.*toggle/,
    /set.*mode.*toggle/,
    /set.*voice.*mode.*toggle/,
    /press.*to.*toggle/,
    /toggle.*mode/,
  ];
  
  for (const pattern of pushToTalkPatterns) {
    if (pattern.test(normalized)) {
      return 'push-to-talk';
    }
  }
  
  for (const pattern of togglePatterns) {
    if (pattern.test(normalized)) {
      return 'toggle';
    }
  }
  
  return null;
}

/**
 * Register all IPC channel handlers
 */
export function registerIPCHandlers(
  shell?: any,
  configCallback?: (apiKey: string) => void,
  whisper?: any,
  pipeline?: any
): void {
  electronShell = shell;
  configureLLMCallback = configCallback;
  whisperService = whisper;
  intentPipeline = pipeline;

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
    
    // Check if instruction is a voice mode switch command
    const voiceModeSwitchResult = checkVoiceModeSwitchCommand(payload.text);
    if (voiceModeSwitchResult) {
      console.log('Detected voice mode switch command:', voiceModeSwitchResult);
      // Send voice mode change to renderer
      if (electronShell && electronShell.getMainWindow) {
        const mainWindow = electronShell.getMainWindow();
        if (mainWindow) {
          sendToRenderer(mainWindow, IPC_CHANNELS.UI_SET_VOICE_MODE, { mode: voiceModeSwitchResult });
          // Send confirmation message
          const confirmationMessage = {
            id: `assistant-${Date.now()}`,
            role: 'assistant' as const,
            content: voiceModeSwitchResult === 'push-to-talk'
              ? 'Voice mode changed to Push to Talk. Hold spacebar to record.'
              : 'Voice mode changed to Toggle. Press spacebar to start/stop recording.',
            timestamp: new Date().toISOString(),
          };
          sendToRenderer(mainWindow, IPC_CHANNELS.PIPELINE_MESSAGE, { message: confirmationMessage });
        }
      }
      return;
    }
    
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

  // ─── Focus Reading Handlers ───────────────────────────────

  // Toggle focus reading mode
  ipcMain.handle(IPC_CHANNELS.FOCUS_READING_TOGGLE, async (event, payload: FocusReadingTogglePayload) => {
    console.log('Focus reading toggle:', payload.enabled);
    if (electronShell && electronShell.toggleFocusReading) {
      await electronShell.toggleFocusReading(payload.enabled, payload.settings);
    }
  });

  // Navigate to next paragraph
  ipcMain.handle(IPC_CHANNELS.FOCUS_READING_NEXT, async () => {
    if (electronShell && electronShell.focusReadingNext) {
      await electronShell.focusReadingNext();
    }
  });

  // Navigate to previous paragraph
  ipcMain.handle(IPC_CHANNELS.FOCUS_READING_PREV, async () => {
    if (electronShell && electronShell.focusReadingPrev) {
      await electronShell.focusReadingPrev();
    }
  });

  // Exit focus reading mode
  ipcMain.handle(IPC_CHANNELS.FOCUS_READING_EXIT, async () => {
    if (electronShell && electronShell.exitFocusReading) {
      await electronShell.exitFocusReading();
    }
  });

  // Update focus reading settings
  ipcMain.handle(IPC_CHANNELS.FOCUS_READING_UPDATE_SETTINGS, async (event, payload: FocusReadingUpdateSettingsPayload) => {
    console.log('Focus reading update settings:', payload.settings);
    if (electronShell && electronShell.updateFocusReadingSettings) {
      await electronShell.updateFocusReadingSettings(payload.settings);
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
