import { useEffect } from 'react';
import { useAppStore } from '../store/appStore';

/**
 * Hook that sets up IPC listeners and provides methods to send messages
 */
export function useIPC() {
  const {
    setPipelineStatus,
    setCurrentSummary,
    addMessage,
    setError,
    setPendingConfirmation,
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

    const unsubscribeConfirm = window.electronAPI.onConfirmRequest((payload) => {
      setPendingConfirmation({
        action: payload.action,
        reason: payload.reason,
      });
    });

    // Clean up listeners on unmount
    return () => {
      unsubscribeSummary();
      unsubscribeStatus();
      unsubscribeMessage();
      unsubscribeError();
      unsubscribeConfirm();
    };
  }, [setPipelineStatus, setCurrentSummary, addMessage, setError, setPendingConfirmation]);

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
