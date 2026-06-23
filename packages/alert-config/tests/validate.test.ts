import { describe, it, expect } from 'vitest';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { runValidate } from '../src/commands/validate.js';
import { parseConfig } from '../src/yaml-io.js';
import { ConfigValidationError } from '../src/errors.js';
import { ConfigSemanticError, resolveConfig } from '../src/resolve.js';
import { makeFakeIO, tempDir, VALID_CONFIG } from './helpers.js';

describe('validate (unit: parseConfig)', () => {
  it('accepts a valid config', () => {
    const config = parseConfig(VALID_CONFIG);
    expect(config.groups).toHaveLength(1);
    expect(config.version).toBe(1);
  });

  it('rejects an out-of-range threshold with a line number', () => {
    const bad = VALID_CONFIG.replace('value: 90', 'value: 900');
    try {
      parseConfig(bad);
      expect.fail('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(ConfigValidationError);
      const err = e as ConfigValidationError;
      expect(err.issues.length).toBeGreaterThan(0);
      expect(err.issues[0]!.line).toBeTypeOf('number');
    }
  });

  it('rejects an unknown alert key (strict schema)', () => {
    const bad = VALID_CONFIG.replace(
      'cpu_utilization:',
      'made_up_alert:\n        enabled: true\n      cpu_utilization:',
    );
    expect(() => parseConfig(bad)).toThrow(ConfigValidationError);
  });

  it('rejects inherits_from referencing a missing group', () => {
    const bad = VALID_CONFIG + '  - name: Dev\n    inherits_from: Nope\n';
    const config = parseConfig(bad);
    // Schema passes; semantic resolution must fail.
    expect(() => resolveConfig(config)).toThrow(ConfigSemanticError);
  });
});

describe('validate (integration: command)', () => {
  it('returns 0 and prints success for a valid file', async () => {
    const dir = tempDir();
    try {
      writeFileSync(join(dir.path, 'monitor-config.yaml'), VALID_CONFIG);
      const { io, stdout } = makeFakeIO({ cwd: dir.path });
      const code = await runValidate({}, io);
      expect(code).toBe(0);
      expect(stdout.join('\n')).toContain('is valid');
    } finally {
      dir.cleanup();
    }
  });

  it('throws ConfigFileError when the file is missing', async () => {
    const dir = tempDir();
    try {
      const { io } = makeFakeIO({ cwd: dir.path });
      await expect(runValidate({}, io)).rejects.toThrow();
    } finally {
      dir.cleanup();
    }
  });
});
