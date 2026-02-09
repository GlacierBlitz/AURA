import { useState, useEffect, useCallback } from 'react';

interface TTSVoice {
  voice: SpeechSynthesisVoice;
  name: string;
  lang: string;
}

interface UseTTSReturn {
  speak: (text: string) => void;
  stop: () => void;
  pause: () => void;
  resume: () => void;
  getVoices: () => TTSVoice[];
  setVoice: (voice: SpeechSynthesisVoice) => void;
  selectedVoice: SpeechSynthesisVoice | null;
  isSpeaking: boolean;
  isPaused: boolean;
  isSupported: boolean;
}

/**
 * Custom hook for Text-to-Speech using Web Speech API
 * Provides accessible speech output for summaries and messages
 */
export function useTTS(): UseTTSReturn {
  const [selectedVoice, setSelectedVoiceState] = useState<SpeechSynthesisVoice | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  // Check if Web Speech API is supported
  const isSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  // Load available voices
  useEffect(() => {
    if (!isSupported) return;

    const loadVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      setVoices(availableVoices);

      // Auto-select a good default voice (prefer English, high quality)
      if (!selectedVoice && availableVoices.length > 0) {
        const englishVoice = availableVoices.find((v) => v.lang.startsWith('en'));
        setSelectedVoiceState(englishVoice || availableVoices[0]);
      }
    };

    loadVoices();

    // Voices may load asynchronously
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }

    return () => {
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, [isSupported, selectedVoice]);

  // Track speaking state
  useEffect(() => {
    if (!isSupported) return;

    const updateState = () => {
      setIsSpeaking(window.speechSynthesis.speaking);
      setIsPaused(window.speechSynthesis.paused);
    };

    const interval = setInterval(updateState, 100);
    return () => clearInterval(interval);
  }, [isSupported]);

  /**
   * Speak text using selected voice
   */
  const speak = useCallback(
    (text: string) => {
      if (!isSupported || !text) return;

      // Cancel any ongoing speech
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);

      // Apply selected voice
      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }

      // Configure speech parameters
      utterance.rate = 1.0; // Normal speed
      utterance.pitch = 1.0; // Normal pitch
      utterance.volume = 1.0; // Full volume

      // Event handlers
      utterance.onstart = () => {
        setIsSpeaking(true);
        setIsPaused(false);
      };

      utterance.onend = () => {
        setIsSpeaking(false);
        setIsPaused(false);
      };

      utterance.onerror = (event) => {
        console.error('TTS error:', event);
        setIsSpeaking(false);
        setIsPaused(false);
      };

      window.speechSynthesis.speak(utterance);
    },
    [isSupported, selectedVoice]
  );

  /**
   * Stop speaking immediately
   */
  const stop = useCallback(() => {
    if (!isSupported) return;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setIsPaused(false);
  }, [isSupported]);

  /**
   * Pause speaking
   */
  const pause = useCallback(() => {
    if (!isSupported) return;
    window.speechSynthesis.pause();
    setIsPaused(true);
  }, [isSupported]);

  /**
   * Resume speaking
   */
  const resume = useCallback(() => {
    if (!isSupported) return;
    window.speechSynthesis.resume();
    setIsPaused(false);
  }, [isSupported]);

  /**
   * Get all available voices with metadata
   */
  const getVoices = useCallback((): TTSVoice[] => {
    return voices.map((voice) => ({
      voice,
      name: voice.name,
      lang: voice.lang,
    }));
  }, [voices]);

  /**
   * Set the voice to use for speech
   */
  const setVoice = useCallback((voice: SpeechSynthesisVoice) => {
    setSelectedVoiceState(voice);
    // TODO: Persist to localStorage or Electron userData in Phase 2
  }, []);

  return {
    speak,
    stop,
    pause,
    resume,
    getVoices,
    setVoice,
    selectedVoice,
    isSpeaking,
    isPaused,
    isSupported,
  };
}
