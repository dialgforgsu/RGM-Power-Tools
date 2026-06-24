import { MonitorToolError } from '@rgm-power-tools/core';

/** Raised for invalid/unsafe server configuration. */
export class ServerConfigError extends MonitorToolError {}

export interface ServerConfig {
  /** Interface to bind. Defaults to 127.0.0.1 (loopback only). */
  host: string;
  /** TCP port. Defaults to 4570. */
  port: number;
  /**
   * Bearer token the dashboard/API requires. Empty string means auth is
   * disabled — only allowed when {@link allowNoAuth} is explicitly set.
   */
  token: string;
  /** Working directory where monitor-config.yaml / monitor-tags.yaml live. */
  workdir: string;
  /** Whether running without a token is permitted (dangerous; localhost dev). */
  allowNoAuth: boolean;
}

export interface ServerConfigInput {
  host?: string;
  port?: number | string;
  token?: string;
  workdir?: string;
  allowNoAuth?: boolean;
  env?: NodeJS.ProcessEnv;
}

const DEFAULT_PORT = 4570;
const DEFAULT_HOST = '127.0.0.1';

/** Hosts that expose the dashboard beyond the local machine. */
function isPublicHost(host: string): boolean {
  return host !== '127.0.0.1' && host !== 'localhost' && host !== '::1';
}

/**
 * Resolve server configuration from flags then environment, applying safe
 * defaults. Throws {@link ServerConfigError} on unsafe combinations — most
 * importantly, refusing to start without a token unless explicitly allowed, and
 * never allowing a token-less server to bind a public interface.
 */
export function resolveServerConfig(input: ServerConfigInput = {}): ServerConfig {
  const env = input.env ?? process.env;

  const host = input.host ?? env.DASHBOARD_HOST ?? DEFAULT_HOST;

  const rawPort = input.port ?? env.DASHBOARD_PORT ?? DEFAULT_PORT;
  const port = typeof rawPort === 'string' ? Number(rawPort) : rawPort;
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new ServerConfigError(`Invalid port: ${String(rawPort)}.`);
  }

  const token = (input.token ?? env.DASHBOARD_TOKEN ?? '').trim();
  const allowNoAuth = input.allowNoAuth ?? env.DASHBOARD_ALLOW_NO_AUTH === 'true';
  const workdir = input.workdir ?? env.RGM_WORKDIR ?? process.cwd();

  if (!token) {
    if (!allowNoAuth) {
      throw new ServerConfigError(
        'No dashboard token set. Set DASHBOARD_TOKEN (or --token) to a strong ' +
          'secret. To run without auth on a trusted local machine, pass ' +
          '--no-auth explicitly.',
      );
    }
    if (isPublicHost(host)) {
      throw new ServerConfigError(
        `Refusing to bind ${host} without a token. A token-less server must ` +
          'stay on loopback (127.0.0.1). Set DASHBOARD_TOKEN to expose it.',
      );
    }
  } else if (token.length < 16) {
    throw new ServerConfigError(
      'DASHBOARD_TOKEN is too short; use at least 16 characters.',
    );
  }

  return { host, port, token, workdir, allowNoAuth };
}

export { isPublicHost };
