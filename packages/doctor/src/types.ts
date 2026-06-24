import type {
  AlertActivity,
  AlertSettingsMap,
  CustomMetric,
  MonitorGroup,
  MonitoredObject,
  ServerStatus,
} from '@rgm-power-tools/core';

/** Finding severities, ordered least → most serious by {@link SEVERITY_RANK}. */
export type Severity = 'info' | 'warning' | 'error';

export const SEVERITY_RANK: Record<Severity, number> = {
  info: 0,
  warning: 1,
  error: 2,
};

/** One problem the linter found. */
export interface Finding {
  /** Id of the check that produced it. */
  checkId: string;
  severity: Severity;
  /** Short one-line summary of the problem. */
  title: string;
  /** The specific subject (server / metric / alert), when applicable. */
  subject?: string;
  /** Remediation hint or extra context. */
  detail?: string;
}

/**
 * A read-only snapshot of everything the checks need, gathered once so checks
 * stay pure functions — trivially unit-testable with hand-built data and free
 * of any I/O.
 */
export interface MonitorSnapshot {
  objects: MonitoredObject[];
  groups: MonitorGroup[];
  /** Alert settings keyed by monitored-object id. */
  alertSettingsByObject: Record<string, AlertSettingsMap>;
  alertActivity: AlertActivity[];
  customMetrics: CustomMetric[];
  serverStatuses: ServerStatus[];
}

/** A single lint rule over the snapshot. */
export interface Check {
  /** Stable identifier, e.g. `decommissioned-licensed`. */
  id: string;
  /** Human title shown in `monitor-doctor list`. */
  title: string;
  /** One-sentence description of what it flags. */
  description: string;
  /** Default severity for this check's findings. */
  severity: Severity;
  /** Pure evaluation against the snapshot. `now` anchors time-based rules. */
  run(snapshot: MonitorSnapshot, now: Date): Finding[];
}
