import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runExport } from '../src/commands/export.js';
import { parseConfig } from '../src/yaml-io.js';
import { diffConfigs } from '../src/diff-engine.js';
import { buildLiveConfig } from '../src/live-state.js';
import { makeFakeIO, seededClient, tempDir } from './helpers.js';

describe('export (integration: mocked PowerShell layer)', () => {
  it('writes deterministic YAML that round-trips against live', async () => {
    const dir = tempDir();
    try {
      const client = seededClient();
      const { io } = makeFakeIO({ client, cwd: dir.path });
      const code = await runExport({}, io);
      expect(code).toBe(0);

      const text = readFileSync(join(dir.path, 'monitor-config.yaml'), 'utf8');
      expect(text).toContain('Production');
      // The token must never be written out.
      expect(text).not.toContain('test-token');
      expect(text).toContain('${MONITOR_AUTH_TOKEN}');

      // Re-importing the export and diffing against live yields no changes.
      const exported = parseConfig(text);
      const live = await buildLiveConfig(client);
      expect(diffConfigs(exported, live).hasChanges).toBe(false);
    } finally {
      dir.cleanup();
    }
  });

  it('connects before reading', async () => {
    const dir = tempDir();
    try {
      const client = seededClient();
      const { io } = makeFakeIO({ client, cwd: dir.path });
      await runExport({}, io);
      expect(client.connected).toBe(true);
    } finally {
      dir.cleanup();
    }
  });
});
