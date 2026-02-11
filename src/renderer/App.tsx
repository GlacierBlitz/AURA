import { useState, useEffect, useCallback } from 'react';
import { NavigationBar } from './components/NavigationBar';
import { ChatPanel } from './components/ChatPanel';
import { SummaryDisplay } from './components/SummaryDisplay';
import { SettingsPanel } from './components/SettingsPanel';
import { AccessibilityPanel } from './components/AccessibilityPanel';
import { useIPC } from './hooks/useIPC';
import { useSpeechRecognition } from './hooks/useSpeechRecognition';
import { useTTS } from './hooks/useTTS';
import { DEFAULT_ACCESSIBILITY_SETTINGS } from '@shared/types/accessibility';
import type { AccessibilitySettings } from '@shared/types/accessibility';
import './styles/global.css';

export function App() {
  const [showSettings, setShowSettings] = useState(false);
  const [showChatPanel, setShowChatPanel] = useState(true);
  const [showAccessibility, setShowAccessibility] = useState(false);

  // Initialize IPC listeners
  useIPC();

  // Initialize speech recognition for global keyboard controls
  const speechRecognition = useSpeechRecognition();

  // Initialize TTS for reading page content
  const tts = useTTS();

  // Listen for read content events from main process
  useEffect(() => {
    if (!window.electronAPI?.onReadContent) {
      return;
    }

    const unsubscribe = window.electronAPI.onReadContent((payload) => {
      console.log('Received read content request:', payload.content);
      tts.speak(payload.content);
    });

    return () => {
      unsubscribe();
    };
  }, [tts]);

  // Listen for stop reading events from main process
  useEffect(() => {
    if (!window.electronAPI?.onStopReading) {
      return;
    }

    const unsubscribe = window.electronAPI.onStopReading(() => {
      console.log('Received stop reading request');
      tts.stop();
    });

    return () => {
      unsubscribe();
    };
  }, [tts]);

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

  useEffect(() => {
    if (!window.electronAPI?.onOpenAccessibilityPanel) {
      return;
    }

    const unsubscribe = window.electronAPI.onOpenAccessibilityPanel(() => {
      setShowAccessibility(true);
    });

    return () => {
      unsubscribe();
    };
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

  // Handle keyboard shortcuts for voice recording
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Only allow voice recording when chat panel is visible
    if (!showChatPanel) return;
    
    // Check if user is typing in an input field
    const target = e.target as HTMLElement;
    const isInputField = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
    
    // Spacebar: Push-to-talk (only when not in input fields)
    if (e.code === 'Space' && !isInputField && !e.repeat) {
      e.preventDefault();
      if (!speechRecognition.isListening) {
        speechRecognition.startListening();
      }
      return;
    }
  }, [speechRecognition, showChatPanel]);

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    // Only allow voice recording when chat panel is visible
    if (!showChatPanel) return;
    
    // Check if user is typing in an input field
    const target = e.target as HTMLElement;
    const isInputField = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
    
    // Spacebar release: Stop push-to-talk (only when not in input fields)
    if (e.code === 'Space' && !isInputField) {
      e.preventDefault();
      if (speechRecognition.isListening) {
        speechRecognition.stopListening();
      }
      return;
    }
  }, [speechRecognition, showChatPanel]);

  // Add global keyboard event listeners for voice controls
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);

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
              <ChatPanel speechRecognition={speechRecognition} />
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
