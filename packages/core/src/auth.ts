import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { AuthError } from './errors.js';
import type { MonitorConnection } from './types.js';

/** Sources for connection details, highest priority first. */
export interface AuthOptions {
  /** From CLI flags (`--url`, `--auth-token`). Highest priority. */
  url?: string;
  authToken?: string;
  /** Working directory to look for `.monitor-config.json` in. */
  cwd?: string;
  /** Environment to read from (defaults to `process.env`). */
  env?: NodeJS.ProcessEnv;
}

interface LocalConfigFile {
  url?: string;
  authToken?: string;
  // Also accept snake_case for friendliness with the YAML conventions.
  base_monitor_url?: string;
  auth_token?: string;
}

const LOCAL_CONFIG_FILENAME = '.monitor-config.json';

/**
 * Resolve Monitor connection details from (in priority order):
 *   1. explicit options (CLI flags)
 *   2. environment variables MONITOR_URL / MONITOR_AUTH_TOKEN
 *   3. a `.monitor-config.json` file in the working directory
 *
 * Throws {@link AuthError} if either value cannot be resolved.
 */
export function resolveConnection(
  options: AuthOptions = {},
): MonitorConnection {
  const env = options.env ?? process.env;
  const cwd = options.cwd ?? process.cwd();

  const fileConfig = readLocalConfig(cwd);

  const baseUrl =
    options.url ??
    env.MONITOR_URL ??
    fileConfig?.url ??
    fileConfig?.base_monitor_url;

  const authToken =
    options.authToken ??
    env.MONITOR_AUTH_TOKEN ??
    fileConfig?.authToken ??
    fileConfig?.auth_token;

  if (!baseUrl) {
    throw new AuthError(
      'No Monitor URL configured. Set --url, the MONITOR_URL environment ' +
        `variable, or "url" in ${LOCAL_CONFIG_FILENAME}.`,
    );
  }
  if (!authToken) {
    throw new AuthError(
      'No auth token configured. Set --auth-token, the MONITOR_AUTH_TOKEN ' +
        `environment variable, or "authToken" in ${LOCAL_CONFIG_FILENAME}.`,
    );
  }

  return { baseUrl: stripTrailingSlash(baseUrl), authToken };
}

function readLocalConfig(cwd: string): LocalConfigFile | undefined {
  const path = resolve(cwd, LOCAL_CONFIG_FILENAME);
  if (!existsSync(path)) return undefined;
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as LocalConfigFile;
  } catch (cause) {
    throw new AuthError(
      `Could not parse ${LOCAL_CONFIG_FILENAME}: invalid JSON.`,
      {
        cause,
      },
    );
  }
}

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

/**
 * Redact a token for safe display. We never log the raw token anywhere; if a
 * token must be shown (e.g. confirming which one is in use) this masks it.
 */
export function redactToken(token: string): string {
  if (token.length <= 8) return '****';
  return `${token.slice(0, 4)}…${token.slice(-2)}`;
}
