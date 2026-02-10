import { useEffect } from 'react';
import { useAppStore } from '../store/appStore';
import { useIPC } from '../hooks/useIPC';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { StatusIndicator } from './StatusIndicator';
import '../styles/ChatPanel.css';

export function ChatPanel() {
  const { messages, inputText, setInputText, pipelineStatus } = useAppStore();
  const { submitInstruction } = useIPC();
  const {
    isListening,
    transcript,
    startListening,
    stopListening,
    resetTranscript,
    isSupported: isSpeechSupported,
    error: speechError,
  } = useSpeechRecognition();

  // Update input text when transcript changes
  useEffect(() => {
    if (transcript) {
      setInputText(transcript);
    }
  }, [transcript, setInputText]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputText.trim() && pipelineStatus !== 'processing' && pipelineStatus !== 'executing') {
      submitInstruction(inputText);
      setInputText('');
      resetTranscript(); // Clear speech transcript after sending
    }
  };

  const handleVoiceToggle = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const isProcessing = pipelineStatus === 'processing' || pipelineStatus === 'executing';

  return (
    <div className="chat-panel" role="region" aria-label="Chat interface">
      <div className="chat-header">
        <h1 className="chat-title">AURA Assistant</h1>
        <StatusIndicator />
      </div>

      <div className="chat-messages" role="log" aria-label="Conversation history" aria-live="polite">
        {messages.length === 0 ? (
          <div className="chat-empty">
            <p>Ask me to interact with the website...</p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`chat-message chat-message-${message.role} ${message.actionResult ? 'chat-message-action' : ''}`}
              role="article"
              aria-label={`${message.role} message`}
            >
              <div className="message-role">{message.role === 'user' ? 'You' : 'Assistant'}</div>
              <div className="message-content">
                {message.content}
                {message.actionResult && (
                  <div className={`action-status action-status-${message.actionResult.status}`}>
                    {message.actionResult.status === 'success' ? '✓ Completed' : '✗ Failed'}
                  </div>
                )}
              </div>
              <div className="message-timestamp" aria-label="Time sent">
                {new Date(message.timestamp).toLocaleTimeString()}
              </div>
            </div>
          ))
        )}
      </div>

      <form className="chat-input-form" onSubmit={handleSubmit}>
        <label htmlFor="chat-input" className="sr-only">
          Enter your instruction
        </label>
        <div className="chat-input-container">
          <textarea
            id="chat-input"
            className="chat-input"
            placeholder="Tell me what to do..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            disabled={isProcessing}
            rows={3}
            aria-label="Chat input"
          />
          {isSpeechSupported && (
            <button
              type="button"
              className={`voice-input-button ${isListening ? 'listening' : ''}`}
              onClick={handleVoiceToggle}
              disabled={isProcessing}
              aria-label={isListening ? 'Stop voice input' : 'Start voice input'}
              title={isListening ? 'Stop recording' : 'Start voice input'}
            >
              {isListening ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="23" />
                  <line x1="8" y1="23" x2="16" y2="23" />
                </svg>
              )}
            </button>
          )}
        </div>
        {speechError && (
          <div className="voice-error" role="alert">
            {speechError}
          </div>
        )}
        {isListening && (
          <div className="voice-status" role="status" aria-live="polite">
            🎤 Listening... Speak now
          </div>
        )}
        <button
          type="submit"
          className="chat-send-button"
          disabled={isProcessing || !inputText.trim()}
          aria-label="Send message"
        >
          {isProcessing ? 'Processing...' : 'Send'}
        </button>
      </form>
    </div>
  );
}
