import { useState } from 'react';
import '../styles/NavigationBar.css';

interface NavigationBarProps {
  onNavigate?: (url: string) => void;
}

export function NavigationBar({ onNavigate }: NavigationBarProps) {
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
        <button type="submit" className="nav-button" aria-label="Navigate to URL">
          Go
        </button>
      </form>
    </nav>
  );
}
