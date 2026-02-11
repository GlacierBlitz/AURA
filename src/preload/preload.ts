import { contextBridge, ipcRenderer } from 'electron';
import type {
  UserInstructionPayload,
  NavigatePayload,
  SaveApiKeyPayload,
  ToggleChatPanelPayload,
  UpdateAccessibilityPayload,
  SetModalOpenPayload,
  TranscribeAudioPayload,
  TranscribeAudioResponse,
  PipelineSummaryPayload,
  PipelineStatusPayload,
  PipelineMessagePayload,
  PipelineErrorPayload,
  PipelineNavigationPayload,
  UIOpenAccessibilityPayload,
  ConfirmationRequestPayload,
  ConfirmationResponsePayload,
  LogQueryPayload,
  LogResultsPayload,
  PageContentPayload,
} from '@shared/types';
import { IPC_CHANNELS } from '@shared/types';

// Define the API that will be exposed to the renderer process
export interface ElectronAPI {
  // Send user actions to main process
  submitInstruction: (payload: UserInstructionPayload) => void;
  navigate: (payload: NavigatePayload) => void;
  navigateHome?: () => void;
  saveApiKey: (payload: SaveApiKeyPayload) => void;
  toggleChatPanel?: (payload: ToggleChatPanelPayload) => void;
  goBack?: () => void;
  goForward?: () => void;
  refresh?: () => void;
  updateAccessibility?: (payload: UpdateAccessibilityPayload) => void;
  setModalOpen?: (payload: SetModalOpenPayload) => void;
  transcribeAudio?: (payload: TranscribeAudioPayload) => Promise<TranscribeAudioResponse>;
  readPage?: (payload?: ReadPagePayload) => Promise<void>;
  invoke?: (channel: string, payload: any) => Promise<any>;

  // Listen for pipeline events from main process
  onPipelineSummary: (callback: (payload: PipelineSummaryPayload) => void) => () => void;
  onPipelineStatus: (callback: (payload: PipelineStatusPayload) => void) => () => void;
  onPipelineMessage: (callback: (payload: PipelineMessagePayload) => void) => () => void;
  onPipelineError: (callback: (payload: PipelineErrorPayload) => void) => () => void;
  onPipelineNavigation: (callback: (payload: PipelineNavigationPayload) => void) => () => void;
  onOpenAccessibilityPanel: (callback: (payload: UIOpenAccessibilityPayload) => void) => () => void;

  // Page content
  onPageContentReady: (callback: (payload: PageContentPayload) => void) => () => void;

  // Confirmation dialog
  onConfirmRequest: (callback: (payload: ConfirmationRequestPayload) => void) => () => void;
  sendConfirmResponse: (payload: ConfirmationResponsePayload) => void;

  // Action log
  queryLog: (payload: LogQueryPayload) => void;
  onLogResults: (callback: (payload: LogResultsPayload) => void) => () => void;
}

