import { describe, it, expect, afterEach } from 'vitest';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { runList } from '../src/commands/list.js';
import { makeFakeIO, tempDir, seededClient } from './helpers.js';

const TAGS = `version: 1
groups:
  - name: Production
    tags:
      owner: dba-team
      criticality: high
  - name: Development
    tags:
      owner: dba-team
      criticality: low
`;

function writeTags(cwd: string): void {
  writeFileSync(join(cwd, 'monitor-tags.yaml'), TAGS, 'utf8');
}

describe('list', () => {
  const dirs: Array<() => void> = [];
  afterEach(() => {
    dirs.forEach((c) => c());
    dirs.length = 0;
  });

  it('lists all groups by default', async () => {
    const dir = tempDir();
    dirs.push(dir.cleanup);
    writeTags(dir.path);
    const { io, stdout } = makeFakeIO({ cwd: dir.path });
    const code = await runList({}, io);
    expect(code).toBe(0);
    const out = stdout.join('\n');
    expect(out).toContain('Production');
    expect(out).toContain('Development');
  });

  it('filters by tag', async () => {
    const dir = tempDir();
    dirs.push(dir.cleanup);
    writeTags(dir.path);
    const { io, stdout } = makeFakeIO({ cwd: dir.path });
    await runList({ filter: ['criticality=high'] }, io);
    const out = stdout.join('\n');
    expect(out).toContain('Production');
    expect(out).not.toContain('Development');
  });

  it('reports live groups missing from the file with --live', async () => {
    const dir = tempDir();
    dirs.push(dir.cleanup);
    writeTags(dir.path);
    const { io, stdout } = makeFakeIO({ cwd: dir.path, client: seededClient() });
    await runList({ live: true }, io);
    // Sandbox exists live but is not in the tags file.
    expect(stdout.join('\n')).toContain('Sandbox');
  });
});
