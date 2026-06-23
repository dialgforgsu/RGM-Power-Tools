#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import { MonitorToolError } from '@redgate-power-tools/core';
import { defaultIO, type CliIO } from './io.js';
import { ConfigValidationError } from './errors.js';
import { renderValidationIssues } from './output.js';
import { runValidate } from './commands/validate.js';
import { runInit } from './commands/init.js';
import { runExport } from './commands/export.js';
import { runDiff } from './commands/diff.js';
import { runApply } from './commands/apply.js';

const VERSION = '0.1.0';

/** Render any thrown error as a friendly message; full detail only with --verbose. */
function renderError(err: unknown, verbose: boolean, io: CliIO): void {
  if (err instanceof ConfigValidationError) {
    io.err(chalk.red(`✗ ${err.message}`));
    renderValidationIssues(err.issues, io.err);
  } else if (err instanceof MonitorToolError) {
    io.err(chalk.red(`✗ ${err.message}`));
    if (verbose && err.cause) {
      const cause = err.cause;
      io.err(
        chalk.dim(
          cause instanceof Error
            ? (cause.stack ?? cause.message)
            : String(cause),
        ),
      );
    }
  } else {
    const e = err as Error;
    io.err(chalk.red(`✗ Unexpected error: ${e?.message ?? String(err)}`));
    if (verbose) io.err(chalk.dim(e?.stack ?? ''));
    else
      io.err(chalk.dim('Run again with --verbose for the full stack trace.'));
  }
}

/** Wrap a command body so all errors funnel through {@link renderError}. */
function wrap(
  run: (io: CliIO) => Promise<number>,
  ioOptions: { autoConfirm?: boolean } = {},
): () => Promise<void> {
  return async () => {
    const verbose = Boolean(program.opts().verbose);
    const io = defaultIO(ioOptions);
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
  .name('monitor-config')
  .description(
    'Alert Config as Code for Redgate Monitor — treat alert settings as ' +
      'version-controlled YAML.',
  )
  .version(VERSION, '-V, --version', 'output the version number')
  .option('--verbose', 'show full error details and stack traces', false);

program
  .command('init')
  .description(
    'Scaffold a new config repo (starter YAML, .gitignore, local config).',
  )
  .option('--force', 'overwrite existing files', false)
  .action((opts) => wrap((io) => runInit({ force: opts.force }, io))());

program
  .command('validate')
  .description('Schema-check a config file. No network calls.')
  .argument('[file]', 'config file to validate', undefined)
  .action((file) => wrap((io) => runValidate({ file }, io))());

program
  .command('export')
  .description('Pull live alert settings from Monitor into YAML.')
  .option('-o, --output <file>', 'output path (default: monitor-config.yaml)')
  .option('--group <name>', 'export only this group')
  .option('--url <url>', 'Monitor base URL (overrides env/file)')
  .option('--auth-token <token>', 'Monitor auth token (overrides env/file)')
  .action((opts) =>
    wrap((io) =>
      runExport(
        {
          output: opts.output,
          group: opts.group,
          url: opts.url,
          authToken: opts.authToken,
        },
        io,
      ),
    )(),
  );

program
  .command('diff')
  .description(
    'Compare configs: local vs live, or two YAML files. Exit 1 if differences.',
  )
  .option('--source <yaml>', 'source config (default: monitor-config.yaml)')
  .option('--target <yaml-or-live>', 'target config or "live" (default: live)')
  .option('--url <url>', 'Monitor base URL (overrides env/file)')
  .option('--auth-token <token>', 'Monitor auth token (overrides env/file)')
  .action((opts) =>
    wrap((io) =>
      runDiff(
        {
          source: opts.source,
          target: opts.target,
          url: opts.url,
          authToken: opts.authToken,
        },
        io,
      ),
    )(),
  );

program
  .command('apply')
  .description(
    'Push local YAML into Monitor idempotently, after showing a plan.',
  )
  .option('--dry-run', 'show the plan and exit without applying', false)
  .option('-y, --yes', 'skip the confirmation prompt', false)
  .option('--url <url>', 'Monitor base URL (overrides env/file)')
  .option('--auth-token <token>', 'Monitor auth token (overrides env/file)')
  .action((opts) =>
    wrap(
      (io) =>
        runApply(
          {
            dryRun: opts.dryRun,
            yes: opts.yes,
            url: opts.url,
            authToken: opts.authToken,
          },
          io,
        ),
      { autoConfirm: Boolean(opts.yes) },
    )(),
  );

program.parseAsync(process.argv);
