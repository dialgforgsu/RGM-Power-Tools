import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  MockMonitorClient,
  type MonitoredObject,
} from '@rgm-power-tools/core';
import { ToolService } from '../src/services.js';
import { createApi, type ApiRequest, type ApiResponse } from '../src/api.js';

const TOKEN = 'a-sufficiently-long-token';

const CONFIG_YAML = `version: 1
connection:
  base_monitor_url: \${MONITOR_URL}
  auth_token: \${MONITOR_AUTH_TOKEN}
groups:
  - name: Production
    description: Customer-facing production servers
    servers:
      - PROD-SQL-01
      - PROD-SQL-02
    alerts:
      cpu_utilization:
        enabled: true
        thresholds:
          high:
            value: 90
            duration_seconds: 600
      long_running_query:
        enabled: true
        threshold_seconds: 600
`;

const TAGS_YAML = `version: 1
groups:
  - name: Production
    tags:
      owner: dba-team
      criticality: high
`;

function seededClient(): MockMonitorClient {
  const objects: MonitoredObject[] = [
    { id: 'g1', name: 'Production', type: 'Group' },
    { id: 's1', name: 'PROD-SQL-01', type: 'Instance', parentId: 'm1' },
    { id: 's2', name: 'PROD-SQL-02', type: 'Instance', parentId: 'm1' },
  ];
  return new MockMonitorClient({
    monitoredObjects: objects,
    groups: [
      {
        id: 'g1',
        name: 'Production',
        description: 'Customer-facing production servers',
        memberIds: ['s1', 's2'],
      },
    ],
    licenseSummary: { totalSlots: 5, usedSlots: 2 },
    serverStatuses: [
      { objectId: 's1', name: 'PROD-SQL-01', status: 'Active', consumesLicense: true, lastDataUtc: null },
      { objectId: 's2', name: 'PROD-SQL-02', status: 'Active', consumesLicense: true, lastDataUtc: '2026-06-23T00:00:00Z' },
    ],
    alertSettings: {
      g1: {
        1001: {
          alertType: 1001,
          enabled: true,
          settings: {
            enabled: true,
            thresholds: { high: { value: 90, duration_seconds: 600 } },
          },
        },
        1004: {
          alertType: 1004,
          enabled: true,
          settings: { enabled: true, threshold_seconds: 600 },
        },
      },
    },
  });
}

let dir: string;
let client: MockMonitorClient;
let handle: (req: ApiRequest) => Promise<ApiResponse>;

function makeHandler(authRequired = true) {
  const service = new ToolService({
    workdir: dir,
    env: { MONITOR_URL: 'https://x', MONITOR_AUTH_TOKEN: 'tok' },
    createClient: () => client,
    resolveConnection: () => ({
      baseUrl: 'https://monitor.example.com',
      authToken: 'super-secret-monitor-token',
    }),
  });
  return createApi({ service, token: TOKEN, authRequired });
}