// Expose protected methods to the renderer via contextBridge
const electronAPI: ElectronAPI = {
  // User to Main
  submitInstruction: (payload: UserInstructionPayload) => {
    ipcRenderer.send(IPC_CHANNELS.USER_SUBMIT_INSTRUCTION, payload);
  },

  navigate: (payload: NavigatePayload) => {
    ipcRenderer.send(IPC_CHANNELS.USER_NAVIGATE, payload);
  },

  navigateHome: () => {
    ipcRenderer.send(IPC_CHANNELS.USER_NAVIGATE_HOME);
  },

  saveApiKey: (payload: SaveApiKeyPayload) => {
    ipcRenderer.send(IPC_CHANNELS.USER_SAVE_API_KEY, payload);
  },

  toggleChatPanel: (payload: ToggleChatPanelPayload) => {
    ipcRenderer.send(IPC_CHANNELS.USER_TOGGLE_CHAT_PANEL, payload);
  },

  goBack: () => {
    ipcRenderer.send(IPC_CHANNELS.USER_GO_BACK);
  },

  goForward: () => {
    ipcRenderer.send(IPC_CHANNELS.USER_GO_FORWARD);
  },

  refresh: () => {
    ipcRenderer.send(IPC_CHANNELS.USER_REFRESH);
  },

  updateAccessibility: (payload: UpdateAccessibilityPayload) => {
    ipcRenderer.send(IPC_CHANNELS.USER_UPDATE_ACCESSIBILITY, payload);
  },

  setModalOpen: (payload: SetModalOpenPayload) => {
    ipcRenderer.send(IPC_CHANNELS.USER_SET_MODAL_OPEN, payload);
  },

  transcribeAudio: (payload: TranscribeAudioPayload): Promise<TranscribeAudioResponse> => {
    return ipcRenderer.invoke(IPC_CHANNELS.USER_TRANSCRIBE_AUDIO, payload);
  },

  readPage: (payload?: ReadPagePayload): Promise<void> => {
    return ipcRenderer.invoke(IPC_CHANNELS.USER_READ_PAGE, payload);
  },

  invoke: (channel: string, payload: any): Promise<any> => {
    return ipcRenderer.invoke(channel, payload);
  },

  // Main to Renderer listeners
  onPipelineSummary: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: PipelineSummaryPayload) => {
      callback(payload);
    };
    ipcRenderer.on(IPC_CHANNELS.PIPELINE_SUMMARY, listener);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.PIPELINE_SUMMARY, listener);
    };
  },

  onPipelineStatus: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: PipelineStatusPayload) => {
      callback(payload);
    };
    ipcRenderer.on(IPC_CHANNELS.PIPELINE_STATUS, listener);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.PIPELINE_STATUS, listener);
    };
  },

  onPipelineMessage: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: PipelineMessagePayload) => {
      callback(payload);
    };
    ipcRenderer.on(IPC_CHANNELS.PIPELINE_MESSAGE, listener);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.PIPELINE_MESSAGE, listener);
    };
  },

  onPipelineError: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: PipelineErrorPayload) => {
      callback(payload);
    };
    ipcRenderer.on(IPC_CHANNELS.PIPELINE_ERROR, listener);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.PIPELINE_ERROR, listener);
    };
  },

  onPipelineNavigation: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: PipelineNavigationPayload) => {
      callback(payload);
    };
    ipcRenderer.on(IPC_CHANNELS.PIPELINE_NAVIGATION, listener);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.PIPELINE_NAVIGATION, listener);
    };
  },

  onOpenAccessibilityPanel: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: UIOpenAccessibilityPayload) => {
      callback(payload);
    };
    ipcRenderer.on(IPC_CHANNELS.UI_OPEN_ACCESSIBILITY, listener);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.UI_OPEN_ACCESSIBILITY, listener);
    };
  },

  onPageContentReady: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: PageContentPayload) => {
      callback(payload);
    };
    ipcRenderer.on(IPC_CHANNELS.PAGE_CONTENT_READY, listener);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.PAGE_CONTENT_READY, listener);
    };
  },

  // Confirmation
  onConfirmRequest: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: ConfirmationRequestPayload) => {
      callback(payload);
    };
    ipcRenderer.on(IPC_CHANNELS.CONFIRM_REQUEST, listener);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.CONFIRM_REQUEST, listener);
    };
  },

  sendConfirmResponse: (payload: ConfirmationResponsePayload) => {
    ipcRenderer.send(IPC_CHANNELS.CONFIRM_RESPONSE, payload);
  },

  // Action Log
  queryLog: (payload: LogQueryPayload) => {
    ipcRenderer.send(IPC_CHANNELS.LOG_QUERY, payload);
  },

  onLogResults: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: LogResultsPayload) => {
      callback(payload);
    };
    ipcRenderer.on(IPC_CHANNELS.LOG_RESULTS, listener);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.LOG_RESULTS, listener);
    };
  },
};

// Expose the API to the renderer process
contextBridge.exposeInMainWorld('electronAPI', electronAPI);

// Type declaration for window.electronAPI
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
