#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import { MonitorToolError } from '@rgm-power-tools/core';
import { defaultIO, type CliIO } from './io.js';
import { runCheck } from './commands/check.js';
import { runList } from './commands/list.js';
import type { Severity } from './types.js';

const VERSION = '0.1.0';
const SEVERITIES: Severity[] = ['info', 'warning', 'error'];

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

function collect(value: string, previous: string[]): string[] {
  return [...previous, value];
}

const program = new Command();

program
  .name('monitor-doctor')
  .description(
    'A linter for your Redgate Monitor installation — finds silent servers, ' +
      'alerts with no notifications, stale custom metrics, and wasted licenses.',
  )
  .version(VERSION, '-V, --version', 'output the version number')
  .option('--verbose', 'show full error details and stack traces', false);

program
  .command('check', { isDefault: true })
  .description('Audit the Monitor installation and report problems.')
  .option('--check <id>', 'run only this check (repeatable)', collect, [])
  .option(
    '--fail-on <severity>',
    'exit non-zero if a finding is at or above this level (info|warning|error)',
    'error',
  )
  .option('--json', 'output machine-readable JSON', false)
  .option('--url <url>', 'Monitor base URL (overrides env/file)')
  .option('--auth-token <token>', 'Monitor auth token (overrides env/file)')
  .action((opts) => {
    if (!SEVERITIES.includes(opts.failOn)) {
      console.error(
        `✗ Invalid --fail-on "${opts.failOn}". Use one of: ${SEVERITIES.join(', ')}.`,
      );
      process.exitCode = 1;
      return;
    }
    return wrap((io) =>
      runCheck(
        {
          check: opts.check,
          failOn: opts.failOn as Severity,
          json: opts.json,
          url: opts.url,
          authToken: opts.authToken,
        },
        io,
      ),
    )();
  });

program
  .command('list')
  .description('List the available checks. No network calls.')
  .action(() => wrap((io) => runList(io))());

program.parseAsync(process.argv);
