import { describe, it, expect, afterEach } from 'vitest';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadTagSet } from '@rgm-power-tools/core';
import { runSync } from '../src/commands/sync.js';
import { makeFakeIO, tempDir, seededClient } from './helpers.js';

describe('sync', () => {
  const dirs: Array<() => void> = [];
  afterEach(() => {
    dirs.forEach((c) => c());
    dirs.length = 0;
  });

  it('scaffolds a new tags file from live groups', async () => {
    const dir = tempDir();
    dirs.push(dir.cleanup);
    const { io } = makeFakeIO({ cwd: dir.path, client: seededClient() });

    const code = await runSync({}, io);
    expect(code).toBe(0);

    const set = loadTagSet(join(dir.path, 'monitor-tags.yaml'));
    expect(set.groups.map((g) => g.name).sort()).toEqual([
      'Development',
      'Production',
      'Sandbox',
    ]);
    // New entries get empty tag bags.
    expect(set.groups.every((g) => Object.keys(g.tags).length === 0)).toBe(true);
  });

  it('preserves existing tags and only adds new groups', async () => {
    const dir = tempDir();
    dirs.push(dir.cleanup);
    const path = join(dir.path, 'monitor-tags.yaml');
    writeFileSync(
      path,
      'version: 1\ngroups:\n  - name: Production\n    tags:\n      owner: dba-team\n',
      'utf8',
    );
    const { io } = makeFakeIO({ cwd: dir.path, client: seededClient() });

    await runSync({}, io);
    const set = loadTagSet(path);
    expect(set.groups.find((g) => g.name === 'Production')!.tags.owner).toBe(
      'dba-team',
    );
    expect(set.groups.map((g) => g.name)).toContain('Sandbox');
  });

  it('--dry-run reports changes without writing', async () => {
    const dir = tempDir();
    dirs.push(dir.cleanup);
    const { io, stdout } = makeFakeIO({ cwd: dir.path, client: seededClient() });

    await runSync({ dryRun: true }, io);
    expect(existsSync(join(dir.path, 'monitor-tags.yaml'))).toBe(false);
    expect(stdout.join('\n')).toContain('Dry run');
  });

  it('flags file entries that no longer exist live (kept, not deleted)', async () => {
    const dir = tempDir();
    dirs.push(dir.cleanup);
    const path = join(dir.path, 'monitor-tags.yaml');
    writeFileSync(
      path,
      'version: 1\ngroups:\n  - name: Retired\n    tags:\n      owner: nobody\n',
      'utf8',
    );
    const { io, stdout } = makeFakeIO({ cwd: dir.path, client: seededClient() });

    await runSync({}, io);
    expect(stdout.join('\n')).toContain('Retired');
    // Retired is kept in the file.
    const kept = loadTagSet(path).groups.map((g) => g.name);
    expect(kept).toContain('Retired');
    expect(readFileSync(path, 'utf8')).toContain('Retired');
  });
});
