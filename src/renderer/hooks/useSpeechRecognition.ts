import { useState, useCallback, useRef } from 'react';

interface UseSpeechRecognitionReturn {
  isListening: boolean;
  transcript: string;
  startListening: () => void;
  stopListening: () => void;
  resetTranscript: () => void;
  isSupported: boolean;
  error: string | null;
}

/**
 * Custom hook for Speech Recognition using OpenAI Whisper API
 * Records audio and transcribes via Whisper for better accuracy and reliability
 */
export function useSpeechRecognition(): UseSpeechRecognitionReturn {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Check if MediaRecorder API is supported
  const isSupported = typeof window !== 'undefined' && 'MediaRecorder' in window;

  // Start recording audio
  const startListening = useCallback(async () => {
    if (!isSupported) {
      setError('Audio recording is not supported in this browser');
      return;
    }

    try {
      setError(null);
      audioChunksRef.current = [];

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          channelCount: 1,
          sampleRate: 16000, // Whisper works best with 16kHz
        } 
      });

      // Create MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      });

      mediaRecorderRef.current = mediaRecorder;

      // Collect audio chunks
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      // When recording stops, send to Whisper API
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        
        // Stop all tracks to release microphone
        stream.getTracks().forEach(track => track.stop());

        // Send to main process for transcription
        try {
          console.log('Sending audio to Whisper API, size:', audioBlob.size);
          const arrayBuffer = await audioBlob.arrayBuffer();
          const audioData = new Uint8Array(arrayBuffer);
          
          if (window.electronAPI?.transcribeAudio) {
            const result = await window.electronAPI.transcribeAudio({ 
              audioData: Array.from(audioData),
              mimeType: 'audio/webm',
            });
            
            if (result.text) {
              setTranscript(result.text);
            } else if (result.error) {
              setError(result.error);
            }
          } else {
            setError('Transcription API not available');
          }
        } catch (err) {
          console.error('Transcription error:', err);
          setError('Failed to transcribe audio');
        }
      };

      // Start recording
      mediaRecorder.start();
      setIsListening(true);
      console.log('Started recording audio for Whisper');
    } catch (err: any) {
      console.error('Failed to start recording:', err);
      if (err.name === 'NotAllowedError') {
        setError('Microphone access denied. Please grant permission.');
      } else if (err.name === 'NotFoundError') {
        setError('No microphone found. Please check your audio devices.');
      } else {
        setError('Failed to start recording: ' + err.message);
      }
      setIsListening(false);
    }
  }, [isSupported]);

  // Stop recording
  const stopListening = useCallback(() => {
    if (mediaRecorderRef.current && isListening) {
      mediaRecorderRef.current.stop();
      setIsListening(false);
      console.log('Stopped recording audio');
    }
  }, [isListening]);

  // Reset transcript
  const resetTranscript = useCallback(() => {
    setTranscript('');
    setError(null);
  }, []);

  return {
    isListening,
    transcript,
    startListening,
    stopListening,
    resetTranscript,
    isSupported,
    error,
  };
}
