import { useState } from 'react';
import { useTTS } from '../hooks/useTTS';
import '../styles/SettingsPanel.css';

interface SettingsPanelProps {
  onClose: () => void;
  onSaveApiKey: (apiKey: string) => void;
}

export function SettingsPanel({ onClose, onSaveApiKey }: SettingsPanelProps) {
  const { getVoices, setVoice, selectedVoice, isSupported: ttsSupported } = useTTS();
  const [autoReadSummaries, setAutoReadSummaries] = useState(true);
  const [autoReadMessages, setAutoReadMessages] = useState(false);

  const voices = getVoices();

  const handleSave = () => {
    // Settings saved (TTS preferences only)
    onClose();
  };

  const handleVoiceChange = (voiceName: string) => {
    const voice = voices.find((v) => v.name === voiceName);
    if (voice) {
      setVoice(voice.voice);
    }
  };

  return (
    <div className="settings-overlay" role="dialog" aria-labelledby="settings-title" aria-modal="true">
      <div className="settings-panel">
        <div className="settings-header">
          <h2 id="settings-title">Settings</h2>
          <button
            className="close-button"
            onClick={onClose}
            aria-label="Close settings"
          >
            ✕
          </button>
        </div>

        <div className="settings-content">
          {/* LLM Provider Section - Info Only */}
          <section className="settings-section">
            <h3>LLM Provider</h3>
            <p className="info-text">
              Using OpenAI GPT-4o. API key is pre-configured for this demonstration.
            </p>
          </section>

          {/* TTS Section */}
          <section className="settings-section">
            <h3>Text-to-Speech</h3>

            {ttsSupported ? (
              <>
                <div className="form-group">
                  <label htmlFor="voice-select">Voice</label>
                  <select
                    id="voice-select"
                    value={selectedVoice?.name || ''}
                    onChange={(e) => handleVoiceChange(e.target.value)}
                    aria-label="Select TTS voice"
                  >
                    {voices.map((voice) => (
                      <option key={voice.name} value={voice.name}>
                        {voice.name} ({voice.lang})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={autoReadSummaries}
                      onChange={(e) => setAutoReadSummaries(e.target.checked)}
                      aria-label="Auto-read page summaries"
                    />
                    <span>Auto-read page summaries</span>
                  </label>
                </div>

                <div className="form-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={autoReadMessages}
                      onChange={(e) => setAutoReadMessages(e.target.checked)}
                      aria-label="Auto-read assistant messages"
                    />
                    <span>Auto-read assistant messages</span>
                  </label>
                </div>
              </>
            ) : (
              <p className="warning-text">
                Text-to-Speech is not supported in your browser.
              </p>
            )}
          </section>

          {/* Accessibility Section */}
          <section className="settings-section">
            <h3>Accessibility</h3>
            
            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  defaultChecked={true}
                  aria-label="Enable high contrast mode"
                />
                <span>High contrast mode</span>
              </label>
            </div>

            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  defaultChecked={true}
                  aria-label="Show focus indicators"
                />
                <span>Enhanced focus indicators</span>
              </label>
            </div>

            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  defaultChecked={false}
                  aria-label="Reduce motion"
                />
                <span>Reduce motion</span>
              </label>
            </div>
          </section>
        </div>

        <div className="settings-footer">
          <button className="button button-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="button button-primary" onClick={handleSave}>
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}
