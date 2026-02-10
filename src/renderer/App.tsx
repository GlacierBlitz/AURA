import { useState } from 'react';
import { NavigationBar } from './components/NavigationBar';
import { ChatPanel } from './components/ChatPanel';
import { SummaryDisplay } from './components/SummaryDisplay';
import { SettingsPanel } from './components/SettingsPanel';
import { useIPC } from './hooks/useIPC';
import './styles/global.css';

export function App() {
  const [showSettings, setShowSettings] = useState(false);
  const [showChatPanel, setShowChatPanel] = useState(true);

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

  const toggleChatPanel = () => {
    setShowChatPanel(!showChatPanel);
    // Notify main process to resize the BrowserView
    if (window.electronAPI) {
      window.electronAPI.toggleChatPanel?.({ visible: !showChatPanel });
    }
  };

  return (
    <div className="app-container">
      <NavigationBar onNavigate={handleNavigate} onToggleChat={toggleChatPanel} showChat={showChatPanel} />
      
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
    </div>
  );
}
