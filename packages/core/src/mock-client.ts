import type { MonitorClient } from './monitor-client.js';
import type {
  AlertActivity,
  AlertSettingsMap,
  CustomMetric,
  LicenseSummary,
  MonitorGroup,
  MonitoredObject,
  MonitoredObjectRef,
  RawAlertSetting,
  ServerStatus,
} from './types.js';

export interface MockMonitorState {
  monitoredObjects: MonitoredObject[];
  groups: MonitorGroup[];
  /** Alert settings keyed by monitored-object id. */
  alertSettings: Record<string, AlertSettingsMap>;
  /** Diagnostics data (for monitor-doctor); all default to empty. */
  alertActivity: AlertActivity[];
  customMetrics: CustomMetric[];
  serverStatuses: ServerStatus[];
  /** License capacity (for monitor-cost); defaults to all-zero. */
  licenseSummary: LicenseSummary;
}

/** A recorded write, for asserting idempotency / apply behaviour in tests. */
export interface RecordedUpdate {
  objectId: string;
  alertType: number;
  settings: Record<string, unknown>;
}

/**
 * In-memory {@link MonitorClient} for tests and offline use. Seeded with state,
 * it serves reads from that state and records writes so tests can assert that
 * `apply` is idempotent (a second apply records nothing new).
 */
export class MockMonitorClient implements MonitorClient {
  private state: MockMonitorState;
  readonly updates: RecordedUpdate[] = [];
  connected = false;

  constructor(state?: Partial<MockMonitorState>) {
    this.state = {
      monitoredObjects: state?.monitoredObjects ?? [],
      groups: state?.groups ?? [],
      alertSettings: state?.alertSettings ?? {},
      alertActivity: state?.alertActivity ?? [],
      customMetrics: state?.customMetrics ?? [],
      serverStatuses: state?.serverStatuses ?? [],
      licenseSummary: state?.licenseSummary ?? { totalSlots: 0, usedSlots: 0 },
    };
  }

  async connect(): Promise<void> {
    this.connected = true;
  }

  async getMonitoredObjects(): Promise<MonitoredObject[]> {
    return structuredClone(this.state.monitoredObjects);
  }

  async getGroups(): Promise<MonitorGroup[]> {
    return structuredClone(this.state.groups);
  }

  async getAlertSettings(
    object: MonitoredObjectRef,
  ): Promise<AlertSettingsMap> {
    return structuredClone(this.state.alertSettings[object.id] ?? {});
  }

  async updateAlertSetting(
    object: MonitoredObjectRef,
    alertType: number,
    settings: Record<string, unknown>,
  ): Promise<void> {
    this.updates.push({
      objectId: object.id,
      alertType,
      settings: structuredClone(settings),
    });
    const existing = this.state.alertSettings[object.id] ?? {};
    const enabled =
      typeof settings.enabled === 'boolean'
        ? settings.enabled
        : (existing[alertType]?.enabled ?? true);
    const updated: RawAlertSetting = { alertType, enabled, settings };
    this.state.alertSettings[object.id] = { ...existing, [alertType]: updated };
  }

  async getAlertActivity(): Promise<AlertActivity[]> {
    return structuredClone(this.state.alertActivity);
  }

  async getCustomMetrics(): Promise<CustomMetric[]> {
    return structuredClone(this.state.customMetrics);
  }

  async getServerStatuses(): Promise<ServerStatus[]> {
    return structuredClone(this.state.serverStatuses);
  }

  async getLicenseSummary(): Promise<LicenseSummary> {
    return structuredClone(this.state.licenseSummary);
  }

  /** Number of writes recorded so far (handy in idempotency assertions). */
  get updateCount(): number {
    return this.updates.length;
  }
}
