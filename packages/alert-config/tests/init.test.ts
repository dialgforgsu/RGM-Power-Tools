import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { runInit } from '../src/commands/init.js';
import { parseConfig } from '../src/yaml-io.js';
import { makeFakeIO, tempDir } from './helpers.js';

describe('init', () => {
  it('scaffolds a valid starter config, gitignore, and local config template', async () => {
    const dir = tempDir();
    try {
      const { io, stdout } = makeFakeIO({ cwd: dir.path });
      const code = await runInit({}, io);
      expect(code).toBe(0);

      const yamlPath = join(dir.path, 'monitor-config.yaml');
      expect(existsSync(yamlPath)).toBe(true);
      // The starter YAML must itself be schema-valid.
      expect(() => parseConfig(readFileSync(yamlPath, 'utf8'))).not.toThrow();

      const gitignore = readFileSync(join(dir.path, '.gitignore'), 'utf8');
      expect(gitignore).toContain('.monitor-config.json');

      expect(existsSync(join(dir.path, '.monitor-config.json'))).toBe(true);
      expect(stdout.join('\n')).toContain('Next steps');
    } finally {
      dir.cleanup();
    }
  });

  it('skips existing files without --force', async () => {
    const dir = tempDir();
    try {
      const { io: io1 } = makeFakeIO({ cwd: dir.path });
      await runInit({}, io1);
      const { io: io2, stdout } = makeFakeIO({ cwd: dir.path });
      await runInit({}, io2);
      expect(stdout.join('\n')).toContain('skipped');
    } finally {
      dir.cleanup();
    }
  });
});
