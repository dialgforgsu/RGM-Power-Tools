import {
  MonitorToolError,
  type AlertEvent,
  type Annotation,
  type BackupEvent,
  type SlowQuery,
  type TimeWindow,
} from '@rgm-power-tools/core';

/** Raised for invalid windows/durations or other replay problems. */
export class ReplayError extends MonitorToolError {}

/** Everything gathered for an incident window. */
export interface IncidentData {
  window: TimeWindow;
  alerts: AlertEvent[];
  slowQueries: SlowQuery[];
  backups: BackupEvent[];
  annotations: Annotation[];
}

export interface RenderOptions {
  /** Title for the post-mortem. Defaults to a window-derived title. */
  title?: string;
  /** ISO timestamp the report was generated (for the header). */
  generatedUtc?: string;
  /** How many slow queries to render in full before summarizing. Default 10. */
  maxQueries?: number;
}
