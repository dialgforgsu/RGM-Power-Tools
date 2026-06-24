import { MonitorToolError } from '@rgm-power-tools/core';

/** Raised for invalid receiver configuration. */
export class AnnotateConfigError extends MonitorToolError {}

export interface ReceiverConfig {
  host: string;
  port: number;
  /** Shared secret used to verify every webhook. */
  secret: string;
}

export interface ReceiverConfigInput {
  host?: string;
  port?: number | string;
  secret?: string;
  env?: NodeJS.ProcessEnv;
}

const DEFAULT_PORT = 4575;
const DEFAULT_HOST = '0.0.0.0';

/**
 * Resolve the webhook receiver config from flags then environment. A secret is
 * mandatory — the receiver writes to Monitor, so it never runs unauthenticated.
 */
export function resolveReceiverConfig(
  input: ReceiverConfigInput = {},
): ReceiverConfig {
  const env = input.env ?? process.env;

  const host = input.host ?? env.ANNOTATE_HOST ?? DEFAULT_HOST;

  const rawPort = input.port ?? env.ANNOTATE_PORT ?? DEFAULT_PORT;
  const port = typeof rawPort === 'string' ? Number(rawPort) : rawPort;
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new AnnotateConfigError(`Invalid port: ${String(rawPort)}.`);
  }

  const secret = (input.secret ?? env.ANNOTATE_WEBHOOK_SECRET ?? '').trim();
  if (!secret) {
    throw new AnnotateConfigError(
      'No webhook secret set. Set ANNOTATE_WEBHOOK_SECRET (or --secret) to a ' +
        'strong value; the receiver verifies every webhook against it.',
    );
  }
  if (secret.length < 16) {
    throw new AnnotateConfigError(
      'ANNOTATE_WEBHOOK_SECRET is too short; use at least 16 characters.',
    );
  }

  return { host, port, secret };
}
