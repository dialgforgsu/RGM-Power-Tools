import chalk from 'chalk';
import type { DiffResult, FieldChange } from './diff-engine.js';
import type { ValidationIssue } from './errors.js';

function formatValue(value: unknown): string {
  if (value === undefined) return '(unset)';
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

function formatChange(change: FieldChange): string {
  switch (change.kind) {
    case 'added':
      return chalk.green(`  + ${change.path} = ${formatValue(change.to)}`);
    case 'removed':
      return chalk.red(`  - ${change.path} = ${formatValue(change.from)}`);
    case 'changed':
      return chalk.yellow(
        `  ~ ${change.path}: ${formatValue(change.from)} -> ${formatValue(change.to)}`,
      );
  }
}

/** Render a diff report. `out` receives one line at a time. */
export function renderDiff(
  result: DiffResult,
  out: (msg?: string) => void,
  labels: { source: string; target: string },
): void {
  if (!result.hasChanges) {
    out(chalk.green('No differences. Configurations are in sync.'));
    return;
  }

  out(chalk.bold(`Diff: ${labels.source} -> ${labels.target}`));
  out('');
  for (const group of result.groups) {
    if (group.status === 'added') {
      out(chalk.green(`+ group "${group.name}" (only in ${labels.target})`));
      continue;
    }
    if (group.status === 'removed') {
      out(chalk.red(`- group "${group.name}" (only in ${labels.source})`));
      continue;
    }
    out(chalk.bold(`~ group "${group.name}"`));
    for (const change of group.changes) out(formatChange(change));
    out('');
  }

  const counts = summarize(result);
  out(
    `${chalk.green(`${counts.added} added`)}, ` +
      `${chalk.yellow(`${counts.changed} changed`)}, ` +
      `${chalk.red(`${counts.removed} removed`)}.`,
  );
}

function summarize(result: DiffResult) {
  let added = 0;
  let changed = 0;
  let removed = 0;
  for (const group of result.groups) {
    if (group.status === 'added') added++;
    else if (group.status === 'removed') removed++;
    for (const c of group.changes) {
      if (c.kind === 'added') added++;
      else if (c.kind === 'changed') changed++;
      else removed++;
    }
  }
  return { added, changed, removed };
}

/** Render schema validation issues with line numbers where available. */
export function renderValidationIssues(
  issues: ValidationIssue[],
  out: (msg?: string) => void,
): void {
  for (const issue of issues) {
    const loc =
      issue.line !== undefined
        ? chalk.dim(
            `line ${issue.line}${issue.column ? `:${issue.column}` : ''}`,
          )
        : chalk.dim(issue.path);
    out(`  ${chalk.red('✗')} ${loc}  ${issue.message}`);
  }
}
