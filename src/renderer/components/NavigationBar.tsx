import { useState } from 'react';
import '../styles/NavigationBar.css';

interface NavigationBarProps {
  onNavigate?: (url: string) => void;
  onToggleChat?: () => void;
  showChat?: boolean;
}

export function NavigationBar({ onNavigate, onToggleChat, showChat }: NavigationBarProps) {
  const [url, setUrl] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim() && onNavigate) {
      // Add https:// if no protocol specified
      const finalUrl = url.includes('://') ? url : `https://${url}`;
      onNavigate(finalUrl);
      setUrl(finalUrl);
    }
  };

  return (
    <nav className="navigation-bar" role="navigation" aria-label="Website navigation">
      <form onSubmit={handleSubmit} className="url-form">
        <label htmlFor="url-input" className="sr-only">
          Enter website URL
        </label>
        <input
          id="url-input"
          type="text"
          className="url-input"
          placeholder="Enter website URL..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          aria-label="Website URL"
        />
      </form>
      {onToggleChat && (
        <button
          className="chat-toggle-nav-button"
          onClick={onToggleChat}
          aria-label={showChat ? "Hide chat panel" : "Show chat panel"}
          title={showChat ? "Hide chat panel" : "Show chat panel"}
        >
          {showChat ? '✕' : '💬'}
        </button>
      )}
    </nav>
  );
}
