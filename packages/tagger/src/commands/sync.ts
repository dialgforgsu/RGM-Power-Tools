import { resolve } from 'node:path';
import chalk from 'chalk';
import { loadTagSetIfPresent, resolveConnection } from '@rgm-power-tools/core';
import { DEFAULT_TAGS_FILE } from '../constants.js';
import { scaffoldFromGroups, writeTagSet } from '../tags-io.js';
import type { CliIO } from '../io.js';

export interface SyncOptions {
  file?: string;
  /** Show what would change without writing the file. */
  dryRun?: boolean;
  url?: string;
  authToken?: string;
}

/**
 * Reconcile the tags file with live Monitor groups: keep every existing entry
 * and its tags, add blank entries for new groups, and flag entries whose group
 * no longer exists (kept, not deleted). Writes the merged file unless --dry-run.
 */
export async function runSync(options: SyncOptions, io: CliIO): Promise<number> {
  const path = resolve(io.cwd, options.file ?? DEFAULT_TAGS_FILE);
  const existing = loadTagSetIfPresent(path);

  const connection = resolveConnection({
    url: options.url,
    authToken: options.authToken,
    cwd: io.cwd,
    env: io.env,
  });
  const client = io.createClient(connection);
  await client.connect();

  const liveGroups = await client.getGroups();
  const { merged, added, missing } = scaffoldFromGroups(
    existing,
    liveGroups.map((g) => g.name),
  );

  for (const name of added) io.out(chalk.green(`  + ${name} (new — add tags)`));
  for (const name of missing)
    io.out(chalk.yellow(`  ! ${name} (in file, not live — kept)`));

  if (added.length === 0 && missing.length === 0) {
    io.out(chalk.green('Tags file already matches live groups. Nothing to do.'));
    return 0;
  }

  if (options.dryRun) {
    io.out('');
    io.out(chalk.dim('Dry run: no changes were written.'));
    return 0;
  }

  writeTagSet(path, merged);
  io.out('');
  io.out(
    chalk.green(
      `✓ Wrote ${path} (${merged.groups.length} group(s), ${added.length} added).`,
    ),
  );
  return 0;
}
