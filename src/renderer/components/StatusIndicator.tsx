import { useAppStore } from '../store/appStore';
import '../styles/StatusIndicator.css';

export function StatusIndicator() {
  const { pipelineStatus } = useAppStore();

  const statusLabels = {
    idle: 'Ready',
    extracting: 'Analyzing page...',
    processing: 'Processing request...',
    executing: 'Executing actions...',
    error: 'Error occurred',
  };

  const isLoading = pipelineStatus === 'processing' || pipelineStatus === 'executing' || pipelineStatus === 'extracting';

  return (
    <div
      className={`status-indicator ${pipelineStatus} ${isLoading ? 'loading' : ''}`}
      role="status"
      aria-live="polite"
      aria-label={`Status: ${statusLabels[pipelineStatus]}`}
    >
      {isLoading ? (
        <div className="status-spinner" aria-hidden="true">
          <div className="spinner-ring" />
        </div>
      ) : (
        <div className="status-dot" aria-hidden="true" />
      )}
      <span className="status-text">{statusLabels[pipelineStatus]}</span>
    </div>
  );
}
