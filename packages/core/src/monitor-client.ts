import { ConnectionError, PowerShellError } from './errors.js';
import {
  ChildProcessPowerShellExecutor,
  type PowerShellExecutor,
} from './powershell.js';
import type {
  AlertActivity,
  AlertSettingsMap,
  CustomMetric,
  LicenseSummary,
  MonitorConnection,
  MonitorGroup,
  MonitoredObject,
  MonitoredObjectRef,
  RawAlertSetting,
  ServerStatus,
} from './types.js';

/**
 * Read/write surface for a Redgate Monitor instance.
 *
 * This is the seam the rest of the toolkit depends on. The default
 * implementation shells out to the Monitor PowerShell module, but callers only
 * see this interface — a future HTTP-based implementation can drop in without
 * any changes upstream.
 */
export interface MonitorClient {
  /** Establish a session. Throws {@link ConnectionError} on failure. */
  connect(): Promise<void>;
  /** List all monitored objects (machines, instances, databases, groups). */
  getMonitoredObjects(): Promise<MonitoredObject[]>;
  /** List all server groups. */
  getGroups(): Promise<MonitorGroup[]>;
  /** Read every alert setting for a single monitored object. */
  getAlertSettings(object: MonitoredObjectRef): Promise<AlertSettingsMap>;
  /**
   * Write the settings for one alert type on one monitored object. Must be
   * safe to call repeatedly with the same values (idempotent at the API level).
   */
  updateAlertSetting(
    object: MonitoredObjectRef,
    alertType: number,
    settings: Record<string, unknown>,
  ): Promise<void>;

  // --- Diagnostics reads (for monitor-doctor) ---
  /** Per-object alerting activity, for "never alerting" style audits. */
  getAlertActivity(): Promise<AlertActivity[]>;
  /** Custom metric definitions and when each last returned data. */
  getCustomMetrics(): Promise<CustomMetric[]>;
  /** License/monitoring status per server, for decommission audits. */
  getServerStatuses(): Promise<ServerStatus[]>;
  /** Installation-wide license capacity, for utilization/cost audits. */
  getLicenseSummary(): Promise<LicenseSummary>;
}

export interface PowerShellMonitorClientOptions {
  /** Injectable executor — defaults to the real child-process one. */
  executor?: PowerShellExecutor;
}

