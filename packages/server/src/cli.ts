#!/usr/bin/env node
import { MonitorToolError } from '@rgm-power-tools/core';
import { resolveServerConfig, ServerConfigError } from './config.js';
import { createServer } from './server.js';
import { isPublicHost } from './config.js';

const VERSION = '0.1.0';

const HELP = `monitor-dashboard ${VERSION}
Self-hostable dashboard and JSON API for the RGM Power Tools.

Usage:
  monitor-dashboard [options]

Options:
  --host <host>        interface to bind (default: 127.0.0.1)
  --port <port>        TCP port (default: 4570)
  --token <token>      dashboard bearer token (or set DASHBOARD_TOKEN)
  --workdir <dir>      where monitor-config.yaml / monitor-tags.yaml live
  --no-auth            run without a token (loopback only; for local dev)
  -V, --version        print version
  -h, --help           show this help

Environment:
  DASHBOARD_TOKEN, DASHBOARD_HOST, DASHBOARD_PORT, RGM_WORKDIR,
  MONITOR_URL, MONITOR_AUTH_TOKEN
`;

interface ParsedArgs {
  host?: string;
  port?: string;
  token?: string;
  workdir?: string;
  noAuth?: boolean;
  help?: boolean;
  version?: boolean;
}

function parseArgs(argv: string[]): ParsedArgs {
  const args: ParsedArgs = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '--host':
        args.host = argv[++i];
        break;
      case '--port':
        args.port = argv[++i];
        break;
      case '--token':
        args.token = argv[++i];
        break;
      case '--workdir':
        args.workdir = argv[++i];
        break;
      case '--no-auth':
        args.noAuth = true;
        break;
      case '-V':
      case '--version':
        args.version = true;
        break;
      case '-h':
      case '--help':
        args.help = true;
        break;
      default:
        throw new ServerConfigError(`Unknown argument: ${arg}`);
    }
  }
  return args;
}

function main(): void {
  let args: ParsedArgs;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(`✗ ${(err as Error).message}`);
    console.error('Run with --help for usage.');
    process.exitCode = 1;
    return;
  }

  if (args.help) {
    console.log(HELP);
    return;
  }
  if (args.version) {
    console.log(VERSION);
    return;
  }

  let config;
  try {
    config = resolveServerConfig({
      host: args.host,
      port: args.port,
      token: args.token,
      workdir: args.workdir,
      allowNoAuth: args.noAuth,
    });
  } catch (err) {
    if (err instanceof MonitorToolError) {
      console.error(`✗ ${err.message}`);
      process.exitCode = 1;
      return;
    }
    throw err;
  }

  const server = createServer({ config });
  server.listen(config.port, config.host, () => {
    const auth = config.token ? 'token auth enabled' : 'AUTH DISABLED';
    console.log(
      `RGM Power Tools dashboard listening on http://${config.host}:${config.port} (${auth})`,
    );
    console.log(`Working directory: ${config.workdir}`);
    if (!config.token) {
      console.warn(
        '⚠  Running without a token. Anyone who can reach this port can drive ' +
          'your Monitor instance. Use only on a trusted local machine.',
      );
    }
    if (isPublicHost(config.host)) {
      console.warn(
        `⚠  Bound to ${config.host} — the dashboard is reachable off-host. ` +
          'Ensure it sits behind TLS/a reverse proxy and a strong token.',
      );
    }
  });
}

main();
