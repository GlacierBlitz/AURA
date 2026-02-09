/**
 * ActionLogViewer - Display action history with filtering and export
 * 
 * PERSON 3 TODO:
 * 1. Fetch action log from main process via IPC
 * 2. Display as table/list with columns: timestamp, instruction, action type, status
 * 3. Add filters (date range, action type, status)
 * 4. Add export buttons (JSON, CSV)
 * 5. Make accessible with keyboard navigation
 * 6. Add pagination for large logs
 */

import React, { useState, useEffect } from 'react';
import '../styles/ActionLogViewer.css';

interface ActionLogEntry {
  id: number;
  timestamp: string;
  userInstruction: string;
  interpretedIntent: string;
  actionType: string;
  selector?: string;
  text?: string;
  url?: string;
  status: 'success' | 'failed' | 'cancelled';
  error?: string;
  executionTimeMs: number;
  sensitiveFieldRedacted: boolean;
}

interface ActionLogViewerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ActionLogViewer: React.FC<ActionLogViewerProps> = ({ isOpen, onClose }) => {
  const [logs, setLogs] = useState<ActionLogEntry[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterActionType, setFilterActionType] = useState<string>('all');

  useEffect(() => {
    if (isOpen) {
      fetchLogs();
    }
  }, [isOpen, filterStatus, filterActionType]);

  const fetchLogs = async () => {
    // TODO: Send IPC message to query logs
    // window.electron.ipcRenderer.send('pipeline:query-log', { status: filterStatus, actionType: filterActionType });
    // window.electron.ipcRenderer.once('pipeline:log-results', (data) => setLogs(data));
  };

  const handleExportJson = () => {
    // TODO: Send IPC to export as JSON
    // window.electron.ipcRenderer.send('pipeline:export-log', { format: 'json' });
  };

  const handleExportCsv = () => {
    // TODO: Send IPC to export as CSV
    // window.electron.ipcRenderer.send('pipeline:export-log', { format: 'csv' });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return '✓';
      case 'failed':
        return '✗';
      case 'cancelled':
        return '⊘';
      default:
        return '?';
    }
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'success':
        return 'status-success';
      case 'failed':
        return 'status-failed';
      case 'cancelled':
        return 'status-cancelled';
      default:
        return '';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="log-viewer-overlay" onClick={onClose}>
      <div className="log-viewer-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="log-viewer-header">
          <h2>Action History</h2>
          <button className="close-button" onClick={onClose} aria-label="Close log viewer">
            ×
          </button>
        </div>

        <div className="log-viewer-filters">
          <div className="filter-group">
            <label htmlFor="filter-status">Status:</label>
            <select
              id="filter-status"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="all">All</option>
              <option value="success">Success</option>
              <option value="failed">Failed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="filter-action-type">Action Type:</label>
            <select
              id="filter-action-type"
              value={filterActionType}
              onChange={(e) => setFilterActionType(e.target.value)}
            >
              <option value="all">All</option>
              <option value="CLICK">Click</option>
              <option value="TYPE">Type</option>
              <option value="SELECT">Select</option>
              <option value="SUBMIT">Submit</option>
              <option value="NAVIGATE">Navigate</option>
              <option value="SCROLL">Scroll</option>
            </select>
          </div>

          <div className="export-buttons">
            <button onClick={handleExportJson}>Export JSON</button>
            <button onClick={handleExportCsv}>Export CSV</button>
          </div>
        </div>

        <div className="log-viewer-content">
          {logs.length === 0 ? (
            <p className="no-logs">No actions logged yet.</p>
          ) : (
            <table className="log-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Instruction</th>
                  <th>Action</th>
                  <th>Status</th>
                  <th>Duration</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td className="log-timestamp">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="log-instruction">{log.userInstruction}</td>
                    <td className="log-action-type">{log.actionType}</td>
                    <td className={`log-status ${getStatusClass(log.status)}`}>
                      <span className="status-icon">{getStatusIcon(log.status)}</span>
                      {log.status}
                    </td>
                    <td className="log-duration">{log.executionTimeMs}ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
