import { resolve } from 'node:path';
import { existsSync, writeFileSync } from 'node:fs';
import chalk from 'chalk';
import { DEFAULT_TAGS_FILE } from '../constants.js';
import type { CliIO } from '../io.js';

export interface InitOptions {
  /** Overwrite an existing tags file instead of skipping it. */
  force?: boolean;
}

const STARTER_TAGS_YAML = `version: 1

# A metadata overlay for your Monitor groups. Each entry attaches tags to a
# group by name (the same names you see in Monitor and in monitor-config.yaml).
#
# The well-known dimensions every tool understands are: owner, business_unit,
# criticality, cost_center. You can add any custom keys you like — they all
# become filter keys, e.g.  monitor-config apply --tag criticality=high
#
# Run "monitor-tagger sync" to scaffold entries for every live Monitor group.
groups:
  - name: Production
    tags:
      owner: dba-team
      business_unit: Payments
      criticality: high
      cost_center: "4200"

  - name: Development
    tags:
      owner: dba-team
      business_unit: Payments
      criticality: low
      cost_center: "4200"
`;

/**
 * Scaffold a starter `monitor-tags.yaml`. Unlike the local connection config,
 * the tags file is meant to be committed alongside `monitor-config.yaml`, so it
 * is not added to `.gitignore`.
 */
export async function runInit(options: InitOptions, io: CliIO): Promise<number> {
  const path = resolve(io.cwd, DEFAULT_TAGS_FILE);
  if (existsSync(path) && !options.force) {
    io.out(
      chalk.yellow(
        `  skipped  ${DEFAULT_TAGS_FILE} (exists; use --force to overwrite)`,
      ),
    );
    return 0;
  }

  writeFileSync(path, STARTER_TAGS_YAML, 'utf8');
  io.out(chalk.green(`  created  ${DEFAULT_TAGS_FILE}`));
  io.out('');
  io.out(chalk.bold('Next steps:'));
  io.out(
    '  1. Run "monitor-tagger sync" to add an entry for every live Monitor group.',
  );
  io.out('  2. Fill in owner / business_unit / criticality / cost_center.');
  io.out('  3. Run "monitor-tagger list --filter criticality=high" to query.');
  return 0;
}
