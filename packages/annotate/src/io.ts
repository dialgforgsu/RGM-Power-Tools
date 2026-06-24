import {
  PowerShellMonitorClient,
  type MonitorClient,
  type MonitorConnection,
} from '@rgm-power-tools/core';

/**
 * Outside-world surface for the annotate commands, behind one injectable
 * interface — same shape as the other tools, so tests supply fakes.
 */
export interface CliIO {
  out(msg?: string): void;
  err(msg?: string): void;
  cwd: string;
  env: NodeJS.ProcessEnv;
  createClient(connection: MonitorConnection): MonitorClient;
}

/** The production {@link CliIO}: stdout/stderr and a real Monitor client. */
export function defaultIO(): CliIO {
  return {
    out: (msg = '') => console.log(msg),
    err: (msg = '') => console.error(msg),
    cwd: process.cwd(),
    env: process.env,
    createClient: (connection) => new PowerShellMonitorClient(connection),
  };
}
