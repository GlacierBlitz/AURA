import { useState, useEffect, useCallback } from 'react';
import { 
  AccessibilitySettings, 
  AccessibilityProfile,
  ColorFilter,
  DEFAULT_ACCESSIBILITY_SETTINGS,
  ACCESSIBILITY_PROFILES 
} from '@shared/types/accessibility';
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
      console.log('Applying settings:', newSettings);
      // Save to localStorage
      localStorage.setItem('accessibility-settings', JSON.stringify(newSettings));
      
      // Send to main process to apply to BrowserView
      if (window.electronAPI && window.electronAPI.updateAccessibility) {
        console.log('Sending to electron API');
        window.electronAPI.updateAccessibility(newSettings);
      } else {
        console.warn('electronAPI or updateAccessibility not available');
      }
    } catch (error) {
      console.error('Error applying accessibility settings:', error);
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
        </div>
      </div>
    </div>
  );
}
