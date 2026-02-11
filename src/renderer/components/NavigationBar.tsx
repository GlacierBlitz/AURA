import { useState, useRef, useEffect } from 'react';
import '../styles/NavigationBar.css';
import { Settings, RotateCw, MoveLeft, MoveRight, X, Home } from 'lucide-react';
import { useAppStore } from '../store/appStore';



interface NavigationBarProps {
  onNavigate?: (url: string) => void;
  onToggleChat?: () => void;
  showChat?: boolean;
  onOpenAccessibility?: () => void;
}

export function NavigationBar({ onNavigate, onToggleChat, showChat, onOpenAccessibility }: NavigationBarProps) {
  const [url, setUrl] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const currentUrl = useAppStore((state) => state.currentUrl);

  // Keep inputRef for focusing when needed

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
  };

  useEffect(() => {
    if (!currentUrl) {
      return;
    }

    if (document.activeElement === inputRef.current) {
      return;
    }

    const isHomePage =
      currentUrl === 'app:home' ||
      (currentUrl.startsWith('file://') && currentUrl.includes('/assets/homepage.html'));

    if (isHomePage) {
      if (url !== '') {
        setUrl('');
      }
      return;
    }

    if (currentUrl !== url) {
      setUrl(currentUrl);
    }
  }, [currentUrl, url]);

  // suggestions removed — autocomplete disabled

  const handleBack = () => {
    if (window.electronAPI) {
      window.electronAPI.goBack?.();
    }
  };

  const handleHome = () => {
    // Prefer direct IPC helper if available to avoid sending a fake URL token
    if (window.electronAPI?.navigateHome) {
      window.electronAPI.navigateHome();
      return;
    }

    if (onNavigate) {
      onNavigate('app:home');
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
          className="accessibility-nav-button"
          onClick={handleBack}
          aria-label="Go back"
          title="Go back"
        >
          <MoveLeft color="black" strokeWidth={2} size={20}/>
        </button>
        <button
          className="accessibility-nav-button"
          onClick={handleForward}
          aria-label="Go forward"
          title="Go forward"
        >
          <MoveRight color="black" strokeWidth={2} size={20} />
        </button>
        <button
          className="accessibility-nav-button"
          onClick={handleRefresh}
          aria-label="Refresh page"
          title="Refresh page"
        >
          <RotateCw strokeWidth={2} size={20} />
        </button>
      </div>
      <form onSubmit={handleSubmit} className="url-form">
        <label htmlFor="url-input" className="sr-only">
          Enter website URL
        </label>
        <div className="url-input-container">
          <input
            ref={inputRef}
            id="url-input"
            type="text"
            className="url-input"
            placeholder="Enter website URL or search..."
            value={url}
            onChange={handleInputChange}
            aria-label="Website URL"
            aria-autocomplete="none"
          />
        </div>
      </form>
      <div className="nav-controls">
      <button
          className="accessibility-nav-button"
          onClick={handleHome}
          aria-label="Home"
          title="Home"
        >
          <Home color="black" strokeWidth={2} size={18} />
        </button>
      {onOpenAccessibility && (
        <button
          className="accessibility-nav-button"
          onClick={onOpenAccessibility}
          aria-label="Open accessibility settings"
          title="Accessibility"
        >
          <Settings color="black" strokeWidth={2} size={20}/>
        </button>
      )}
      {onToggleChat && (
        <button
          className="chat-toggle-nav-button"
          onClick={onToggleChat}
          aria-label={showChat ? "Hide chat panel" : "Show chat panel"}
          title={showChat ? "Hide chat panel" : "Show chat panel"}
        >
          {showChat ? <X color="black" strokeWidth={2} size={20}/> : '💬'}
        </button>
        
      )}
      </div>
    </nav>
  );
}
