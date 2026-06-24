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

/** Connection details for a Monitor instance. */
export interface MonitorConnection {
  /** Base URL of the Monitor web UI/API, e.g. https://monitor.example.com. */
  baseUrl: string;
  /** Auth token generated from Configuration → API in the Monitor UI. */
  authToken: string;
}
