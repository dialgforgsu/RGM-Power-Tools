import { describe, it, expect, afterEach } from 'vitest';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseConfig } from '../src/yaml-io.js';
import { filterConfigByTags } from '../src/tag-filter.js';
import { runDiff } from '../src/commands/diff.js';
import { makeFakeIO, tempDir } from './helpers.js';

const TWO_GROUPS = `version: 1
connection:
  base_monitor_url: \${MONITOR_URL}
  auth_token: \${MONITOR_AUTH_TOKEN}
groups:
  - name: Production
    alerts:
      long_running_query:
        enabled: true
        threshold_seconds: 600
  - name: Development
    alerts:
      long_running_query:
        enabled: true
        threshold_seconds: 600
`;

const TAGS = `version: 1
groups:
  - name: Production
    tags:
      criticality: high
  - name: Development
    tags:
      criticality: low
`;

describe('filterConfigByTags', () => {
  const dirs: Array<() => void> = [];
  afterEach(() => {
    dirs.forEach((c) => c());
    dirs.length = 0;
  });

  it('is a no-op with no filters (tags file not required)', () => {
    const config = parseConfig(TWO_GROUPS);
    const out = filterConfigByTags(config, {}, '/nonexistent');
    expect(out).toBe(config);
  });

  it('keeps only groups whose tags match', () => {
    const dir = tempDir();
    dirs.push(dir.cleanup);
    writeFileSync(join(dir.path, 'monitor-tags.yaml'), TAGS, 'utf8');

    const config = parseConfig(TWO_GROUPS);
    const out = filterConfigByTags(config, { tag: ['criticality=high'] }, dir.path);
    expect(out.groups.map((g) => g.name)).toEqual(['Production']);
  });

  it('resolves inheritance before filtering so refs never break', () => {
    const dir = tempDir();
    dirs.push(dir.cleanup);
    writeFileSync(join(dir.path, 'monitor-tags.yaml'), TAGS, 'utf8');

    // Development inherits from Production but only Development matches the
    // filter; resolving first means the dropped parent does not break the ref.
    const inheriting = `version: 1
connection:
  base_monitor_url: \${MONITOR_URL}
  auth_token: \${MONITOR_AUTH_TOKEN}
groups:
  - name: Production
    alerts:
      long_running_query:
        enabled: true
        threshold_seconds: 600
  - name: Development
    inherits_from: Production
`;
    const config = parseConfig(inheriting);
    const out = filterConfigByTags(config, { tag: ['criticality=low'] }, dir.path);
    expect(out.groups.map((g) => g.name)).toEqual(['Development']);
    // Inherited alert policy was flattened onto Development.
    expect(out.groups[0]!.alerts.long_running_query?.threshold_seconds).toBe(600);
  });
});

describe('diff with --tag', () => {
  const dirs: Array<() => void> = [];
  afterEach(() => {
    dirs.forEach((c) => c());
    dirs.length = 0;
  });

  it('scopes the comparison to tag-matched groups', async () => {
    const dir = tempDir();
    dirs.push(dir.cleanup);
    writeFileSync(join(dir.path, 'monitor-tags.yaml'), TAGS, 'utf8');
    writeFileSync(join(dir.path, 'source.yaml'), TWO_GROUPS, 'utf8');
    // Target differs only in Development (the final threshold in the file).
    const target = TWO_GROUPS.replace(
      /threshold_seconds: 600\n$/,
      'threshold_seconds: 1800\n',
    );
    writeFileSync(join(dir.path, 'target.yaml'), target, 'utf8');

    // Without a filter, the Development difference is reported (exit 1).
    {
      const { io } = makeFakeIO({ cwd: dir.path });
      const code = await runDiff(
        { source: 'source.yaml', target: 'target.yaml' },
        io,
      );
      expect(code).toBe(1);
    }

    // Filtering to criticality=high excludes Development, so configs match.
    {
      const { io } = makeFakeIO({ cwd: dir.path });
      const code = await runDiff(
        { source: 'source.yaml', target: 'target.yaml', tag: ['criticality=high'] },
        io,
      );
      expect(code).toBe(0);
    }
  });
});
