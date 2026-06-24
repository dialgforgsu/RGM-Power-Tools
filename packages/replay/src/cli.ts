#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import { MonitorToolError } from '@rgm-power-tools/core';
import { defaultIO, type CliIO } from './io.js';
import { runGenerate } from './commands/generate.js';

const VERSION = '0.1.0';

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

const program = new Command();

program
  .name('monitor-replay')
  .description(
    'Forensic post-mortem generator for Redgate Monitor — turn an incident ' +
      'time window into a pre-filled markdown report.',
  )
  .version(VERSION, '-V, --version', 'output the version number')
  .option('--verbose', 'show full error details and stack traces', false);

program
  .command('generate', { isDefault: true })
  .description('Generate a markdown post-mortem for an incident window.')
  .option('--from <iso>', 'window start (ISO-8601), e.g. 2026-06-24T01:00:00Z')
  .option('--to <iso>', 'window end (ISO-8601)')
  .option('--last <duration>', 'window ending now, e.g. 90m, 2h, 1d')
  .option('--title <title>', 'post-mortem title')
  .option('-o, --output <file>', 'write markdown to a file (default: stdout)')
  .option('--url <url>', 'Monitor base URL (overrides env/file)')
  .option('--auth-token <token>', 'Monitor auth token (overrides env/file)')
  .action((opts) =>
    wrap((io) =>
      runGenerate(
        {
          from: opts.from,
          to: opts.to,
          last: opts.last,
          title: opts.title,
          output: opts.output,
          url: opts.url,
          authToken: opts.authToken,
        },
        io,
      ),
    )(),
  );

program.parseAsync(process.argv);
