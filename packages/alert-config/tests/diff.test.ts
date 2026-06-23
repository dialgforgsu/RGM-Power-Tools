import { describe, it, expect } from 'vitest';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { runDiff } from '../src/commands/diff.js';
import { diffConfigs } from '../src/diff-engine.js';
import { parseConfig } from '../src/yaml-io.js';
import { makeFakeIO, seededClient, tempDir, VALID_CONFIG } from './helpers.js';

describe('diff (unit: diffConfigs)', () => {
  it('reports no changes for identical configs', () => {
    const a = parseConfig(VALID_CONFIG);
    const b = parseConfig(VALID_CONFIG);
    expect(diffConfigs(a, b).hasChanges).toBe(false);
  });

  it('reports a changed threshold value', () => {
    const a = parseConfig(VALID_CONFIG);
    const b = parseConfig(VALID_CONFIG.replace('value: 90', 'value: 80'));
    const result = diffConfigs(a, b);
    expect(result.hasChanges).toBe(true);
    const change = result.groups[0]!.changes.find((c) =>
      c.path.includes('value'),
    );
    expect(change).toMatchObject({ kind: 'changed', from: 90, to: 80 });
  });

  it('reports a group present on only one side', () => {
    const a = parseConfig(VALID_CONFIG);
    const b = parseConfig(VALID_CONFIG + '  - name: Staging\n    alerts: {}\n');
    const result = diffConfigs(a, b);
    expect(result.groups.find((g) => g.name === 'Staging')?.status).toBe(
      'added',
    );
  });
});

describe('diff (integration: local vs live)', () => {
  it('exits 0 when local matches live', async () => {
    const dir = tempDir();
    try {
      writeFileSync(join(dir.path, 'monitor-config.yaml'), VALID_CONFIG);
      const { io } = makeFakeIO({ client: seededClient(), cwd: dir.path });
      const code = await runDiff({ target: 'live' }, io);
      expect(code).toBe(0);
    } finally {
      dir.cleanup();
    }
  });

  it('exits 1 when local differs from live', async () => {
    const dir = tempDir();
    try {
      writeFileSync(
        join(dir.path, 'monitor-config.yaml'),
        VALID_CONFIG.replace('value: 90', 'value: 80'),
      );
      const { io, stdout } = makeFakeIO({
        client: seededClient(),
        cwd: dir.path,
      });
      const code = await runDiff({}, io);
      expect(code).toBe(1);
      expect(stdout.join('\n')).toMatch(/group "Production"/);
    } finally {
      dir.cleanup();
    }
  });
});
