import type { MonitorClient } from './monitor-client.js';
import type {
  AlertActivity,
  AlertEvent,
  AlertSettingsMap,
  Annotation,
  AnnotationInput,
  BackupEvent,
  CustomMetric,
  LicenseSummary,
  MonitorGroup,
  MonitoredObject,
  MonitoredObjectRef,
  RawAlertSetting,
  ServerStatus,
  SlowQuery,
  TimeWindow,
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
  /** License capacity (for monitor-doctor); defaults to all-zero. */
  licenseSummary: LicenseSummary;
  /** Forensic timeline data (for monitor-replay); filtered by window on read. */
  alertEvents: AlertEvent[];
  slowQueries: SlowQuery[];
  backups: BackupEvent[];
  annotations: Annotation[];
}

/** Inclusive check that an ISO timestamp falls within a window. */
function inWindow(iso: string, window: TimeWindow): boolean {
  const t = Date.parse(iso);
  return t >= Date.parse(window.startUtc) && t <= Date.parse(window.endUtc);
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
  /** Annotations written via {@link createAnnotation}, for test assertions. */
  readonly createdAnnotations: AnnotationInput[] = [];
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
      alertEvents: state?.alertEvents ?? [],
      slowQueries: state?.slowQueries ?? [],
      backups: state?.backups ?? [],
      annotations: state?.annotations ?? [],
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

  async getAlertsInWindow(window: TimeWindow): Promise<AlertEvent[]> {
    return structuredClone(
      this.state.alertEvents.filter((a) => inWindow(a.raisedUtc, window)),
    );
  }

  async getSlowQueriesInWindow(window: TimeWindow): Promise<SlowQuery[]> {
    return structuredClone(
      this.state.slowQueries.filter((q) => inWindow(q.capturedUtc, window)),
    );
  }

  async getBackupsInWindow(window: TimeWindow): Promise<BackupEvent[]> {
    return structuredClone(
      this.state.backups.filter((b) => inWindow(b.startedUtc, window)),
    );
  }

  async getAnnotationsInWindow(window: TimeWindow): Promise<Annotation[]> {
    return structuredClone(
      this.state.annotations.filter((n) => inWindow(n.createdUtc, window)),
    );
  }

  async createAnnotation(input: AnnotationInput): Promise<void> {
    this.createdAnnotations.push(structuredClone(input));
    this.state.annotations.push({
      createdUtc: input.createdUtc ?? new Date().toISOString(),
      ...(input.author ? { author: input.author } : {}),
      ...(input.object ? { object: input.object } : {}),
      text: input.text,
    });
  }

  /** Number of writes recorded so far (handy in idempotency assertions). */
  get updateCount(): number {
    return this.updates.length;
  }
}
