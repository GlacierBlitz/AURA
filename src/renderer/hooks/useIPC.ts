import { useEffect } from 'react';
import { useAppStore } from '../store/appStore';

/**
 * Hook that sets up IPC listeners and provides methods to send messages
 */
export function useIPC() {
  const {
    setPipelineStatus,
    setCurrentSummary,
    setCurrentUrl,
    addMessage,
    setError,
    setPendingConfirmation,
    setVoiceInputMode,
  } = useAppStore();

  useEffect(() => {
    // Set up all IPC listeners
    const unsubscribeSummary = window.electronAPI.onPipelineSummary((payload) => {
      setCurrentSummary(payload.summary, payload.url);
    });

    const unsubscribeStatus = window.electronAPI.onPipelineStatus((payload) => {
      setPipelineStatus(payload.status);
    });

    const unsubscribeMessage = window.electronAPI.onPipelineMessage((payload) => {
      addMessage(payload.message);
    });

    const unsubscribeError = window.electronAPI.onPipelineError((payload) => {
      setError(payload.error);
    });

    const unsubscribeNavigation = window.electronAPI.onPipelineNavigation((payload) => {
      setCurrentUrl(payload.url);
    });

    const unsubscribeConfirm = window.electronAPI.onConfirmRequest((payload) => {
      setPendingConfirmation({
        action: payload.action,
        reason: payload.reason,
      });
    });

    const unsubscribeVoiceMode = window.electronAPI.onSetVoiceMode((payload) => {
      console.log('Voice mode changed via IPC:', payload.mode);
      setVoiceInputMode(payload.mode);
    });

    // Clean up listeners on unmount
    return () => {
      unsubscribeSummary();
      unsubscribeStatus();
      unsubscribeMessage();
      unsubscribeError();
      unsubscribeNavigation();
      unsubscribeConfirm();
      unsubscribeVoiceMode();
    };
  }, [setPipelineStatus, setCurrentSummary, setCurrentUrl, addMessage, setError, setPendingConfirmation, setVoiceInputMode]);

  // Return methods to send messages to main process
  return {
    submitInstruction: (text: string) => {
      window.electronAPI.submitInstruction({ text });
    },
    sendConfirmResponse: (decision: 'confirm' | 'cancel' | 'modify') => {
      window.electronAPI.sendConfirmResponse({ decision });
      setPendingConfirmation(null);
    },
    queryLog: (filter?: unknown) => {
      window.electronAPI.queryLog({ filter });
    },
  };
}
