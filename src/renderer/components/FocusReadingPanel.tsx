import { useEffect, useCallback } from 'react';
import { useAppStore } from '../store/appStore';
import type { FocusHighlightStyle } from '@shared/types/accessibility';
import '../styles/FocusReadingPanel.css';

interface FocusReadingPanelProps {
  onClose: () => void;
}

export function FocusReadingPanel({ onClose }: FocusReadingPanelProps) {
  const {
    focusReadingActive,
    focusReadingParagraphIndex,
    focusReadingTotalParagraphs,
    focusReadingDimOpacity,
    focusReadingHighlightStyle,
    setFocusReadingActive,
    setFocusReadingStatus,
    setFocusReadingDimOpacity,
    setFocusReadingHighlightStyle,
  } = useAppStore();

  // Listen for status updates from main process
  useEffect(() => {
    if (!window.electronAPI?.onFocusReadingStatus) return;

    const unsubscribe = window.electronAPI.onFocusReadingStatus((status) => {
      setFocusReadingActive(status.active);
      setFocusReadingStatus(status.paragraphIndex, status.totalParagraphs);
    });

    return () => {
      unsubscribe();
    };
  }, [setFocusReadingActive, setFocusReadingStatus]);

  const handleToggle = useCallback(async () => {
    const newState = !focusReadingActive;
    try {
      await window.electronAPI?.toggleFocusReading?.({
        enabled: newState,
        settings: {
          enabled: newState,
          dimOpacity: focusReadingDimOpacity,
          highlightStyle: focusReadingHighlightStyle,
        },
      });
      setFocusReadingActive(newState);
    } catch (error) {
      console.error('Failed to toggle focus reading:', error);
    }
  }, [focusReadingActive, focusReadingDimOpacity, focusReadingHighlightStyle, setFocusReadingActive]);

  const handleNext = useCallback(async () => {
    try {
      await window.electronAPI?.focusReadingNext?.();
    } catch (error) {
      console.error('Failed to navigate next:', error);
    }
  }, []);

  const handlePrev = useCallback(async () => {
    try {
      await window.electronAPI?.focusReadingPrev?.();
    } catch (error) {
      console.error('Failed to navigate prev:', error);
    }
  }, []);

  const handleExit = useCallback(async () => {
    try {
      await window.electronAPI?.exitFocusReading?.();
      setFocusReadingActive(false);
      setFocusReadingStatus(0, 0);
    } catch (error) {
      console.error('Failed to exit focus reading:', error);
    }
  }, [setFocusReadingActive, setFocusReadingStatus]);

  const handleDimOpacityChange = useCallback(async (value: number) => {
    setFocusReadingDimOpacity(value);
    if (focusReadingActive) {
      try {
        await window.electronAPI?.updateFocusReadingSettings?.({
          settings: {
            enabled: true,
            dimOpacity: value,
            highlightStyle: focusReadingHighlightStyle,
          },
        });
      } catch (error) {
        console.error('Failed to update focus reading settings:', error);
      }
    }
  }, [focusReadingActive, focusReadingHighlightStyle, setFocusReadingDimOpacity]);

  const handleHighlightStyleChange = useCallback(async (style: FocusHighlightStyle) => {
    setFocusReadingHighlightStyle(style);
    if (focusReadingActive) {
      try {
        await window.electronAPI?.updateFocusReadingSettings?.({
          settings: {
            enabled: true,
            dimOpacity: focusReadingDimOpacity,
            highlightStyle: style,
          },
        });
      } catch (error) {
        console.error('Failed to update highlight style:', error);
      }
    }
  }, [focusReadingActive, focusReadingDimOpacity, setFocusReadingHighlightStyle]);

  const handleClose = useCallback(() => {
    // Just close the panel without exiting focus mode
    // User can still navigate with keyboard or reopen panel
    onClose();
  }, [onClose]);

  return (
    <div className="focus-reading-panel">
      <div className="focus-reading-panel-header">
        <h2>Focus Reading</h2>
        <button className="focus-reading-close-btn" onClick={handleClose} title="Close">
          ✕
        </button>
      </div>

      <div className="focus-reading-panel-body">
        <p className="focus-reading-description">
          Focus on one paragraph at a time. Click any paragraph to highlight it, 
          or use arrow keys to navigate. Press Escape to exit.
        </p>

        {/* Toggle Button */}
        <div className="focus-reading-toggle-section">
          <button
            className={`focus-reading-toggle-btn ${focusReadingActive ? 'active' : ''}`}
            onClick={handleToggle}
          >
            {focusReadingActive ? '⏸ Deactivate Focus Mode' : '▶ Activate Focus Mode'}
          </button>
        </div>

        {/* Navigation Controls (visible when active) */}
        {focusReadingActive && (
          <div className="focus-reading-nav-section">
            <div className="focus-reading-progress">
              <span className="focus-reading-progress-text">
                Paragraph {focusReadingParagraphIndex + 1} of {focusReadingTotalParagraphs}
              </span>
              <div className="focus-reading-progress-bar">
                <div
                  className="focus-reading-progress-fill"
                  style={{
                    width: focusReadingTotalParagraphs > 0
                      ? `${((focusReadingParagraphIndex + 1) / focusReadingTotalParagraphs) * 100}%`
                      : '0%',
                  }}
                />
              </div>
            </div>

            <div className="focus-reading-nav-buttons">
              <button
                className="focus-reading-nav-btn"
                onClick={handlePrev}
                disabled={focusReadingParagraphIndex <= 0}
                title="Previous paragraph (↑)"
              >
                ← Previous
              </button>
              <button
                className="focus-reading-nav-btn"
                onClick={handleNext}
                disabled={focusReadingParagraphIndex >= focusReadingTotalParagraphs - 1}
                title="Next paragraph (↓)"
              >
                Next →
              </button>
            </div>

            <button className="focus-reading-exit-btn" onClick={handleExit}>
              ✕ Exit Focus Mode
            </button>
          </div>
        )}

        {/* Settings */}
        <div className="focus-reading-settings">
          <h3>Settings</h3>

          <div className="focus-reading-setting-row">
            <label htmlFor="dim-opacity">Background Dimness</label>
            <div className="focus-reading-slider-container">
              <input
                id="dim-opacity"
                type="range"
                min="0.05"
                max="0.5"
                step="0.05"
                value={focusReadingDimOpacity}
                onChange={(e) => handleDimOpacityChange(parseFloat(e.target.value))}
              />
              <span className="focus-reading-slider-value">
                {Math.round((1 - focusReadingDimOpacity) * 100)}%
              </span>
            </div>
          </div>

          <div className="focus-reading-setting-row">
            <label>Highlight Style</label>
            <div className="focus-reading-style-options">
              {(['spotlight', 'underline', 'box'] as FocusHighlightStyle[]).map((style) => (
                <button
                  key={style}
                  className={`focus-reading-style-btn ${
                    focusReadingHighlightStyle === style ? 'selected' : ''
                  }`}
                  onClick={() => handleHighlightStyleChange(style)}
                >
                  {style === 'spotlight' && '💡 Spotlight'}
                  {style === 'underline' && '__ Underline'}
                  {style === 'box' && '▢ Box'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Keyboard shortcuts */}
        <div className="focus-reading-shortcuts">
          <h3>Keyboard Shortcuts</h3>
          <div className="focus-reading-shortcut-list">
            <div className="focus-reading-shortcut">
              <kbd>↑</kbd> / <kbd>↓</kbd>
              <span>Navigate paragraphs</span>
            </div>
            <div className="focus-reading-shortcut">
              <kbd>←</kbd> / <kbd>→</kbd>
              <span>Navigate paragraphs</span>
            </div>
            <div className="focus-reading-shortcut">
              <kbd>Esc</kbd>
              <span>Exit focus mode</span>
            </div>
            <div className="focus-reading-shortcut">
              <kbd>Click</kbd>
              <span>Focus a specific paragraph</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
