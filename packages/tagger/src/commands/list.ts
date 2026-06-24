import { resolve } from 'node:path';
import chalk from 'chalk';
import {
  loadTagSet,
  parseTagFilters,
  matchesTagFilters,
  resolveConnection,
  type TaggedGroup,
} from '@rgm-power-tools/core';
import { DEFAULT_TAGS_FILE } from '../constants.js';
import { renderTagTable } from '../output.js';
import type { CliIO } from '../io.js';

export interface ListOptions {
  file?: string;
  /** Repeatable `key=value` tag filters. */
  filter?: string[];
  /** Limit to a single group by name. */
  group?: string;
  /** Cross-check against live Monitor groups and report untagged ones. */
  live?: boolean;
  url?: string;
  authToken?: string;
}

/**
 * List groups and their tags from the overlay file, optionally filtered by tag
 * (`--filter owner=dba-team`, repeatable) or group name. With `--live`, also
 * reports live Monitor groups that are missing from the file.
 */
export async function runList(options: ListOptions, io: CliIO): Promise<number> {
  const path = resolve(io.cwd, options.file ?? DEFAULT_TAGS_FILE);
  const set = loadTagSet(path);
  const filters = parseTagFilters(options.filter ?? []);

  let groups: TaggedGroup[] = set.groups;
  if (options.group) {
    groups = groups.filter((g) => g.name === options.group);
  }
  groups = groups.filter((g) => matchesTagFilters(g.tags, filters));

  renderTagTable(groups, io.out);

  if (options.live) {
    const connection = resolveConnection({
      url: options.url,
      authToken: options.authToken,
      cwd: io.cwd,
      env: io.env,
    });
    const client = io.createClient(connection);
    await client.connect();
    const liveGroups = await client.getGroups();
    const tagged = new Set(set.groups.map((g) => g.name));
    const untagged = liveGroups
      .map((g) => g.name)
      .filter((name) => !tagged.has(name))
      .sort((a, b) => a.localeCompare(b));

    io.out('');
    if (untagged.length === 0) {
      io.out(chalk.green('All live groups are present in the tags file.'));
    } else {
      io.out(
        chalk.yellow(
          `${untagged.length} live group(s) missing from the tags file: ` +
            `${untagged.join(', ')}.`,
        ),
      );
      io.out(chalk.dim('Run "monitor-tagger sync" to add them.'));
    }
  }

  return 0;
}
