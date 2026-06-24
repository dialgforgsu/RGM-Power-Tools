import {
  PowerShellMonitorClient,
  type MonitorClient,
  type MonitorConnection,
} from '@rgm-power-tools/core';

/**
 * Outside-world surface for the replay command, behind one injectable interface
 * — same shape as the other tools, so tests supply fakes (captured output, a
 * mock client) with no real I/O.
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
