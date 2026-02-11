import { useCallback, useEffect, useState } from 'react';
import { useTTS } from './useTTS';
import type { PageContentPayload } from '@shared/types';

interface UseReadPageReturn {
  readPage: () => void;
  isReading: boolean;
  stopReading: () => void;
  currentPageTitle?: string;
}

/**
 * Custom hook for reading page content aloud
 * Handles communication with main process to extract page content
 * and uses TTS to read it to the user
 */
export function useReadPage(): UseReadPageReturn {
  const [currentPageTitle, setCurrentPageTitle] = useState<string>();
  const { speak, stop, isSpeaking: ttsIsSpeaking, isSupported: isTTSSupported } = useTTS();

  // Listen for page content ready
  useEffect(() => {
    if (!window.electronAPI?.onPageContentReady) {
      return;
    }

    const unsubscribe = window.electronAPI.onPageContentReady((payload: PageContentPayload) => {
      console.log('Page content received:', {
        title: payload.title,
        textLength: payload.text.length,
      });

      setCurrentPageTitle(payload.title);

      // Compose the speech text with a brief introduction
      const speechText = `${payload.title}. ${payload.text}`;

      // Speak the content
      speak(speechText);
    });

    return () => {
      unsubscribe();
    };
  }, [speak]);

  // Request page content to be read
  const readPage = useCallback(() => {
    if (!isTTSSupported) {
      console.warn('Text-to-speech not supported');
      return;
    }

    if (!window.electronAPI?.readPage) {
      console.error('readPage API not available');
      return;
    }

    console.log('Requesting page content for reading');
    window.electronAPI.readPage().catch((error) => {
      console.error('Error reading page:', error);
    });
  }, [isTTSSupported]);

  // Stop reading
  const stopReading = useCallback(() => {
    stop();
  }, [stop]);

  return {
    readPage,
    isReading: ttsIsSpeaking,
    stopReading,
    currentPageTitle,
  };
}
