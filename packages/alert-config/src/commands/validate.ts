import { resolve } from 'node:path';
import chalk from 'chalk';
import { DEFAULT_CONFIG_FILE } from '../constants.js';
import { readConfigFile } from '../yaml-io.js';
import { resolveConfig } from '../resolve.js';
import type { CliIO } from '../io.js';

export interface ValidateOptions {
  /** Path to validate. Defaults to ./monitor-config.yaml. */
  file?: string;
}

/**
 * Schema-validate a config file. No network calls. Throws ConfigValidationError
 * / ConfigSemanticError / ConfigFileError (rendered by the CLI) on failure.
 * Returns exit code 0 when valid.
 */
export async function runValidate(
  options: ValidateOptions,
  io: CliIO,
): Promise<number> {
  const path = resolve(io.cwd, options.file ?? DEFAULT_CONFIG_FILE);
  const config = readConfigFile(path);
  // Catches semantic problems the schema can't (bad inherits_from, cycles).
  resolveConfig(config);
  io.out(
    chalk.green(
      `✓ ${path} is valid (${config.groups.length} group(s), schema v${config.version}).`,
    ),
  );
  return 0;
}
