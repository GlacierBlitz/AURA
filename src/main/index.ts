import { app, BrowserWindow, session } from 'electron';
import { ElectronShell } from './shell/electronShell';
import { registerIPCHandlers, sendToRenderer } from './ipc/ipcHandlers';
import { IntentPipeline } from './pipeline/intentPipeline';
import { LLMOrchestrator } from './llm/llmOrchestrator';
import { OpenAIAdapter } from './llm/providers/openaiAdapter';
import { WhisperService } from './services/whisperService';
import { SerpService } from './services/serpService';
import { LLM_CONFIG } from '@shared/constants';
import { IPC_CHANNELS } from '@shared/types';
import type {
  PipelineSummaryPayload,
  PipelineStatusPayload,
  PipelineStatus,
  PipelineMessagePayload,
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
  }
);

// Instantiate Whisper service for voice transcription
const whisperService = new WhisperService();

// Instantiate SERP service for search autocomplete
const serpService = new SerpService();

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

// Auto-configure SerpAPI service with API key from environment
const serpApiKey = process.env.SERP_API_KEY;
if (serpApiKey) {
  serpService.configure(serpApiKey);
  console.log('✓ SerpAPI configured - search autocomplete ready');
} else {
  console.warn('⚠️  SERP_API_KEY not found in environment. Add SERP_API_KEY to .env for search autocomplete.');
}

/**
 * Create the main application window
 */
async function createWindow() {
  try {
    const mainWindow = await electronShell.createMainWindow();

    // Register navigation listeners
    electronShell.onNavigate((url) => {
      console.log('Navigated to:', url);
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

    // Register pipeline callbacks
    intentPipeline.onSummary((summary, url) => {
      const payload: PipelineSummaryPayload = {
        summary,
        url,
        timestamp: new Date().toISOString(),
      };
      sendToRenderer(mainWindow, IPC_CHANNELS.PIPELINE_SUMMARY, payload);
    });

    intentPipeline.onStatus((status) => {
      const payload: PipelineStatusPayload = {
        status: status as PipelineStatus,
      };
      sendToRenderer(mainWindow, IPC_CHANNELS.PIPELINE_STATUS, payload);
    });

    intentPipeline.onError((error) => {
      sendToRenderer(mainWindow, IPC_CHANNELS.PIPELINE_ERROR, {
        message: error.message,
        code: 'PIPELINE_ERROR',
      });
    });

    intentPipeline.onActionPlan((plan: ActionPlanResponse) => {
      const message: ChatMessage = {
        id: `plan-${Date.now()}`,
        role: 'assistant',
        content: `I've analyzed your request and created an action plan with ${plan.steps.length} step(s). ${plan.explanation}`,
        timestamp: new Date().toISOString(),
      };
      const payload: PipelineMessagePayload = { message };
      sendToRenderer(mainWindow, IPC_CHANNELS.PIPELINE_MESSAGE, payload);
      console.log('Action plan sent to renderer');
    });

    intentPipeline.onClarification((clarification: ClarificationResponse) => {
      const message: ChatMessage = {
        id: `clarification-${Date.now()}`,
        role: 'assistant',
        content: clarification.reason + (clarification.options ? '\n\nSuggestions:\n' + clarification.options.map(opt => `• ${opt}`).join('\n') : ''),
        timestamp: new Date().toISOString(),
      };
      const payload: PipelineMessagePayload = { message };
      sendToRenderer(mainWindow, IPC_CHANNELS.PIPELINE_MESSAGE, payload);
      console.log('Clarification sent to renderer');
    });

    intentPipeline.onActionResult((result) => {
      console.log('[onActionResult callback] Creating message for action:', result.action.description);
      const statusIcon = result.status === 'success' ? '✓' : '✗';
      const message: ChatMessage = {
        id: `action-${Date.now()}`,
        role: 'assistant',
        content: `${statusIcon} ${result.action.description}${result.error ? ` - Error: ${result.error.message}` : ''}`,
        timestamp: new Date().toISOString(),
        actionResult: result,
      };
      const payload: PipelineMessagePayload = { message };
      sendToRenderer(mainWindow, IPC_CHANNELS.PIPELINE_MESSAGE, payload);
      console.log('[onActionResult callback] Action result sent to renderer:', result.status);
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
    // Set up permissions for microphone (for voice input)
    session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
      const url = webContents.getURL();
      console.log('Permission request for:', permission, 'from:', url);
      
      // Allow all media permissions for our app's renderer
      if (permission === 'media' || permission === 'microphone' || permission === 'audioCapture') {
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
      // Allow media permissions
      if (permission === 'media' || permission === 'microphone' || permission === 'audioCapture') {
        return true;
      }
      return false;
    });

    // Register IPC handlers with references to shell and config function
    registerIPCHandlers(electronShell, configureLLMProvider, whisperService, intentPipeline, serpService);

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
