import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  MockMonitorClient,
  type MonitorClient,
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
      if (!options.client) throw new Error('No mock client provided to fake IO');
      return options.client;
    },
  };
  return { io, stdout, stderr };
}

/** Create a temp directory; returns the path plus a cleanup function. */
export function tempDir(): { path: string; cleanup: () => void } {
  const path = mkdtempSync(join(tmpdir(), 'monitor-tagger-'));
  return {
    path,
    cleanup: () => rmSync(path, { recursive: true, force: true }),
  };
}

/** A client seeded with three groups, for sync/list --live tests. */
export function seededClient(): MockMonitorClient {
  return new MockMonitorClient({
    groups: [
      { id: 'g1', name: 'Production', memberIds: [] },
      { id: 'g2', name: 'Development', memberIds: [] },
      { id: 'g3', name: 'Sandbox', memberIds: [] },
    ],
  });
}
