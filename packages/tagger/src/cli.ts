#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import { MonitorToolError } from '@rgm-power-tools/core';
import { defaultIO, type CliIO } from './io.js';
import { runInit } from './commands/init.js';
import { runValidate } from './commands/validate.js';
import { runList } from './commands/list.js';
import { runSync } from './commands/sync.js';

const VERSION = '0.1.0';

/** Render any thrown error as a friendly message; full detail only with --verbose. */
function renderError(err: unknown, verbose: boolean, io: CliIO): void {
  if (err instanceof MonitorToolError) {
    io.err(chalk.red(`✗ ${err.message}`));
    if (verbose && err.cause) {
      const cause = err.cause;
      io.err(
        chalk.dim(
          cause instanceof Error ? (cause.stack ?? cause.message) : String(cause),
        ),
      );
    }
  } else {
    const e = err as Error;
    io.err(chalk.red(`✗ Unexpected error: ${e?.message ?? String(err)}`));
    if (verbose) io.err(chalk.dim(e?.stack ?? ''));
    else io.err(chalk.dim('Run again with --verbose for the full stack trace.'));
  }
}

/** Wrap a command body so all errors funnel through {@link renderError}. */
function wrap(run: (io: CliIO) => Promise<number>): () => Promise<void> {
  return async () => {
    const verbose = Boolean(program.opts().verbose);
    const io = defaultIO();
    try {
      process.exitCode = await run(io);
    } catch (err) {
      renderError(err, verbose, io);
      process.exitCode = 1;
    }
  };
}

/** Collect a repeatable option (`--filter a=b --filter c=d`) into an array. */
function collect(value: string, previous: string[]): string[] {
  return [...previous, value];
}

const program = new Command();

program
  .name('monitor-tagger')
  .description(
    'Tags as Code for Redgate Monitor — attach owner, business unit, ' +
      'criticality, and cost center metadata to Monitor groups as YAML.',
  )
  .version(VERSION, '-V, --version', 'output the version number')
  .option('--verbose', 'show full error details and stack traces', false);

program
  .command('init')
  .description('Scaffold a starter monitor-tags.yaml.')
  .option('--force', 'overwrite an existing tags file', false)
  .action((opts) => wrap((io) => runInit({ force: opts.force }, io))());

program
  .command('validate')
  .description('Schema-check a tags file. No network calls.')
  .argument('[file]', 'tags file to validate', undefined)
  .action((file) => wrap((io) => runValidate({ file }, io))());

program
  .command('list')
  .description('List groups and their tags, optionally filtered by tag.')
  .option('-f, --file <file>', 'tags file (default: monitor-tags.yaml)')
  .option(
    '--filter <key=value>',
    'filter by tag (repeatable; same key ORs, different keys AND)',
    collect,
    [],
  )
  .option('--group <name>', 'show only this group')
  .option('--live', 'cross-check against live Monitor groups', false)
  .option('--url <url>', 'Monitor base URL (overrides env/file)')
  .option('--auth-token <token>', 'Monitor auth token (overrides env/file)')
  .action((opts) =>
    wrap((io) =>
      runList(
        {
          file: opts.file,
          filter: opts.filter,
          group: opts.group,
          live: opts.live,
          url: opts.url,
          authToken: opts.authToken,
        },
        io,
      ),
    )(),
  );

program
  .command('sync')
  .description('Scaffold/refresh tag entries from live Monitor groups.')
  .option('-f, --file <file>', 'tags file (default: monitor-tags.yaml)')
  .option('--dry-run', 'show what would change without writing', false)
  .option('--url <url>', 'Monitor base URL (overrides env/file)')
  .option('--auth-token <token>', 'Monitor auth token (overrides env/file)')
  .action((opts) =>
    wrap((io) =>
      runSync(
        {
          file: opts.file,
          dryRun: opts.dryRun,
          url: opts.url,
          authToken: opts.authToken,
        },
        io,
      ),
    )(),
  );

program.parseAsync(process.argv);
