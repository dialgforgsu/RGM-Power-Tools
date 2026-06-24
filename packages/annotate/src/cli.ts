#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import { MonitorToolError } from '@rgm-power-tools/core';
import { defaultIO, type CliIO } from './io.js';
import { runAdd } from './commands/add.js';
import { runServe } from './commands/serve.js';

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
  .name('monitor-annotate')
  .description(
    'Auto-annotate the Redgate Monitor timeline from deploy/CI webhooks, so ' +
      'incidents always have "what changed?" context.',
  )
  .version(VERSION, '-V, --version', 'output the version number')
  .option('--verbose', 'show full error details and stack traces', false);

program
  .command('add')
  .description('Post a single annotation (e.g. at the end of a deploy script).')
  .requiredOption('--text <text>', 'annotation text')
  .option('--object <name>', 'monitored object to attach to')
  .option('--author <name>', 'annotation author')
  .option('--time <iso>', 'annotation time (ISO-8601; default: now)')
  .option('--url <url>', 'Monitor base URL (overrides env/file)')
  .option('--auth-token <token>', 'Monitor auth token (overrides env/file)')
  .action((opts) =>
    wrap((io) =>
      runAdd(
        {
          text: opts.text,
          object: opts.object,
          author: opts.author,
          time: opts.time,
          url: opts.url,
          authToken: opts.authToken,
        },
        io,
      ),
    )(),
  );

program
  .command('serve')
  .description('Run the webhook receiver (github/gitlab/generic).')
  .option('--host <host>', 'interface to bind (default: 0.0.0.0)')
  .option('--port <port>', 'TCP port (default: 4575)')
  .option('--secret <secret>', 'webhook secret (or set ANNOTATE_WEBHOOK_SECRET)')
  .option('--url <url>', 'Monitor base URL (overrides env/file)')
  .option('--auth-token <token>', 'Monitor auth token (overrides env/file)')
  .action((opts) =>
    wrap((io) =>
      runServe(
        {
          host: opts.host,
          port: opts.port,
          secret: opts.secret,
          url: opts.url,
          authToken: opts.authToken,
        },
        io,
      ),
    )(),
  );

program.parseAsync(process.argv);
