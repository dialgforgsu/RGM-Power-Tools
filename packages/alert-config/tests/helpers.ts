import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  MockMonitorClient,
  type MonitorClient,
  type MonitoredObject,
} from '@rgm-power-tools/core';
import type { CliIO } from '../src/io.js';

export interface FakeIOResult {
  io: CliIO;
  stdout: string[];
  stderr: string[];
}

/** Build a {@link CliIO} that captures output and uses an injected client. */
export function makeFakeIO(options: {
  client?: MonitorClient;
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  confirm?: boolean;
}): FakeIOResult {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const io: CliIO = {
    out: (msg = '') => stdout.push(msg),
    err: (msg = '') => stderr.push(msg),
    cwd: options.cwd ?? process.cwd(),
    env: options.env ?? {
      MONITOR_URL: 'https://test.example.com',
      MONITOR_AUTH_TOKEN: 'test-token',
    },
    createClient: () => {
      if (!options.client)
        throw new Error('No mock client provided to fake IO');
      return options.client;
    },
    confirm: async () => options.confirm ?? false,
  };
  return { io, stdout, stderr };
}

/** Create a temp directory; returns the path plus a cleanup function. */
export function tempDir(): { path: string; cleanup: () => void } {
  const path = mkdtempSync(join(tmpdir(), 'monitor-config-'));
  return {
    path,
    cleanup: () => rmSync(path, { recursive: true, force: true }),
  };
}

/**
 * A MockMonitorClient seeded with a Production group whose alert settings match
 * what the YAML config below produces — so export/diff/apply round-trip.
 */
export function seededClient(): MockMonitorClient {
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

/** A valid config string that matches the seeded client's live state. */
export const VALID_CONFIG = `version: 1
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
