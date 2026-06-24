import { describe, it, expect, afterEach } from 'vitest';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadTagSet } from '@rgm-power-tools/core';
import { runInit } from '../src/commands/init.js';
import { DEFAULT_TAGS_FILE } from '../src/constants.js';
import { makeFakeIO, tempDir } from './helpers.js';

describe('init', () => {
  const dirs: Array<() => void> = [];
  afterEach(() => {
    dirs.forEach((c) => c());
    dirs.length = 0;
  });

  it('scaffolds a valid starter tags file', async () => {
    const dir = tempDir();
    dirs.push(dir.cleanup);
    const { io } = makeFakeIO({ cwd: dir.path });

    const code = await runInit({}, io);
    expect(code).toBe(0);

    const path = join(dir.path, DEFAULT_TAGS_FILE);
    expect(existsSync(path)).toBe(true);
    // The scaffold must itself parse + validate against the core schema.
    const set = loadTagSet(path);
    expect(set.groups.length).toBeGreaterThan(0);
    expect(set.groups[0]!.tags.owner).toBe('dba-team');
  });

  it('does not add the tags file to .gitignore (it is meant to be committed)', async () => {
    const dir = tempDir();
    dirs.push(dir.cleanup);
    const { io } = makeFakeIO({ cwd: dir.path });
    await runInit({}, io);
    expect(existsSync(join(dir.path, '.gitignore'))).toBe(false);
  });

  it('skips an existing file unless --force', async () => {
    const dir = tempDir();
    dirs.push(dir.cleanup);
    const path = join(dir.path, DEFAULT_TAGS_FILE);
    writeFileSync(path, 'version: 1\ngroups: []\n', 'utf8');
    const { io, stdout } = makeFakeIO({ cwd: dir.path });

    await runInit({}, io);
    expect(readFileSync(path, 'utf8')).toContain('groups: []');
    expect(stdout.join('\n')).toContain('skipped');

    await runInit({ force: true }, io);
    expect(readFileSync(path, 'utf8')).toContain('owner: dba-team');
  });
});
