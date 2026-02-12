import { create } from 'zustand';
import type {
  PageSummary,
  ChatMessage,
  PipelineStatus,
  ErrorInfo,
  ActionDescriptor,
} from '@shared/types';
import type { FocusHighlightStyle } from '@shared/types/accessibility';

interface AppState {
  // Pipeline status
  pipelineStatus: PipelineStatus;
  setPipelineStatus: (status: PipelineStatus) => void;

  // Page summary
  currentSummary: PageSummary | null;
  currentUrl: string | null;
  setCurrentSummary: (summary: PageSummary, url: string) => void;
  setCurrentUrl: (url: string) => void;

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

  // Voice input mode
  voiceInputMode: 'push-to-talk' | 'toggle';
  setVoiceInputMode: (mode: 'push-to-talk' | 'toggle') => void;

  // Focus reading
  focusReadingActive: boolean;
  focusReadingParagraphIndex: number;
  focusReadingTotalParagraphs: number;
  focusReadingDimOpacity: number;
  focusReadingHighlightStyle: FocusHighlightStyle;
  setFocusReadingActive: (active: boolean) => void;
  setFocusReadingStatus: (index: number, total: number) => void;
  setFocusReadingDimOpacity: (opacity: number) => void;
  setFocusReadingHighlightStyle: (style: FocusHighlightStyle) => void;
}

export const useAppStore = create<AppState>((set) => ({
  // Pipeline status
  pipelineStatus: 'idle',
  setPipelineStatus: (status) => set({ pipelineStatus: status }),

  // Page summary
  currentSummary: null,
  currentUrl: null,
  setCurrentSummary: (summary, url) => set({ currentSummary: summary, currentUrl: url }),
  setCurrentUrl: (url) => set({ currentUrl: url }),

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

  // Voice input mode
  voiceInputMode: 'push-to-talk',
  setVoiceInputMode: (mode) => set({ voiceInputMode: mode }),

  // Focus reading
  focusReadingActive: false,
  focusReadingParagraphIndex: 0,
  focusReadingTotalParagraphs: 0,
  focusReadingDimOpacity: 0.15,
  focusReadingHighlightStyle: 'spotlight',
  setFocusReadingActive: (active) => set({ focusReadingActive: active }),
  setFocusReadingStatus: (index, total) => set({ focusReadingParagraphIndex: index, focusReadingTotalParagraphs: total }),
  setFocusReadingDimOpacity: (opacity) => set({ focusReadingDimOpacity: opacity }),
  setFocusReadingHighlightStyle: (style) => set({ focusReadingHighlightStyle: style }),
}));
