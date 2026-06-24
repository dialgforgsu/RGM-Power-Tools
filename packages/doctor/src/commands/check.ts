import { resolveConnection } from '@rgm-power-tools/core';
import { gatherSnapshot } from '../snapshot.js';
import { runChecks, hasFindingsAtOrAbove } from '../run.js';
import { renderReport } from '../output.js';
import type { Severity } from '../types.js';
import type { CliIO } from '../io.js';

export interface CheckOptions {
  /** Restrict to these check ids. */
  check?: string[];
  /** Exit non-zero if a finding at or above this severity exists. Default error. */
  failOn?: Severity;
  /** Emit machine-readable JSON instead of the human report. */
  json?: boolean;
  url?: string;
  authToken?: string;
}

/**
 * Audit the Monitor installation. Connects, gathers a snapshot, runs the
 * selected checks, prints the report, and returns an exit code: non-zero when a
 * finding meets the `--fail-on` threshold (default `error`), like `npm audit`.
 */
export async function runCheck(
  options: CheckOptions,
  io: CliIO,
): Promise<number> {
  const connection = resolveConnection({
    url: options.url,
    authToken: options.authToken,
    cwd: io.cwd,
    env: io.env,
  });
  const client = io.createClient(connection);
  await client.connect();

  const snapshot = await gatherSnapshot(client);
  const report = runChecks(snapshot, { checks: options.check });

  if (options.json) {
    io.out(JSON.stringify(report, null, 2));
  } else {
    renderReport(report, io.out);
  }

  const failOn = options.failOn ?? 'error';
  return hasFindingsAtOrAbove(report, failOn) ? 1 : 0;
}
