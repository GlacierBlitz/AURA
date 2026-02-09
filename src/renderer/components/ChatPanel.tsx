import { useAppStore } from '../store/appStore';
import { useIPC } from '../hooks/useIPC';
import { StatusIndicator } from './StatusIndicator';
import '../styles/ChatPanel.css';

export function ChatPanel() {
  const { messages, inputText, setInputText, pipelineStatus } = useAppStore();
  const { submitInstruction } = useIPC();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputText.trim() && pipelineStatus !== 'processing' && pipelineStatus !== 'executing') {
      submitInstruction(inputText);
      setInputText('');
    }
  };

  const isProcessing = pipelineStatus === 'processing' || pipelineStatus === 'executing';

  return (
    <div className="chat-panel" role="region" aria-label="Chat interface">
      <div className="chat-header">
        <h1 className="chat-title">BeyondBinary Assistant</h1>
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
              className={`chat-message chat-message-${message.role}`}
              role="article"
              aria-label={`${message.role} message`}
            >
              <div className="message-role">{message.role === 'user' ? 'You' : 'Assistant'}</div>
              <div className="message-content">{message.content}</div>
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
