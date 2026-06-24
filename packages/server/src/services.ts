import { resolve } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import {
  resolveConnection as resolveConn,
  PowerShellMonitorClient,
  redactToken,
  loadTagSet,
  loadTagSetIfPresent,
  type MonitorClient,
  type MonitorConnection,
  type TagSet,
} from '@rgm-power-tools/core';
import {
  readConfigFile,
  buildLiveConfig,
  diffConfigs,
  applyConfig,
  resolveConfig,
  filterConfigByTags,
  DEFAULT_CONFIG_FILE,
  type DiffResult,
  type ApplyResult,
} from '@rgm-power-tools/monitor-config';
import {
  scaffoldFromGroups,
  writeTagSet,
  DEFAULT_TAGS_FILE,
} from '@rgm-power-tools/monitor-tagger';
import {
  gatherSnapshot,
  runChecks,
  type DoctorReport,
} from '@rgm-power-tools/monitor-doctor';

export interface ToolServiceOptions {
  /** Directory holding monitor-config.yaml / monitor-tags.yaml. */
  workdir: string;
  env?: NodeJS.ProcessEnv;
  /** Test seam: build a client for a connection. */
  createClient?: (connection: MonitorConnection) => MonitorClient;
  /** Test seam: resolve the Monitor connection. */
  resolveConnection?: () => MonitorConnection;
}

export interface ApplyRequest {
  /** Without this set true, apply is a dry run that only returns the plan. */
  confirm?: boolean;
  /** Tag filters (`key=value`) scoping the operation. */
  filters?: string[];
}

/**
 * The toolkit's operations exposed as plain async methods returning JSON-able
 * data — no HTTP, no process I/O beyond the toolkit's own. The HTTP layer is a
 * thin adapter over this, and tests drive it directly with a mock client. The
 * Monitor auth token never appears in any return value.
 */
export class ToolService {
  private readonly workdir: string;
  private readonly env: NodeJS.ProcessEnv;
  private readonly makeClient: (c: MonitorConnection) => MonitorClient;
  private readonly getConnection: () => MonitorConnection;

  constructor(options: ToolServiceOptions) {
    this.workdir = options.workdir;
    this.env = options.env ?? process.env;
    this.makeClient =
      options.createClient ?? ((c) => new PowerShellMonitorClient(c));
    this.getConnection =
      options.resolveConnection ??
      (() => resolveConn({ cwd: this.workdir, env: this.env }));
  }

  private async connectedClient(): Promise<MonitorClient> {
    const client = this.makeClient(this.getConnection());
    await client.connect();
    return client;
  }

  private configPath(): string {
    return resolve(this.workdir, DEFAULT_CONFIG_FILE);
  }

  private tagsPath(): string {
    return resolve(this.workdir, DEFAULT_TAGS_FILE);
  }

  /** Connection check. Returns the base URL and a redacted token hint only. */
  async status(): Promise<{
    connected: boolean;
    baseUrl: string;
    tokenHint: string;
    workdir: string;
  }> {
    const connection = this.getConnection();
    const client = this.makeClient(connection);
    await client.connect();
    return {
      connected: true,
      baseUrl: connection.baseUrl,
      tokenHint: redactToken(connection.authToken),
      workdir: this.workdir,
    };
  }

  /** Live groups (name + member count) for the dashboard's group view. */
  async groups(): Promise<Array<{ name: string; servers: number }>> {
    const client = await this.connectedClient();
    const groups = await client.getGroups();
    return groups
      .map((g) => ({ name: g.name, servers: g.memberIds.length }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /** The local alert config file, as raw text (never contains the token). */
  configFile(): { exists: boolean; path: string; text: string } {
    const path = this.configPath();
    if (!existsSync(path)) return { exists: false, path, text: '' };
    return { exists: true, path, text: readFileSync(path, 'utf8') };
  }

  /** Validate the local alert config (schema + semantics). No network. */
  validateConfig(): { valid: boolean } {
    const config = readConfigFile(this.configPath());
    resolveConfig(config);
    return { valid: true };
  }

  /** Plan of changes from live -> desired (optionally tag-scoped). */
  async diff(filters: string[] = []): Promise<DiffResult> {
    const opts = { tag: filters };
    const config = filterConfigByTags(
      readConfigFile(this.configPath()),
      opts,
      this.workdir,
    );
    const client = await this.connectedClient();
    const live = filterConfigByTags(
      await buildLiveConfig(client),
      opts,
      this.workdir,
    );
    return diffConfigs(live, config);
  }

  /**
   * Apply local config to Monitor. Defaults to a DRY RUN: without
   * `confirm: true` it returns only the plan and writes nothing.
   */
  async apply(
    request: ApplyRequest = {},
  ): Promise<{ applied: boolean; plan: DiffResult; result?: ApplyResult }> {
    const opts = { tag: request.filters ?? [] };
    const full = readConfigFile(this.configPath());
    resolveConfig(full); // validate against the complete config first
    const config = filterConfigByTags(full, opts, this.workdir);

    const client = await this.connectedClient();
    const live = filterConfigByTags(
      await buildLiveConfig(client),
      opts,
      this.workdir,
    );
    const plan = diffConfigs(live, config);

    if (!request.confirm) return { applied: false, plan };
    const result = await applyConfig(client, config);
    return { applied: true, plan, result };
  }

  /** The tag overlay (empty set if the file is absent). */
  tags(): TagSet {
    return loadTagSetIfPresent(this.tagsPath());
  }

  /** Validate the tag overlay file. Throws on problems. */
  validateTags(): { valid: boolean; groups: number; tagged: number } {
    const set = loadTagSet(this.tagsPath());
    const tagged = set.groups.filter(
      (g) => Object.keys(g.tags).length > 0,
    ).length;
    return { valid: true, groups: set.groups.length, tagged };
  }

  /**
   * Reconcile the tag overlay with live groups. Dry by default: pass
   * `write: true` to persist the merged file.
   */
  async syncTags(
    options: { write?: boolean } = {},
  ): Promise<{ added: string[]; missing: string[]; written: boolean }> {
    const existing = loadTagSetIfPresent(this.tagsPath());
    const client = await this.connectedClient();
    const liveGroups = await client.getGroups();
    const { merged, added, missing } = scaffoldFromGroups(
      existing,
      liveGroups.map((g) => g.name),
    );
    if (options.write) writeTagSet(this.tagsPath(), merged);
    return { added, missing, written: Boolean(options.write) };
  }

  /** Run the full installation health audit (monitor-doctor). Read-only. */
  async doctor(): Promise<DoctorReport> {
    const client = await this.connectedClient();
    const snapshot = await gatherSnapshot(client);
    return runChecks(snapshot);
  }
}
