import { create } from 'zustand';
import type {
  PageSummary,
  ChatMessage,
  PipelineStatus,
  ErrorInfo,
  ActionDescriptor,
} from '@shared/types';

interface AppState {
  // Pipeline status
  pipelineStatus: PipelineStatus;
  setPipelineStatus: (status: PipelineStatus) => void;

  // Page summary
  currentSummary: PageSummary | null;
  currentUrl: string | null;
  setCurrentSummary: (summary: PageSummary, url: string) => void;

  // Chat messages
  messages: ChatMessage[];
  addMessage: (message: ChatMessage) => void;
  clearMessages: () => void;

  // Error state
  currentError: ErrorInfo | null;
  setError: (error: ErrorInfo | null) => void;

  // Confirmation dialog
  pendingConfirmation: { action: ActionDescriptor; reason: string } | null;
  setPendingConfirmation: (confirmation: { action: ActionDescriptor; reason: string } | null) => void;

  // User input
  inputText: string;
  setInputText: (text: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  // Pipeline status
  pipelineStatus: 'idle',
  setPipelineStatus: (status) => set({ pipelineStatus: status }),

  // Page summary
  currentSummary: null,
  currentUrl: null,
  setCurrentSummary: (summary, url) => set({ currentSummary: summary, currentUrl: url }),

  // Chat messages
  messages: [],
  addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
  clearMessages: () => set({ messages: [] }),

  // Error state
  currentError: null,
  setError: (error) => set({ currentError: error }),

  // Confirmation dialog
  pendingConfirmation: null,
  setPendingConfirmation: (confirmation) => set({ pendingConfirmation: confirmation }),

  // User input
  inputText: '',
  setInputText: (text) => set({ inputText: text }),
}));
