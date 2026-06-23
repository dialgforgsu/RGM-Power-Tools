import { describe, it, expect } from 'vitest';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { runApply } from '../src/commands/apply.js';
import { applyConfig } from '../src/apply-plan.js';
import { parseConfig } from '../src/yaml-io.js';
import { makeFakeIO, seededClient, tempDir, VALID_CONFIG } from './helpers.js';

const MODIFIED_CONFIG = VALID_CONFIG.replace('value: 90', 'value: 80');

describe('apply (unit: applyConfig idempotency)', () => {
  it('writes only what differs, and is a no-op the second time', async () => {
    const client = seededClient();
    const config = parseConfig(MODIFIED_CONFIG);

    const first = await applyConfig(client, config);
    expect(first.written).toBe(1); // only cpu_utilization changed
    expect(first.missingGroups).toEqual([]);

    const second = await applyConfig(client, config);
    expect(second.written).toBe(0); // idempotent
  });

  it('reports groups missing from Monitor', async () => {
    const client = seededClient();
    const config = parseConfig(
      VALID_CONFIG + '  - name: Ghost\n    alerts: {}\n',
    );
    const result = await applyConfig(client, config);
    expect(result.missingGroups).toContain('Ghost');
  });
});

describe('apply (integration: command)', () => {
  it('dry-run shows a plan but writes nothing', async () => {
    const dir = tempDir();
    try {
      writeFileSync(join(dir.path, 'monitor-config.yaml'), MODIFIED_CONFIG);
      const client = seededClient();
      const { io, stdout } = makeFakeIO({ client, cwd: dir.path });
      const code = await runApply({ dryRun: true }, io);
      expect(code).toBe(0);
      expect(client.updateCount).toBe(0);
      expect(stdout.join('\n')).toContain('Dry run');
    } finally {
      dir.cleanup();
    }
  });

  it('cancels when the user declines confirmation', async () => {
    const dir = tempDir();
    try {
      writeFileSync(join(dir.path, 'monitor-config.yaml'), MODIFIED_CONFIG);
      const client = seededClient();
      const { io, stdout } = makeFakeIO({
        client,
        cwd: dir.path,
        confirm: false,
      });
      await runApply({}, io);
      expect(client.updateCount).toBe(0);
      expect(stdout.join('\n')).toContain('cancelled');
    } finally {
      dir.cleanup();
    }
  });

  it('applies changes with --yes and is idempotent on re-run', async () => {
    const dir = tempDir();
    try {
      writeFileSync(join(dir.path, 'monitor-config.yaml'), MODIFIED_CONFIG);
      const client = seededClient();
      const { io } = makeFakeIO({ client, cwd: dir.path });
      await runApply({ yes: true }, io);
      expect(client.updateCount).toBe(1);

      const { io: io2, stdout } = makeFakeIO({ client, cwd: dir.path });
      const code = await runApply({ yes: true }, io2);
      expect(code).toBe(0);
      expect(client.updateCount).toBe(1); // no new writes
      expect(stdout.join('\n')).toContain('already matches');
    } finally {
      dir.cleanup();
    }
  });
});
