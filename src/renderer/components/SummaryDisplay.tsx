import { useEffect, useRef } from 'react';
import { useAppStore } from '../store/appStore';
import { useTTS } from '../hooks/useTTS';
import { TTS_CONFIG } from '@shared/constants';
import '../styles/SummaryDisplay.css';

export function SummaryDisplay() {
  const { currentSummary, currentUrl } = useAppStore();
  const { speak, stop, isSupported } = useTTS();
  const previousSummaryRef = useRef<typeof currentSummary>(null);

  // Auto-read summary when it changes (if enabled)
  useEffect(() => {
    if (!TTS_CONFIG.AUTO_READ_SUMMARIES || !isSupported || !currentSummary) {
      return;
    }

    // Only speak if summary is new (different from previous)
    if (previousSummaryRef.current !== currentSummary) {
      previousSummaryRef.current = currentSummary;
      
      // Compose speech text
      const speechText = `Summary: ${currentSummary.purpose}`;
      
      // Speak after a short delay to avoid overlapping with other announcements
      const timer = setTimeout(() => {
        speak(speechText);
      }, 500);

      return () => {
        clearTimeout(timer);
        stop();
      };
    }
  }, [currentSummary, speak, stop, isSupported]);

  if (!currentSummary) {
    return null;
  }

  return (
    <div
      className="summary-display"
      role="region"
      aria-label="Website summary"
      aria-live="polite"
    >
      <h2 className="summary-title">Website Summary</h2>

      <div className="summary-section">
        <h3 className="summary-section-title">Purpose</h3>
        <p className="summary-content">{currentSummary.purpose}</p>
      </div>
    </div>
  );
}
