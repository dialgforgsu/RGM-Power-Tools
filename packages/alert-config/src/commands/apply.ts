import { resolve } from 'node:path';
import chalk from 'chalk';
import { resolveConnection } from '@rgm-power-tools/core';
import { DEFAULT_CONFIG_FILE } from '../constants.js';
import { readConfigFile } from '../yaml-io.js';
import { resolveConfig } from '../resolve.js';
import { buildLiveConfig } from '../live-state.js';
import { diffConfigs } from '../diff-engine.js';
import { applyConfig } from '../apply-plan.js';
import { renderDiff } from '../output.js';
import { filterConfigByTags, type TagFilterOptions } from '../tag-filter.js';
import type { CliIO } from '../io.js';

export interface ApplyOptions extends TagFilterOptions {
  dryRun?: boolean;
  yes?: boolean;
  url?: string;
  authToken?: string;
}

/**
 * Push the local config into Monitor idempotently. Prints a Terraform-style
 * plan (the diff from live -> desired), confirms unless --yes, then writes only
 * what differs. --dry-run prints the plan and exits without writing.
 */
export async function runApply(
  options: ApplyOptions,
  io: CliIO,
): Promise<number> {
  const path = resolve(io.cwd, DEFAULT_CONFIG_FILE);
  const fullConfig = readConfigFile(path);
  resolveConfig(fullConfig); // surface semantic errors before touching the network
  // Scope to tag-matched groups (no-op unless --tag is given). Done after the
  // full resolve above so inheritance is validated against the complete config.
  const config = filterConfigByTags(fullConfig, options, io.cwd);

  const connection = resolveConnection({
    url: options.url,
    authToken: options.authToken,
    cwd: io.cwd,
    env: io.env,
  });
  const client = io.createClient(connection);
  await client.connect();

  const liveConfig = filterConfigByTags(
    await buildLiveConfig(client),
    options,
    io.cwd,
  );
  const plan = diffConfigs(liveConfig, config);

  io.out(chalk.bold('Plan: changes to apply (live -> desired)'));
  io.out('');
  renderDiff(plan, io.out, { source: 'live', target: DEFAULT_CONFIG_FILE });
  io.out('');

  if (!plan.hasChanges) {
    io.out(
      chalk.green('Nothing to apply — Monitor already matches the config.'),
    );
    return 0;
  }

  if (options.dryRun) {
    io.out(chalk.dim('Dry run: no changes were applied.'));
    return 0;
  }

  if (!options.yes) {
    const approved = await io.confirm('Apply these changes?');
    if (!approved) {
      io.out(chalk.yellow('Apply cancelled. No changes were made.'));
      return 0;
    }
  }

  const result = await applyConfig(client, config);
  io.out(chalk.green(`✓ Applied ${result.written} change(s).`));
  if (result.missingGroups.length > 0) {
    io.out(
      chalk.yellow(
        `Skipped ${result.missingGroups.length} group(s) not present in Monitor: ` +
          `${result.missingGroups.join(', ')}. Create them in Monitor first.`,
      ),
    );
  }
  return 0;
}
