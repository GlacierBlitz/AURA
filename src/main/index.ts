import { app, BrowserWindow, session } from 'electron';
import { ElectronShell } from './shell/electronShell';
import { registerIPCHandlers, sendToRenderer } from './ipc/ipcHandlers';
import { IntentPipeline } from './pipeline/intentPipeline';
import { LLMOrchestrator } from './llm/llmOrchestrator';
import { OpenAIAdapter } from './llm/providers/openaiAdapter';
import { WhisperService } from './services/whisperService';
import { LLM_CONFIG } from '@shared/constants';
import { IPC_CHANNELS } from '@shared/types';
import type {
  PipelineSummaryPayload,
  PipelineStatusPayload,
  PipelineStatus,
  PipelineMessagePayload,
  PipelineNavigationPayload,
  UIOpenAccessibilityPayload,
  ChatMessage,
} from '@shared/types';
import type { ActionPlanResponse, ClarificationResponse } from '@shared/types';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Instantiate the electron shell
const electronShell = new ElectronShell();

// Instantiate LLM provider and pipeline
const openaiAdapter = new OpenAIAdapter();
const llmOrchestrator = new LLMOrchestrator(openaiAdapter);
const intentPipeline = new IntentPipeline(
  llmOrchestrator,
  // Accessibility callback - updates settings via electronShell
  (settings) => {
    electronShell.updateAccessibilitySettings(settings as any);
  },
  () => {
    if (!mainWindowRef) return;
    const payload: UIOpenAccessibilityPayload = { source: 'voice' };
    sendToRenderer(mainWindowRef, IPC_CHANNELS.UI_OPEN_ACCESSIBILITY, payload);
  }
);

// Instantiate Whisper service for voice transcription
const whisperService = new WhisperService();

// Auto-configure LLM provider with API key from environment
const apiKey = process.env.OPENAI_API_KEY;
if (apiKey) {
  openaiAdapter.configure({
    provider: 'openai',
    apiKey,
    model: LLM_CONFIG.DEFAULT_MODEL.openai,
    maxTokens: LLM_CONFIG.DEFAULT_MAX_TOKENS,
    temperature: LLM_CONFIG.DEFAULT_TEMPERATURE,
  });
  // Also configure Whisper service with same API key
  whisperService.configure(apiKey);
  console.log('LLM provider and Whisper service auto-configured from environment');
} else {
  console.warn('⚠️  OPENAI_API_KEY not found in environment variables. Please set it in .env file.');
}

// Keep reference to the main window for sending messages
let mainWindowRef: BrowserWindow | null = null;

/**
 * Register pipeline callbacks once (not per window)
 * Called during initialization
 */
function registerPipelineCallbacks() {
  intentPipeline.onSummary((summary, url) => {
    if (!mainWindowRef) return;
    const payload: PipelineSummaryPayload = {
      summary,
      url,
      timestamp: new Date().toISOString(),
    };
    sendToRenderer(mainWindowRef, IPC_CHANNELS.PIPELINE_SUMMARY, payload);
  });

  intentPipeline.onStatus((status) => {
    if (!mainWindowRef) return;
    const payload: PipelineStatusPayload = {
      status: status as PipelineStatus,
    };
    sendToRenderer(mainWindowRef, IPC_CHANNELS.PIPELINE_STATUS, payload);
  });

  intentPipeline.onError((error) => {
    if (!mainWindowRef) return;
    sendToRenderer(mainWindowRef, IPC_CHANNELS.PIPELINE_ERROR, {
      message: error.message,
      code: 'PIPELINE_ERROR',
    });
  });

  intentPipeline.onActionPlan((plan: ActionPlanResponse) => {
    if (!mainWindowRef) return;
    const message: ChatMessage = {
      id: `plan-${Date.now()}`,
      role: 'assistant',
      content: `I've analyzed your request and created an action plan with ${plan.steps.length} step(s). ${plan.explanation}`,
      timestamp: new Date().toISOString(),
    };
    const payload: PipelineMessagePayload = { message };
    sendToRenderer(mainWindowRef, IPC_CHANNELS.PIPELINE_MESSAGE, payload);
    console.log('Action plan sent to renderer');
  });

  intentPipeline.onClarification((clarification: ClarificationResponse) => {
    if (!mainWindowRef) return;
    const message: ChatMessage = {
      id: `clarification-${Date.now()}`,
      role: 'assistant',
      content: clarification.reason + (clarification.options ? '\n\nSuggestions:\n' + clarification.options.map(opt => `• ${opt}`).join('\n') : ''),
      timestamp: new Date().toISOString(),
    };
    const payload: PipelineMessagePayload = { message };
    sendToRenderer(mainWindowRef, IPC_CHANNELS.PIPELINE_MESSAGE, payload);
    console.log('Clarification sent to renderer');
  });

  intentPipeline.onActionResult((result) => {
    if (!mainWindowRef) return;
    console.log('[onActionResult callback] Creating message for action:', result.action.description);
    const message: ChatMessage = {
      id: `action-${Date.now()}`,
      role: 'assistant',
      content: `${result.action.description}${result.error ? ` - Error: ${result.error.message}` : ''}`,
      timestamp: new Date().toISOString(),
      actionResult: result,
    };
    const payload: PipelineMessagePayload = { message };
    sendToRenderer(mainWindowRef, IPC_CHANNELS.PIPELINE_MESSAGE, payload);
    console.log('[onActionResult callback] Action result sent to renderer:', result.status);
  });

  console.log('Pipeline callbacks registered');
}

