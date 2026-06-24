import chalk from 'chalk';
import Table from 'cli-table3';
import { KNOWN_TAG_KEYS, type TaggedGroup } from '@rgm-power-tools/core';

/** Pretty header for a tag key: `business_unit` -> `Business Unit`. */
function humanize(key: string): string {
  return key
    .split('_')
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ');
}

/**
 * Render groups and their tags as a table. Columns are the well-known
 * dimensions that appear in the data, followed by any custom keys. `out`
 * receives the whole table as one multi-line string.
 */
export function renderTagTable(
  groups: readonly TaggedGroup[],
  out: (msg?: string) => void,
): void {
  if (groups.length === 0) {
    out(chalk.yellow('No groups to show.'));
    return;
  }

  // Determine which tag columns to show: known keys present anywhere, then any
  // custom keys present, alphabetically.
  const present = new Set<string>();
  for (const g of groups) for (const k of Object.keys(g.tags)) present.add(k);

  const known = KNOWN_TAG_KEYS.filter((k) => present.has(k));
  const custom = [...present]
    .filter((k) => !(KNOWN_TAG_KEYS as readonly string[]).includes(k))
    .sort();
  const columns = [...known, ...custom];

  const table = new Table({
    head: [chalk.bold('Group'), ...columns.map((c) => chalk.bold(humanize(c)))],
    style: { head: [], border: [] },
  });

  for (const g of groups) {
    table.push([
      g.name,
      ...columns.map((c) => g.tags[c] ?? chalk.dim('—')),
    ]);
  }

  out(table.toString());
}
