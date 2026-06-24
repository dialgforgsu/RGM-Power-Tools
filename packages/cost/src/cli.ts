#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import { MonitorToolError } from '@rgm-power-tools/core';
import { defaultIO, type CliIO } from './io.js';
import { runReport } from './commands/report.js';
import { runProject } from './commands/project.js';

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
  .name('monitor-cost')
  .description(
    'License utilization & spend audit for Redgate Monitor — find wasted ' +
      'slots and project the cost of onboarding more servers.',
  )
  .version(VERSION, '-V, --version', 'output the version number')
  .option('--verbose', 'show full error details and stack traces', false);

program
  .command('report', { isDefault: true })
  .description('Audit license utilization and surface wasted slots.')
  .option('--idle-days <n>', 'days without data before a slot is "wasted"', '30')
  .option(
    '--cost-per-slot <amount>',
    'cost per licensed slot (or set MONITOR_COST_PER_SLOT) to show spend',
  )
  .option('--currency <label>', 'currency/unit label for spend figures')
  .option('--json', 'output machine-readable JSON', false)
  .option('--fail-on-waste', 'exit non-zero if any wasted slots are found', false)
  .option('--url <url>', 'Monitor base URL (overrides env/file)')
  .option('--auth-token <token>', 'Monitor auth token (overrides env/file)')
  .action((opts) =>
    wrap((io) =>
      runReport(
        {
          idleDays: opts.idleDays,
          costPerSlot: opts.costPerSlot,
          currency: opts.currency,
          json: opts.json,
          failOnWaste: opts.failOnWaste,
          url: opts.url,
          authToken: opts.authToken,
        },
        io,
      ),
    )(),
  );

program
  .command('project')
  .description('Project the license cost of onboarding more servers.')
  .requiredOption('--add <n>', 'number of new servers to onboard')
  .option(
    '--cost-per-slot <amount>',
    'cost per licensed slot (or set MONITOR_COST_PER_SLOT)',
  )
  .option('--currency <label>', 'currency/unit label for spend figures')
  .option('--json', 'output machine-readable JSON', false)
  .option('--url <url>', 'Monitor base URL (overrides env/file)')
  .option('--auth-token <token>', 'Monitor auth token (overrides env/file)')
  .action((opts) =>
    wrap((io) =>
      runProject(
        {
          add: opts.add,
          costPerSlot: opts.costPerSlot,
          currency: opts.currency,
          json: opts.json,
          url: opts.url,
          authToken: opts.authToken,
        },
        io,
      ),
    )(),
  );

program.parseAsync(process.argv);
