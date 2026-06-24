import {
  PowerShellMonitorClient,
  type MonitorClient,
  type MonitorConnection,
} from '@rgm-power-tools/core';

/**
 * Everything a command touches in the outside world, behind one injectable
 * interface — mirroring `monitor-config`'s CliIO so the two tools feel the same
 * and tests can supply fakes (captured output, a mock client) with no real I/O.
 */
export interface CliIO {
  out(msg?: string): void;
  err(msg?: string): void;
  cwd: string;
  env: NodeJS.ProcessEnv;
  /** Construct a Monitor client for the given connection. */
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
