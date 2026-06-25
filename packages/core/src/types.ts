/**
 * Shared domain types for Redgate Monitor.
 *
 * These model Monitor's own domain (monitored objects, groups, raw alert
 * settings) and are deliberately decoupled from any one tool's config format.
 * Every tool maps between these and its own view: `alert-config` to its alert
 * YAML schema, `monitor-tagger` to its tag overlay — and any future tool can
 * reuse them as-is.
 */

/** Kinds of object Monitor can monitor. */
export type MonitoredObjectType =
  | 'Cluster'
  | 'Machine'
  | 'Instance'
  | 'Database'
  | 'AvailabilityGroup'
  | 'Group';

/**
 * A reference to a monitored object as Monitor identifies it. The PowerShell
 * cmdlets accept an opaque object; we carry the fields we need plus the raw
 * handle so we can pass it straight back to a write cmdlet.
 */
export interface MonitoredObjectRef {
  /** Stable Monitor identifier (e.g. "1:42" style entity id). */
  id: string;
  /** Display name (machine/instance/database/group name). */
  name: string;
  type: MonitoredObjectType;
  /** Parent object id, if this object is nested (instance under machine, etc.). */
  parentId?: string;
}

/** A monitored object with optional Monitor-native opaque payload retained. */
export interface MonitoredObject extends MonitoredObjectRef {
  /**
   * The raw object as returned by Get-SqlMonitorMonitoredObject. Treated as
   * opaque by callers; passed back verbatim to cmdlets that need it.
   */
  raw?: unknown;
}

/** A Monitor server group. */
export interface MonitorGroup {
  id: string;
  name: string;
  description?: string;
  /** Ids of the monitored objects that belong to this group. */
  memberIds: string[];
  raw?: unknown;
}

/**
 * One alert's settings as Monitor stores them, keyed loosely. Monitor exposes
 * alerts by a numeric AlertType; the `settings` bag holds the per-alert-type
 * fields (thresholds, durations, etc.) whose shape varies by alert type.
 */
export interface RawAlertSetting {
  /** Numeric Monitor AlertType. */
  alertType: number;
  enabled: boolean;
  /** Arbitrary per-alert-type settings bag, exactly as Monitor returns it. */
  settings: Record<string, unknown>;
}

/** All alert settings for a single monitored object, keyed by numeric AlertType. */
export type AlertSettingsMap = Record<number, RawAlertSetting>;

// --- Diagnostics surface (consumed by monitor-doctor) ------------------------
// These power install-health audits. They are read-only projections of Monitor
// state that don't fit the alert-config domain, kept here so every tool reads
// them through the one shared client.

/** When a monitored object last raised an alert — for staleness audits. */
export interface AlertActivity {
  objectId: string;
  /** ISO-8601 timestamp of the most recent alert, or null if it never alerted. */
  lastAlertUtc: string | null;
  /** Number of alerts raised within Monitor's retained history window. */
  alertCount: number;
}

/** A custom metric definition and when it last returned data. */
export interface CustomMetric {
  id: string;
  name: string;
  enabled: boolean;
  /** ISO-8601 timestamp of the most recent collected value, or null if never. */
  lastDataUtc: string | null;
}

/** Monitoring/license status for a server-like monitored object. */
export type MonitoringStatus =
  | 'Active'
  | 'Stopped'
  | 'Decommissioned'
  | 'Maintenance'
  | 'Unknown';

export interface ServerStatus {
  objectId: string;
  name: string;
  status: MonitoringStatus;
  /** Whether this object currently consumes a Monitor license. */
  consumesLicense: boolean;
  /** ISO-8601 timestamp of the last data received, or null. */
  lastDataUtc: string | null;
}

/** Installation-wide license capacity — for utilization audits. */
export interface LicenseSummary {
  /** Total licensed monitoring slots. */
  totalSlots: number;
  /** Slots currently allocated/consumed. */
  usedSlots: number;
  /** License edition/SKU label, if Monitor reports one. */
  edition?: string;
}

// --- Forensic timeline surface (consumed by monitor-replay) ------------------
// Time-windowed reads for incident post-mortems. Timestamps are ISO-8601 UTC.

/** An inclusive time window. */
export interface TimeWindow {
  startUtc: string;
  endUtc: string;
}

/** An alert that was raised (and possibly cleared) within the window. */
export interface AlertEvent {
  id: string;
  raisedUtc: string;
  clearedUtc: string | null;
  alertType: number;
  /** Human-readable alert name, if Monitor provides one. */
  alertName?: string;
  /** Severity label, e.g. "High". */
  severity?: string;
  /** Monitored object the alert fired on. */
  object: string;
  detail?: string;
}

/** A slow/expensive query captured within the window. */
export interface SlowQuery {
  capturedUtc: string;
  object: string;
  database?: string;
  durationMs: number;
  /** Query text (may be truncated by Monitor). */
  query: string;
}

/** A backup operation that ran within the window. */
export interface BackupEvent {
  startedUtc: string;
  completedUtc: string | null;
  object: string;
  database: string;
  /** Full / Differential / Log, as Monitor reports it. */
  type: string;
  sizeBytes: number | null;
  /** Succeeded / Failed, if known. */
  outcome?: string;
}

/** An operator annotation/note recorded within the window. */
export interface Annotation {
  createdUtc: string;
  author?: string;
  object?: string;
  text: string;
}

/** A new annotation to write to the Monitor timeline. */
export interface AnnotationInput {
  text: string;
  /** Monitored object to attach to. Omit for an instance-wide annotation. */
  object?: string;
  author?: string;
  /** ISO-8601 timestamp; defaults to "now" on the Monitor side if omitted. */
  createdUtc?: string;
}

/** Connection details for a Monitor instance. */
export interface MonitorConnection {
  /** Base URL of the Monitor web UI/API, e.g. https://monitor.example.com. */
  baseUrl: string;
  /** Auth token generated from Configuration → API in the Monitor UI. */
  authToken: string;
}
