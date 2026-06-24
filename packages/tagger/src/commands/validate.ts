import { resolve } from 'node:path';
import chalk from 'chalk';
import { loadTagSet } from '@rgm-power-tools/core';
import { DEFAULT_TAGS_FILE } from '../constants.js';
import type { CliIO } from '../io.js';

export interface ValidateOptions {
  /** Path to validate. Defaults to ./monitor-tags.yaml. */
  file?: string;
}

/**
 * Schema-validate a tags file. No network calls. Throws {@link TagError}
 * (rendered by the CLI) on failure. Returns exit code 0 when valid.
 */
export async function runValidate(
  options: ValidateOptions,
  io: CliIO,
): Promise<number> {
  const path = resolve(io.cwd, options.file ?? DEFAULT_TAGS_FILE);
  const set = loadTagSet(path);
  const tagged = set.groups.filter((g) => Object.keys(g.tags).length > 0).length;
  io.out(
    chalk.green(
      `✓ ${path} is valid (${set.groups.length} group(s), ${tagged} tagged).`,
    ),
  );
  return 0;
}
