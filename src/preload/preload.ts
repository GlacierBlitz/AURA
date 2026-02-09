import { contextBridge, ipcRenderer } from 'electron';
import type {
  UserInstructionPayload,
  NavigatePayload,
  SaveApiKeyPayload,
  PipelineSummaryPayload,
  PipelineStatusPayload,
  PipelineMessagePayload,
  PipelineErrorPayload,
  ConfirmationRequestPayload,
  ConfirmationResponsePayload,
  LogQueryPayload,
  LogResultsPayload,
} from '@shared/types';
import { IPC_CHANNELS } from '@shared/types';

// Define the API that will be exposed to the renderer process
export interface ElectronAPI {
  // Send user actions to main process
  submitInstruction: (payload: UserInstructionPayload) => void;
  navigate: (payload: NavigatePayload) => void;
  saveApiKey: (payload: SaveApiKeyPayload) => void;

  // Listen for pipeline events from main process
  onPipelineSummary: (callback: (payload: PipelineSummaryPayload) => void) => () => void;
  onPipelineStatus: (callback: (payload: PipelineStatusPayload) => void) => () => void;
  onPipelineMessage: (callback: (payload: PipelineMessagePayload) => void) => () => void;
  onPipelineError: (callback: (payload: PipelineErrorPayload) => void) => () => void;

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

  saveApiKey: (payload: SaveApiKeyPayload) => {
    ipcRenderer.send(IPC_CHANNELS.USER_SAVE_API_KEY, payload);
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
