import { describe, it, expect, afterEach } from 'vitest';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { TagError } from '@rgm-power-tools/core';
import { runValidate } from '../src/commands/validate.js';
import { makeFakeIO, tempDir } from './helpers.js';

describe('validate', () => {
  const dirs: Array<() => void> = [];
  afterEach(() => {
    dirs.forEach((c) => c());
    dirs.length = 0;
  });

  it('passes a well-formed tags file and reports counts', async () => {
    const dir = tempDir();
    dirs.push(dir.cleanup);
    writeFileSync(
      join(dir.path, 'monitor-tags.yaml'),
      'version: 1\ngroups:\n  - name: A\n    tags:\n      owner: x\n  - name: B\n',
      'utf8',
    );
    const { io, stdout } = makeFakeIO({ cwd: dir.path });
    const code = await runValidate({}, io);
    expect(code).toBe(0);
    expect(stdout.join('\n')).toContain('2 group(s), 1 tagged');
  });

  it('throws TagError on an invalid file', async () => {
    const dir = tempDir();
    dirs.push(dir.cleanup);
    writeFileSync(join(dir.path, 'monitor-tags.yaml'), 'version: 2\n', 'utf8');
    const { io } = makeFakeIO({ cwd: dir.path });
    await expect(runValidate({}, io)).rejects.toBeInstanceOf(TagError);
  });

  it('throws TagError when the file is missing', async () => {
    const dir = tempDir();
    dirs.push(dir.cleanup);
    const { io } = makeFakeIO({ cwd: dir.path });
    await expect(runValidate({}, io)).rejects.toBeInstanceOf(TagError);
  });
});
