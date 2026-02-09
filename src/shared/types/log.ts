import type { ActionResult } from './actions';

// ─── Log Entry Types ────────────────────────────────────────

export interface LogEntry {
  id: string;
  timestamp: string;
  userInstruction: string;
  interpretedIntent: string;
  actions: ActionResult[];
  pageUrl: string;
  status: 'completed' | 'failed' | 'cancelled';
}

export interface LogFilter {
  startDate?: string;
  endDate?: string;
  status?: 'completed' | 'failed' | 'cancelled';
  url?: string;
}

export interface LogExportFormat {
  format: 'json' | 'csv';
}