/** Escape a value for embedding inside a PowerShell single-quoted string. */
function psQuote(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

/**
 * {@link MonitorClient} backed by the Redgate Monitor PowerShell module.
 *
 * Each call runs a fresh PowerShell process, so every script re-establishes the
 * session with Connect-SqlMonitor. Results are projected to normalized JSON in
 * PowerShell and parsed here, keeping property-name assumptions in one place.
 */
export class PowerShellMonitorClient implements MonitorClient {
  private readonly connection: MonitorConnection;
  private readonly executor: PowerShellExecutor;

  constructor(
    connection: MonitorConnection,
    options: PowerShellMonitorClientOptions = {},
  ) {
    this.connection = connection;
    this.executor = options.executor ?? new ChildProcessPowerShellExecutor();
  }

  /** Prefix a script body with the Connect-SqlMonitor session setup. */
  private withSession(body: string): string {
    const url = psQuote(this.connection.baseUrl);
    const token = psQuote(this.connection.authToken);
    return [
      '$ErrorActionPreference = "Stop"',
      `Connect-SqlMonitor -ServerUrl ${url} -AuthToken ${token} | Out-Null`,
      body,
    ].join('\n');
  }

  private async runJson<T>(body: string): Promise<T> {
    const out = await this.executor.run(this.withSession(body));
    if (!out) return [] as unknown as T;
    try {
      return JSON.parse(out) as T;
    } catch (cause) {
      throw new PowerShellError(
        'Could not parse JSON returned by PowerShell.',
        { cause },
      );
    }
  }

  async connect(): Promise<void> {
    try {
      await this.executor.run(this.withSession('Write-Output "connected"'));
    } catch (cause) {
      throw new ConnectionError(
        `Could not connect to Monitor at ${this.connection.baseUrl}. ` +
          'Check the URL, token, and that the Monitor PowerShell module is installed.',
        { cause },
      );
    }
  }

  async getMonitoredObjects(): Promise<MonitoredObject[]> {
    // ConvertTo-Json emits a single object (not an array) for one result, so we
    // wrap with @(...) and force an array on the JS side.
    const raw = await this.runJson<RawMonitoredObject[] | RawMonitoredObject>(
      'Get-SqlMonitorMonitoredObject | Select-Object Id, Name, Type, ParentId | ConvertTo-Json -Depth 6',
    );
    return asArray(raw).map(normalizeMonitoredObject);
  }

  async getGroups(): Promise<MonitorGroup[]> {
    const raw = await this.runJson<RawGroup[] | RawGroup>(
      'Get-SqlMonitorGroup | Select-Object Id, Name, Description, MemberIds | ConvertTo-Json -Depth 6',
    );
    return asArray(raw).map(normalizeGroup);
  }

  async getAlertSettings(
    object: MonitoredObjectRef,
  ): Promise<AlertSettingsMap> {
    const raw = await this.runJson<
      RawAlertSettingEntry[] | RawAlertSettingEntry
    >(
      `$obj = Get-SqlMonitorMonitoredObject | Where-Object { $_.Id -eq ${psQuote(
        object.id,
      )} }\n` +
        'Get-SqlMonitorAlertSettings -MonitoredObject $obj | ConvertTo-Json -Depth 10',
    );
    const map: AlertSettingsMap = {};
    for (const entry of asArray(raw)) {
      const setting = normalizeAlertSetting(entry);
      map[setting.alertType] = setting;
    }
    return map;
  }

  async updateAlertSetting(
    object: MonitoredObjectRef,
    alertType: number,
    settings: Record<string, unknown>,
  ): Promise<void> {
    const settingsJson = JSON.stringify(settings);
    const body =
      `$obj = Get-SqlMonitorMonitoredObject | Where-Object { $_.Id -eq ${psQuote(
        object.id,
      )} }\n` +
      `$settings = '${settingsJson.replace(/'/g, "''")}' | ConvertFrom-Json\n` +
      `Update-RedgateMonitorAlertSpecificSettings -MonitoredObject $obj ` +
      `-AlertType ${alertType} -Settings $settings | Out-Null`;
    await this.executor.run(this.withSession(body));
  }

  // --- Diagnostics reads ---
  // The cmdlet names below are the integration seam: they project Monitor state
  // into normalized JSON. Exact cmdlets/fields vary by Monitor version; this is
  // the one place to adjust them (mirrors how alert reads are isolated above).

  async getAlertActivity(): Promise<AlertActivity[]> {
    const raw = await this.runJson<RawAlertActivity[] | RawAlertActivity>(
      'Get-SqlMonitorAlertActivity | ' +
        'Select-Object ObjectId, LastAlertUtc, AlertCount | ConvertTo-Json -Depth 4',
    );
    return asArray(raw).map(normalizeAlertActivity);
  }

  async getCustomMetrics(): Promise<CustomMetric[]> {
    const raw = await this.runJson<RawCustomMetric[] | RawCustomMetric>(
      'Get-SqlMonitorCustomMetric | ' +
        'Select-Object Id, Name, Enabled, LastDataUtc | ConvertTo-Json -Depth 4',
    );
    return asArray(raw).map(normalizeCustomMetric);
  }

  async getServerStatuses(): Promise<ServerStatus[]> {
    const raw = await this.runJson<RawServerStatus[] | RawServerStatus>(
      'Get-SqlMonitorMonitoredObject | Where-Object { $_.Type -in @("Machine","Instance") } | ' +
        'Select-Object Id, Name, Status, ConsumesLicense, LastDataUtc | ConvertTo-Json -Depth 4',
    );
    return asArray(raw).map(normalizeServerStatus);
  }

  async getLicenseSummary(): Promise<LicenseSummary> {
    const raw = await this.runJson<RawLicenseSummary | RawLicenseSummary[]>(
      'Get-SqlMonitorLicense | ' +
        'Select-Object TotalSlots, UsedSlots, Edition | ConvertTo-Json -Depth 4',
    );
    const first = asArray(raw)[0];
    return normalizeLicenseSummary(first);
  }
}

// --- Raw shapes returned by ConvertTo-Json (property names mirror cmdlets) ---

interface RawMonitoredObject {
  Id: string | number;
  Name: string;
  Type: string;
  ParentId?: string | number | null;
}

interface RawGroup {
  Id: string | number;
  Name: string;
  Description?: string | null;
  MemberIds?: Array<string | number> | null;
}

interface RawAlertSettingEntry {
  AlertType: number;
  Enabled: boolean;
  Settings?: Record<string, unknown> | null;
}

interface RawAlertActivity {
  ObjectId: string | number;
  LastAlertUtc?: string | null;
  AlertCount?: number | null;
}

interface RawCustomMetric {
  Id: string | number;
  Name: string;
  Enabled?: boolean | null;
  LastDataUtc?: string | null;
}

interface RawServerStatus {
  Id: string | number;
  Name: string;
  Status?: string | null;
  ConsumesLicense?: boolean | null;
  LastDataUtc?: string | null;
}

interface RawLicenseSummary {
  TotalSlots?: number | null;
  UsedSlots?: number | null;
  Edition?: string | null;
}

function asArray<T>(value: T[] | T | null | undefined): T[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function normalizeMonitoredObject(raw: RawMonitoredObject): MonitoredObject {
  return {
    id: String(raw.Id),
    name: raw.Name,
    type: (raw.Type as MonitoredObject['type']) ?? 'Instance',
    parentId: raw.ParentId != null ? String(raw.ParentId) : undefined,
    raw,
  };
}

function normalizeGroup(raw: RawGroup): MonitorGroup {
  return {
    id: String(raw.Id),
    name: raw.Name,
    description: raw.Description ?? undefined,
    memberIds: (raw.MemberIds ?? []).map(String),
    raw,
  };
}

function normalizeAlertSetting(raw: RawAlertSettingEntry): RawAlertSetting {
  return {
    alertType: raw.AlertType,
    enabled: Boolean(raw.Enabled),
    settings: raw.Settings ?? {},
  };
}

function normalizeAlertActivity(raw: RawAlertActivity): AlertActivity {
  return {
    objectId: String(raw.ObjectId),
    lastAlertUtc: raw.LastAlertUtc ?? null,
    alertCount: Number(raw.AlertCount ?? 0),
  };
}

function normalizeCustomMetric(raw: RawCustomMetric): CustomMetric {
  return {
    id: String(raw.Id),
    name: raw.Name,
    enabled: raw.Enabled !== false,
    lastDataUtc: raw.LastDataUtc ?? null,
  };
}

const MONITORING_STATUSES: ReadonlySet<string> = new Set([
  'Active',
  'Stopped',
  'Decommissioned',
  'Maintenance',
  'Unknown',
]);

function normalizeServerStatus(raw: RawServerStatus): ServerStatus {
  const status =
    raw.Status && MONITORING_STATUSES.has(raw.Status)
      ? (raw.Status as ServerStatus['status'])
      : 'Unknown';
  return {
    objectId: String(raw.Id),
    name: raw.Name,
    status,
    consumesLicense: raw.ConsumesLicense !== false,
    lastDataUtc: raw.LastDataUtc ?? null,
  };
}

function normalizeLicenseSummary(
  raw: RawLicenseSummary | undefined,
): LicenseSummary {
  return {
    totalSlots: Number(raw?.TotalSlots ?? 0),
    usedSlots: Number(raw?.UsedSlots ?? 0),
    ...(raw?.Edition ? { edition: raw.Edition } : {}),
  };
}
