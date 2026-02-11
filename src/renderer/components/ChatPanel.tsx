import { useEffect, useCallback, useRef } from 'react';
import { useAppStore } from '../store/appStore';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { StatusIndicator } from './StatusIndicator';
import '../styles/ChatPanel.css';

export function ChatPanel() {
  const { messages, inputText, setInputText, pipelineStatus, addMessage } = useAppStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const {
    isListening,
    transcript,
    startListening,
    stopListening,
    resetTranscript,
    isSupported: isSpeechSupported,
    error: speechError,
  } = useSpeechRecognition();

  // Auto-scroll to latest message
  const scrollToBottom = useCallback(() => {
    // Use setTimeout to ensure DOM has updated
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, pipelineStatus, scrollToBottom]);

  // Submit instruction directly via electronAPI (don't call useIPC here - it's already in App.tsx)
  const submitInstruction = useCallback((text: string) => {
    // Add user message to chat
    const userMessage = {
      id: `user-${Date.now()}`,
      role: 'user' as const,
      content: text,
      timestamp: new Date().toISOString(),
    };
    addMessage(userMessage);
    
    // Send to main process
    window.electronAPI.submitInstruction({ text });
  }, [addMessage]);

  // Auto-submit when transcript is received from voice recognition
  useEffect(() => {
    if (transcript && !isListening && pipelineStatus !== 'executing') {
      // Transcript is complete (user stopped speaking), auto-submit
      submitInstruction(transcript);
      resetTranscript();
      setInputText('');
    }
  }, [transcript, isListening, pipelineStatus, resetTranscript, setInputText, submitInstruction]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputText.trim() && pipelineStatus !== 'executing') {
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

  const isExecuting = pipelineStatus === 'executing';
  const isProcessing = pipelineStatus === 'processing' || pipelineStatus === 'extracting' || pipelineStatus === 'executing';

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
        {isProcessing && (
          <div className="chat-message chat-message-processing" role="status" aria-label="Processing request">
            <div className="processing-indicator">
              <div className="processing-dot" />
              <div className="processing-dot" />
              <div className="processing-dot" />
            </div>
            <span className="processing-text">Processing...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
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
            rows={1}
            aria-label="Chat input"
          />
          {isSpeechSupported && (
            <button
              type="button"
              className={`voice-input-button ${isListening ? 'listening' : ''}`}
              onClick={handleVoiceToggle}
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
          <button
            type="submit"
            className="chat-send-button"
            disabled={isExecuting || !inputText.trim()}
            aria-label="Send message"
            title={isExecuting ? 'Executing...' : 'Send message'}
          >
            {isExecuting ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            )}
          </button>
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
      </form>
    </div>
  );
}