function req(
  method: string,
  fullPath: string,
  opts: { token?: string; body?: unknown } = {},
): ApiRequest {
  const url = new URL(`http://localhost${fullPath}`);
  const headers: Record<string, string | undefined> = {};
  if (opts.token) headers.authorization = `Bearer ${opts.token}`;
  return {
    method,
    path: url.pathname,
    query: url.searchParams,
    headers,
    body: opts.body,
  };
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'rgm-server-'));
  writeFileSync(join(dir, 'monitor-config.yaml'), CONFIG_YAML, 'utf8');
  writeFileSync(join(dir, 'monitor-tags.yaml'), TAGS_YAML, 'utf8');
  client = seededClient();
  handle = makeHandler();
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('auth gating', () => {
  it('allows /api/health without a token', async () => {
    const res = await handle(req('GET', '/api/health'));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('rejects protected routes without a token', async () => {
    const res = await handle(req('GET', '/api/status'));
    expect(res.status).toBe(401);
  });

  it('rejects a wrong token', async () => {
    const res = await handle(req('GET', '/api/status', { token: 'wrong' }));
    expect(res.status).toBe(401);
  });

  it('accepts a correct token', async () => {
    const res = await handle(req('GET', '/api/status', { token: TOKEN }));
    expect(res.status).toBe(200);
  });

  it('does not gate when auth is disabled', async () => {
    const open = makeHandler(false);
    const res = await open(req('GET', '/api/status'));
    expect(res.status).toBe(200);
  });
});

describe('endpoints', () => {
  it('status never leaks the raw Monitor token', async () => {
    const res = await handle(req('GET', '/api/status', { token: TOKEN }));
    const body = res.body as { baseUrl: string; tokenHint: string };
    expect(body.baseUrl).toBe('https://monitor.example.com');
    expect(body.tokenHint).not.toContain('super-secret-monitor-token');
    expect(JSON.stringify(res.body)).not.toContain('super-secret-monitor-token');
  });

  it('lists groups', async () => {
    const res = await handle(req('GET', '/api/groups', { token: TOKEN }));
    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ name: 'Production', servers: 2 }]);
  });

  it('returns the tag overlay', async () => {
    const res = await handle(req('GET', '/api/tags', { token: TOKEN }));
    const body = res.body as { groups: Array<{ name: string }> };
    expect(body.groups[0]!.name).toBe('Production');
  });

  it('diffs local vs live (in sync -> no changes)', async () => {
    const res = await handle(req('GET', '/api/diff', { token: TOKEN }));
    expect(res.status).toBe(200);
    expect((res.body as { hasChanges: boolean }).hasChanges).toBe(false);
  });

  it('apply is a dry run unless confirmed', async () => {
    const dry = await handle(
      req('POST', '/api/apply', { token: TOKEN, body: {} }),
    );
    expect((dry.body as { applied: boolean }).applied).toBe(false);
    expect(client.updateCount).toBe(0);

    const done = await handle(
      req('POST', '/api/apply', { token: TOKEN, body: { confirm: true } }),
    );
    expect((done.body as { applied: boolean }).applied).toBe(true);
  });

  it('maps tool errors to 400 (missing config file)', async () => {
    rmSync(join(dir, 'monitor-config.yaml'));
    const res = await handle(
      req('POST', '/api/config/validate', { token: TOKEN, body: {} }),
    );
    expect(res.status).toBe(400);
    expect((res.body as { error: string }).error).toBeTruthy();
  });

  it('runs the health check (doctor)', async () => {
    const res = await handle(req('GET', '/api/doctor', { token: TOKEN }));
    expect(res.status).toBe(200);
    const report = res.body as {
      total: number;
      counts: { error: number; warning: number; info: number };
      findings: unknown[];
    };
    expect(typeof report.total).toBe('number');
    expect(Array.isArray(report.findings)).toBe(true);
    // Instances s1/s2 never alerted, and the group's alerts have no
    // notification channel -> at least one error + warnings.
    expect(report.counts.error).toBeGreaterThanOrEqual(1);
  });

  it('runs the cost audit and projects onboarding', async () => {
    const res = await handle(req('GET', '/api/cost', { token: TOKEN }));
    expect(res.status).toBe(200);
    const { report } = res.body as {
      report: { totalSlots: number; usedSlots: number; freeSlots: number; utilizationPct: number; wastedSlots: number; idleServers: Array<{ name: string }> };
    };
    expect(report.totalSlots).toBe(5);
    expect(report.usedSlots).toBe(2);
    expect(report.freeSlots).toBe(3);
    expect(report.utilizationPct).toBe(40);
    // PROD-SQL-01 has never sent data -> always counted as wasted.
    expect(report.idleServers.map((s) => s.name)).toContain('PROD-SQL-01');

    const proj = await handle(req('GET', '/api/cost?add=10', { token: TOKEN }));
    const body = proj.body as { projection: { additionalSlotsNeeded: number; withinLicense: boolean } };
    expect(body.projection.additionalSlotsNeeded).toBe(7); // 10 - 3 free
    expect(body.projection.withinLicense).toBe(false);
  });

  it('404s an unknown endpoint', async () => {
    const res = await handle(req('GET', '/api/nope', { token: TOKEN }));
    expect(res.status).toBe(404);
  });
});
