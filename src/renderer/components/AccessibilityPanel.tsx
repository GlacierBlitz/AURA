import { useState, useEffect, useCallback } from 'react';
import { 
  AccessibilitySettings, 
  AccessibilityProfile,
  ColorFilter,
  DEFAULT_ACCESSIBILITY_SETTINGS,
  ACCESSIBILITY_PROFILES 
} from '@shared/types/accessibility';
import { useAppStore } from '../store/appStore';
import '../styles/AccessibilityPanel.css';

interface AccessibilityPanelProps {
  onClose: () => void;
}

export function AccessibilityPanel({ onClose }: AccessibilityPanelProps) {
  const [settings, setSettings] = useState<AccessibilitySettings>(() => {
    // Load saved settings from localStorage
    const saved = localStorage.getItem('accessibility-settings');
    return saved ? JSON.parse(saved) : DEFAULT_ACCESSIBILITY_SETTINGS;
  });
  
  const { voiceInputMode, setVoiceInputMode } = useAppStore();
  const [isClearingCache, setIsClearingCache] = useState(false);

  console.log('AccessibilityPanel rendered', settings);

  // Hide BrowserView when panel is open, show it when closed
  useEffect(() => {
    console.log('AccessibilityPanel mounted, hiding BrowserView');
    window.electronAPI.setModalOpen?.({ isOpen: true });
    
    return () => {
      console.log('AccessibilityPanel unmounting, showing BrowserView');
      window.electronAPI.setModalOpen?.({ isOpen: false });
    };
  }, []);

  const applySettings = useCallback((newSettings: AccessibilitySettings) => {
    try {
      console.log('AccessibilityPanel: Applying settings:', newSettings);
      // Save to localStorage
      localStorage.setItem('accessibility-settings', JSON.stringify(newSettings));
      console.log('AccessibilityPanel: Saved to localStorage');
      
      // Send to main process to apply to BrowserView
      if (window.electronAPI && window.electronAPI.updateAccessibility) {
        console.log('AccessibilityPanel: Calling electronAPI.updateAccessibility');
        window.electronAPI.updateAccessibility(newSettings);
        console.log('AccessibilityPanel: Successfully called electronAPI.updateAccessibility');
      } else {
        console.error('AccessibilityPanel: electronAPI or updateAccessibility not available');
        console.error('AccessibilityPanel: electronAPI exists:', !!window.electronAPI);
        if (window.electronAPI) {
          console.error('AccessibilityPanel: updateAccessibility exists:', !!window.electronAPI.updateAccessibility);
        }
      }
    } catch (error) {
      console.error('AccessibilityPanel: Error applying accessibility settings:', error);
    }
  }, []);

  // Load settings on mount
  useEffect(() => {
    try {
      console.log('Loading accessibility settings from localStorage');
      const saved = localStorage.getItem('accessibility-settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        console.log('Loaded settings:', parsed);
        setSettings(parsed);
        applySettings(parsed);
      }
    } catch (error) {
      console.error('Error loading accessibility settings:', error);
    }
  }, [applySettings]);

  const handleProfileChange = (profile: AccessibilityProfile) => {
    console.log('Profile change clicked:', profile);
    const profileSettings = ACCESSIBILITY_PROFILES[profile];
    // Start from default settings to ensure clean slate, especially for 'default' profile
    const newSettings: AccessibilitySettings = {
      ...DEFAULT_ACCESSIBILITY_SETTINGS,
      ...profileSettings,
      profile,
    };
    console.log('New settings from profile:', newSettings);
    setSettings(newSettings);
    applySettings(newSettings);
  };

  const handleFontSizeChange = (fontSize: number) => {
    console.log('Font size change:', fontSize);
    const newSettings = { ...settings, fontSize, profile: 'custom' as AccessibilityProfile };
    setSettings(newSettings);
    applySettings(newSettings);
  };

  const handleLineSpacingChange = (lineSpacing: number) => {
    console.log('Line spacing change:', lineSpacing);
    const newSettings = { ...settings, lineSpacing, profile: 'custom' as AccessibilityProfile };
    setSettings(newSettings);
    applySettings(newSettings);
  };

  const handleHighContrastToggle = () => {
    console.log('High contrast toggle clicked');
    const newSettings = { ...settings, highContrast: !settings.highContrast, profile: 'custom' as AccessibilityProfile };
    setSettings(newSettings);
    applySettings(newSettings);
  };

  const handleColorFilterChange = (colorFilter: ColorFilter) => {
    console.log('Color filter change:', colorFilter);
    const newSettings = { ...settings, colorFilter, profile: 'custom' as AccessibilityProfile };
    setSettings(newSettings);
    applySettings(newSettings);
  };

  const handleSimplifyToggle = () => {
    console.log('Simplify toggle clicked');
    const newSettings = { ...settings, simplifyLayout: !settings.simplifyLayout, profile: 'custom' as AccessibilityProfile };
    setSettings(newSettings);
    applySettings(newSettings);
  };

  const handleClearCache = async () => {
    if (!window.confirm('Are you sure you want to clear all cached data? This will clear page summaries and LLM responses.')) {
      return;
    }

    setIsClearingCache(true);
    try {
      await window.electronAPI?.clearCache?.();
      alert('Cache cleared successfully!');
    } catch (error) {
      console.error('Failed to clear cache:', error);
      alert('Failed to clear cache. Please try again.');
    } finally {
      setIsClearingCache(false);
    }
  };

  return (
    <div className="accessibility-overlay" onClick={(e) => {
      console.log('Overlay clicked');
      onClose();
    }}>
      <div className="accessibility-panel" onClick={(e) => {
        console.log('Panel clicked - stopping propagation');
        e.stopPropagation();
      }}>
        <div className="accessibility-header">
          <h2>Accessibility Settings</h2>
          <button className="close-button" onClick={(e) => {
            console.log('Close button clicked');
            onClose();
          }} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="accessibility-content">
          {/* Preset Profiles */}
          <section className="accessibility-section">
            <h3>Preset Profiles</h3>
            <div className="profile-buttons">
              {Object.keys(ACCESSIBILITY_PROFILES).filter(p => p !== 'custom').map((profile) => (
                <button
                  key={profile}
                  className={`profile-button ${settings.profile === profile ? 'active' : ''}`}
                  onClick={() => handleProfileChange(profile as AccessibilityProfile)}
                >
                  {profile.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                </button>
              ))}
            </div>
          </section>

          {/* Font Size */}
          <section className="accessibility-section">
            <h3>Font Size</h3>
            <div className="control-group">
              <input
                type="range"
                min="75"
                max="200"
                step="5"
                value={settings.fontSize}
                onChange={(e) => handleFontSizeChange(Number(e.target.value))}
                className="slider"
              />
              <span className="value-label">{settings.fontSize}%</span>
            </div>
          </section>

          {/* Line Spacing */}
          <section className="accessibility-section">
            <h3>Line Spacing</h3>
            <div className="control-group">
              <input
                type="range"
                min="1.0"
                max="2.5"
                step="0.1"
                value={settings.lineSpacing}
                onChange={(e) => handleLineSpacingChange(Number(e.target.value))}
                className="slider"
              />
              <span className="value-label">{settings.lineSpacing.toFixed(1)}x</span>
            </div>
          </section>

          {/* High Contrast */}
          <section className="accessibility-section">
            <h3>High Contrast Mode</h3>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={settings.highContrast}
                onChange={handleHighContrastToggle}
              />
              <span className="toggle-slider"></span>
              <span className="toggle-label">{settings.highContrast ? 'On' : 'Off'}</span>
            </label>
          </section>

          {/* Color Filters */}
          <section className="accessibility-section">
            <h3>Color Filters</h3>
            <select
              value={settings.colorFilter}
              onChange={(e) => handleColorFilterChange(e.target.value as ColorFilter)}
              className="filter-select"
            >
              <option value="none">None</option>
              <option value="protanopia">Protanopia (Red-Blind)</option>
              <option value="deuteranopia">Deuteranopia (Green-Blind)</option>
              <option value="tritanopia">Tritanopia (Blue-Blind)</option>
              <option value="grayscale">Grayscale</option>
            </select>
          </section>

          {/* Simplify Layout */}
          <section className="accessibility-section">
            <h3>Simplify Page Layout</h3>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={settings.simplifyLayout}
                onChange={handleSimplifyToggle}
              />
              <span className="toggle-slider"></span>
              <span className="toggle-label">{settings.simplifyLayout ? 'On' : 'Off'}</span>
            </label>
          </section>

          {/* Voice Input Mode */}
          <section className="accessibility-section">
            <h3>Voice Input Mode</h3>
            <select
              value={voiceInputMode}
              onChange={(e) => setVoiceInputMode(e.target.value as 'push-to-talk' | 'toggle')}
              className="filter-select"
            >
              <option value="push-to-talk">Push to Talk (Hold Space)</option>
              <option value="toggle">Toggle On/Off (Press Space)</option>
            </select>
            <p style={{ marginTop: '8px', fontSize: '0.9em', opacity: 0.8 }}>
              {voiceInputMode === 'push-to-talk' 
                ? 'Hold the spacebar to record, release to stop.'
                : 'Press spacebar once to start recording, press again to stop.'}
            </p>
          </section>

          {/* Cache Management */}
          <section className="accessibility-section">
            <h3>Cache Management</h3>
            <p style={{ fontSize: '0.9em', opacity: 0.8, marginBottom: '12px' }}>
              Clear cached page summaries and LLM responses to get fresh results or free up space.
            </p>
            <button
              onClick={handleClearCache}
              disabled={isClearingCache}
              style={{
                padding: '10px 16px',
                backgroundColor: isClearingCache ? '#9ca3af' : '#dc2626',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: isClearingCache ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                width: '100%',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => {
                if (!isClearingCache) {
                  e.currentTarget.style.backgroundColor = '#b91c1c';
                }
              }}
              onMouseLeave={(e) => {
                if (!isClearingCache) {
                  e.currentTarget.style.backgroundColor = '#dc2626';
                }
              }}
            >
              {isClearingCache ? 'Clearing Cache...' : 'Clear All Cache'}
            </button>
          </section>

          {/* Cache Management */}
          <section className="accessibility-section">
            <h3>Cache Management</h3>
            <p style={{ fontSize: '0.9em', opacity: 0.8, marginBottom: '12px' }}>
              Clear cached page summaries and LLM responses to get fresh results or free up space.
            </p>
            <button
              onClick={handleClearCache}
              disabled={isClearingCache}
              style={{
                padding: '10px 16px',
                backgroundColor: isClearingCache ? '#9ca3af' : '#dc2626',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: isClearingCache ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                width: '100%',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => {
                if (!isClearingCache) {
                  e.currentTarget.style.backgroundColor = '#b91c1c';
                }
              }}
              onMouseLeave={(e) => {
                if (!isClearingCache) {
                  e.currentTarget.style.backgroundColor = '#dc2626';
                }
              }}
            >
              {isClearingCache ? 'Clearing Cache...' : 'Clear All Cache'}
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}
