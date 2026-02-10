import { useState, useEffect } from 'react';
import { NavigationBar } from './components/NavigationBar';
import { ChatPanel } from './components/ChatPanel';
import { SummaryDisplay } from './components/SummaryDisplay';
import { SettingsPanel } from './components/SettingsPanel';
import { AccessibilityPanel } from './components/AccessibilityPanel';
import { useIPC } from './hooks/useIPC';
import { DEFAULT_ACCESSIBILITY_SETTINGS } from '@shared/types/accessibility';
import type { AccessibilitySettings } from '@shared/types/accessibility';
import './styles/global.css';

export function App() {
  const [showSettings, setShowSettings] = useState(false);
  const [showChatPanel, setShowChatPanel] = useState(true);
  const [showAccessibility, setShowAccessibility] = useState(false);

  // Initialize IPC listeners
  useIPC();

  // Load and apply saved accessibility settings on startup
  useEffect(() => {
    const saved = localStorage.getItem('accessibility-settings');
    if (saved) {
      try {
        const settings: AccessibilitySettings = JSON.parse(saved);
        console.log('Loading saved accessibility settings on startup:', settings);
        window.electronAPI?.updateAccessibility?.(settings);
      } catch (error) {
        console.error('Failed to load accessibility settings:', error);
      }
    }
  }, []);

  const handleNavigate = (url: string) => {
    if (window.electronAPI) {
      window.electronAPI.navigate({ url });
    }
  };

  const handleSaveApiKey = (apiKey: string) => {
    if (window.electronAPI) {
      window.electronAPI.saveApiKey({ apiKey, provider: 'openai' });
    }
  };

  const toggleChatPanel = () => {
    setShowChatPanel(!showChatPanel);
    // Notify main process to resize the BrowserView
    if (window.electronAPI) {
      window.electronAPI.toggleChatPanel?.({ visible: !showChatPanel });
    }
  };

  const handleOpenAccessibility = () => {
    console.log('Opening accessibility panel');
    setShowAccessibility(true);
  };

  return (
    <div className="app-container">
      <NavigationBar 
        onNavigate={handleNavigate} 
        onToggleChat={toggleChatPanel} 
        showChat={showChatPanel}
        onOpenAccessibility={handleOpenAccessibility}
      />
      
      <div className="app-main">
        <div className="content-area">
          {/* Chat panel on the right */}
          {showChatPanel && (
            <div className="chat-area">
              <SummaryDisplay />
              <ChatPanel />
            </div>
          )}
        </div>
      </div>

      {showSettings && (
        <SettingsPanel
          onClose={() => setShowSettings(false)}
          onSaveApiKey={handleSaveApiKey}
        />
      )}

      {showAccessibility && (
        <AccessibilityPanel
          onClose={() => setShowAccessibility(false)}
        />
      )}
    </div>
  );
}