/**
 * Create the main application window
 */
async function createWindow() {
  try {
    const mainWindow = await electronShell.createMainWindow();
    mainWindowRef = mainWindow;

    // Clear reference when window is closed
    mainWindow.on('closed', () => {
      mainWindowRef = null;
    });

    // Register navigation listeners
    electronShell.onNavigate((url) => {
      console.log('Navigated to:', url);
      if (!mainWindowRef) return;
      const payload: PipelineNavigationPayload = { url };
      sendToRenderer(mainWindowRef, IPC_CHANNELS.PIPELINE_NAVIGATION, payload);
    });

    electronShell.onPageLoad(async (url, title) => {
      console.log('Page loaded:', title, url);
      
      // Get CDP session
      const cdpSession = electronShell.getCDPSession();
      if (!cdpSession) {
        console.error('CDP session not available');
        return;
      }

      // Trigger pipeline
      await intentPipeline.processPageLoad(cdpSession, url);
    });

    return mainWindow;
  } catch (error) {
    console.error('Failed to create window:', error);
    app.quit();
  }
}

/**
 * Initialize the application
 */
async function initialize() {
  try {
    // Set up permissions for microphone (for voice input) and fullscreen videos
    session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
      const url = webContents.getURL();
      console.log('Permission request for:', permission, 'from:', url);
      
      // Allow all media permissions and fullscreen for our app's renderer
      if (permission === 'media' || permission === 'microphone' || permission === 'audioCapture' || permission === 'fullscreen') {
        console.log('Granting permission:', permission);
        callback(true);
        return;
      }
      
      console.log('Denying permission:', permission);
      callback(false);
    });

    // Also handle permission check (not just request)
    session.defaultSession.setPermissionCheckHandler((webContents, permission) => {
      console.log('Permission check for:', permission);
      // Allow media permissions and fullscreen
      if (permission === 'media' || permission === 'microphone' || permission === 'audioCapture' || permission === 'fullscreen') {
        return true;
      }
      return false;
    });

    // Register IPC handlers with references to shell and config function
    registerIPCHandlers(electronShell, configureLLMProvider, whisperService, intentPipeline);

    // Register pipeline callbacks once (before creating window)
    registerPipelineCallbacks();

    // Create the main window
    await createWindow();

    console.log(`${app.getName()} v${app.getVersion()} initialized successfully`);
  } catch (error) {
    console.error('Failed to initialize application:', error);
    app.quit();
  }
}

/**
 * Configure LLM provider with API key
 * Note: API key is now loaded from environment variables
 * This function is kept for backward compatibility but does nothing
 */
export function configureLLMProvider(apiKey: string): void {
  console.log('API key configuration ignored - using environment variable');
}

/**
 * Get IntentPipeline instance for IPC handlers
 */
export function getIntentPipeline(): IntentPipeline {
  return intentPipeline;
}

// Handle app lifecycle
app.on('ready', async () => {
  await initialize();
});

app.on('window-all-closed', () => {
  // On macOS, applications typically stay open until explicitly quit
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', async () => {
  // On macOS, re-create window when dock icon is clicked and no windows are open
  if (BrowserWindow.getAllWindows().length === 0) {
    await createWindow();
  }
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
});
