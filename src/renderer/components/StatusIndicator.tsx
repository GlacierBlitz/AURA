import { useAppStore } from '../store/appStore';
import '../styles/StatusIndicator.css';

export function StatusIndicator() {
  const { pipelineStatus } = useAppStore();

  const statusLabels = {
    idle: 'Ready',
    extracting: 'Analyzing page...',
    processing: 'Extracting request...',
    executing: 'Performing action...',
    error: 'Error occurred',
  };

  const statusColors = {
    idle: 'green',
    extracting: 'blue',
    processing: 'blue',
    executing: 'orange',
    error: 'red',
  };

  return (
    <div
      className="status-indicator"
      role="status"
      aria-live="polite"
      aria-label={`Status: ${statusLabels[pipelineStatus]}`}
    >
      <div
        className="status-dot"
        style={{ backgroundColor: statusColors[pipelineStatus] }}
        aria-hidden="true"
      />
      <span className="status-text">{statusLabels[pipelineStatus]}</span>
    </div>
  );
}
