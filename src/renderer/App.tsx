import { useState } from 'react';
import { NavigationBar } from './components/NavigationBar';
import { ChatPanel } from './components/ChatPanel';
import { SummaryDisplay } from './components/SummaryDisplay';
import { SettingsPanel } from './components/SettingsPanel';
import { useIPC } from './hooks/useIPC';
import './styles/global.css';

export function App() {
  const [showSettings, setShowSettings] = useState(false);

  // Initialize IPC listeners
  useIPC();

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

  return (
    <div className="app-container">
      <NavigationBar onNavigate={handleNavigate} />
      
      <div className="app-main">
        <div className="content-area">
          {/* Chat panel on the right */}
          <div className="chat-area">
            <div className="settings-button-container">
              <button
                className="settings-button"
                onClick={() => setShowSettings(true)}
                aria-label="Open settings"
              >
                ⚙️ Settings
              </button>
            </div>
            <SummaryDisplay />
            <ChatPanel />
          </div>
        </div>
      </div>

      {showSettings && (
        <SettingsPanel
          onClose={() => setShowSettings(false)}
          onSaveApiKey={handleSaveApiKey}
        />
      )}
    </div>
  );
}
