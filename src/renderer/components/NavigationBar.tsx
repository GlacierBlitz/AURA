import { useState, useRef, useEffect } from 'react';
import { useAutocomplete } from '../hooks/useAutocomplete';
import '../styles/NavigationBar.css';

interface NavigationBarProps {
  onNavigate?: (url: string) => void;
  onToggleChat?: () => void;
  showChat?: boolean;
  onOpenAccessibility?: () => void;
}

export function NavigationBar({ onNavigate, onToggleChat, showChat, onOpenAccessibility }: NavigationBarProps) {
  const [url, setUrl] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const { suggestions, fetchSuggestions, clearSuggestions } = useAutocomplete();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Handle clicks outside to close suggestions
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Notify main process when input is focused/blurred (hide BrowserView on focus)
  const handleInputFocus = () => {
    console.log('[NavigationBar] Input focused - hiding BrowserView');
    if (window.electronAPI) {
      window.electronAPI.invoke('USER_SET_SUGGESTIONS_VISIBLE', {
        visible: true,  // true = hide BrowserView
      }).catch((err) => {
        console.error('[NavigationBar] Failed to hide BrowserView on focus:', err);
      });
    }
  };

  const handleInputBlur = () => {
    console.log('[NavigationBar] Input blurred - showing BrowserView');
    if (window.electronAPI) {
      window.electronAPI.invoke('USER_SET_SUGGESTIONS_VISIBLE', {
        visible: false,  // false = show BrowserView
      }).catch((err) => {
        console.error('[NavigationBar] Failed to show BrowserView on blur:', err);
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim() && onNavigate) {
      let finalUrl = url.trim();
      
      // Check if input is a URL or a search query
      const isUrl = isUrlFormat(finalUrl);
      
      if (isUrl) {
        // It's a URL - navigate directly
        finalUrl = finalUrl.includes('://') ? finalUrl : `https://${finalUrl}`;
      } else {
        // It's a search query - perform Google search
        finalUrl = `https://www.google.com/search?q=${encodeURIComponent(finalUrl)}`;
      }
      
      onNavigate(finalUrl);
      setUrl(finalUrl);
      setShowSuggestions(false);
    }
  };

  /**
   * Detect if input looks like a URL or a search query
   */
  const isUrlFormat = (input: string): boolean => {
    // Already has protocol
    if (input.includes('://')) return true;
    
    // Looks like a domain (has . and no spaces)
    if (input.includes('.') && !input.includes(' ')) return true;
    
    // Localhost
    if (input.startsWith('localhost')) return true;
    
    // Has more than 2 words = likely search query
    if (input.split(' ').length > 1) return false;
    
    // Single word without dots = search query
    return false;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setUrl(value);
    
    if (value.trim()) {
      setShowSuggestions(true);
      fetchSuggestions(value);
    } else {
      clearSuggestions();
      setShowSuggestions(false);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    console.log('[NavigationBar] Suggestion selected:', suggestion);
    setUrl(suggestion);
    setShowSuggestions(false);
    
    if (onNavigate) {
      let finalUrl = suggestion.trim();
      
      // Check if it's a URL or search query
      const isUrl = isUrlFormat(finalUrl);
      
      if (isUrl) {
        finalUrl = finalUrl.includes('://') ? finalUrl : `https://${finalUrl}`;
      } else {
        finalUrl = `https://www.google.com/search?q=${encodeURIComponent(finalUrl)}`;
      }
      
      console.log('[NavigationBar] Navigating to:', finalUrl);
      onNavigate(finalUrl);
    }
  };

  const handleBack = () => {
    if (window.electronAPI) {
      window.electronAPI.goBack?.();
    }
  };

  const handleForward = () => {
    if (window.electronAPI) {
      window.electronAPI.goForward?.();
    }
  };

  const handleRefresh = () => {
    if (window.electronAPI) {
      window.electronAPI.refresh?.();
    }
  };

  return (
    <nav className="navigation-bar" role="navigation" aria-label="Website navigation">
      <div className="nav-controls">
        <button
          className="nav-control-button"
          onClick={handleBack}
          aria-label="Go back"
          title="Go back"
        >
          ←
        </button>
        <button
          className="nav-control-button"
          onClick={handleForward}
          aria-label="Go forward"
          title="Go forward"
        >
          →
        </button>
        <button
          className="nav-control-button"
          onClick={handleRefresh}
          aria-label="Refresh page"
          title="Refresh page"
        >
          ⟳
        </button>
      </div>
      <form onSubmit={handleSubmit} className="url-form">
        <label htmlFor="url-input" className="sr-only">
          Enter website URL
        </label>
        <div className="url-input-container" ref={containerRef}>
          <input
            ref={inputRef}
            id="url-input"
            type="text"
            className="url-input"
            placeholder="Enter website URL or search..."
            value={url}
            onChange={handleInputChange}
            onFocus={handleInputFocus}
            onBlur={handleInputBlur}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setShowSuggestions(false);
              }
            }}
            aria-label="Website URL"
            aria-autocomplete="list"
            aria-controls={showSuggestions ? "url-suggestions" : undefined}
          />
          {showSuggestions && suggestions.length > 0 && (
            <div 
              id="url-suggestions"
              className="url-suggestions-dropdown"
              role="listbox"
              aria-label="Search suggestions"
            >
              {suggestions.map((suggestion, index) => (
                <div
                  key={index}
                  className="url-suggestion-item"
                  onClick={() => handleSuggestionClick(suggestion)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleSuggestionClick(suggestion);
                    }
                  }}
                  role="option"
                  tabIndex={0}
                >
                  <span className="suggestion-icon">🔍</span>
                  <span className="suggestion-text">{suggestion}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </form>
      {onOpenAccessibility && (
        <button
          className="accessibility-nav-button"
          onClick={onOpenAccessibility}
          aria-label="Open accessibility settings"
          title="Accessibility"
        >
          ♿
        </button>
      )}
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
