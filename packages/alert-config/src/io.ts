import { createInterface } from 'node:readline/promises';
import {
  PowerShellMonitorClient,
  type MonitorClient,
  type MonitorConnection,
} from '@rgm-power-tools/core';

/**
 * Everything a command touches in the outside world, behind one injectable
 * interface. The CLI provides a real implementation; tests provide fakes (a
 * mock client, captured output, scripted confirmations) with no I/O.
 */
export interface CliIO {
  out(msg?: string): void;
  err(msg?: string): void;
  /** Prompt for a yes/no confirmation. Resolves true if the user approves. */
  confirm(question: string): Promise<boolean>;
  cwd: string;
  env: NodeJS.ProcessEnv;
  /** Construct a Monitor client for the given connection. */
  createClient(connection: MonitorConnection): MonitorClient;
}

export interface DefaultIOOptions {
  /** Force confirmations to auto-approve (used by `--yes`). */
  autoConfirm?: boolean;
}

/** The production {@link CliIO}: stdout/stderr, readline, real Monitor client. */
export function defaultIO(options: DefaultIOOptions = {}): CliIO {
  return {
    out: (msg = '') => console.log(msg),
    err: (msg = '') => console.error(msg),
    cwd: process.cwd(),
    env: process.env,
    createClient: (connection) => new PowerShellMonitorClient(connection),
    async confirm(question: string): Promise<boolean> {
      if (options.autoConfirm) return true;
      const rl = createInterface({
        input: process.stdin,
        output: process.stdout,
      });
      try {
        const answer = (await rl.question(`${question} [y/N] `))
          .trim()
          .toLowerCase();
        return answer === 'y' || answer === 'yes';
      } finally {
        rl.close();
      }
    },
  };
}
