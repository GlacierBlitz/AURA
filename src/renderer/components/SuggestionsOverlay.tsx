import { useEffect, useState } from 'react';
import '../styles/SuggestionsOverlay.css';

export function SuggestionsOverlay() {
  const [suggestions, setSuggestions] = useState<string[]>([]);

  useEffect(() => {
    if (!window.electronAPI?.onUpdateSuggestions) return;

    // Listen for suggestions updates from main process
    const unsubscribe = window.electronAPI.onUpdateSuggestions((suggestions: string[]) => {
      console.log('[SuggestionsOverlay] Received suggestions:', suggestions);
      setSuggestions(suggestions);
    });

    return unsubscribe;
  }, []);

  const handleSuggestionClick = (suggestion: string) => {
    console.log('[SuggestionsOverlay] Suggestion clicked:', suggestion);
    // Send the selected suggestion back to the main window
    if (window.electronAPI?.sendSuggestionSelected) {
      window.electronAPI.sendSuggestionSelected(suggestion);
    }
  };

  if (suggestions.length === 0) {
    return null;
  }

  return (
    <div className="suggestions-overlay-container">
      {suggestions.map((suggestion, index) => (
        <div
          key={index}
          className="suggestion-item"
          onClick={() => handleSuggestionClick(suggestion)}
          onMouseDown={(e) => {
            // Prevent any blur events
            e.preventDefault();
          }}
        >
          <span className="suggestion-icon">🔍</span>
          <span className="suggestion-text">{suggestion}</span>
        </div>
      ))}
    </div>
  );
}
