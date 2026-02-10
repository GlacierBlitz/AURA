import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '@shared/types';
import type {
  UserInstructionPayload,
  ConfirmationResponsePayload,
  LogQueryPayload,
  NavigatePayload,
  SaveApiKeyPayload,
  ToggleChatPanelPayload,
} from '@shared/types';

let electronShell: any = null;
let configureLLMCallback: ((apiKey: string) => void) | null = null;

/**
 * Register all IPC channel handlers
 */
export function registerIPCHandlers(shell?: any, configCallback?: (apiKey: string) => void): void {
  electronShell = shell;
  configureLLMCallback = configCallback;

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

  // User submits an instruction
  ipcMain.on(IPC_CHANNELS.USER_SUBMIT_INSTRUCTION, (event, payload: UserInstructionPayload) => {
    console.log('Received user instruction:', payload.text);
    // TODO: Forward to IntentPipeline in Phase 3
    // For now, just log it
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

  console.log('IPC handlers registered successfully');
}

/**
 * Send a message from main to renderer
 */
export function sendToRenderer(window: Electron.BrowserWindow, channel: string, payload: unknown) {
  window.webContents.send(channel, payload);
}
