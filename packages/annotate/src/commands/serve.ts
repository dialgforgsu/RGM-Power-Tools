import chalk from 'chalk';
import { resolveConnection } from '@rgm-power-tools/core';
import { resolveReceiverConfig } from '../config.js';
import { createWebhookHandler } from '../handler.js';
import { createReceiver } from '../server.js';
import type { CliIO } from '../io.js';

export interface ServeOptions {
  host?: string;
  port?: string;
  secret?: string;
  url?: string;
  authToken?: string;
}

/**
 * Run the webhook receiver: listens for deploy/CI webhooks, verifies them
 * against the shared secret, and writes annotations to Monitor. Stays running.
 */
export async function runServe(options: ServeOptions, io: CliIO): Promise<number> {
  const config = resolveReceiverConfig({
    host: options.host,
    port: options.port,
    secret: options.secret,
    env: io.env,
  });

  const connection = resolveConnection({
    url: options.url,
    authToken: options.authToken,
    cwd: io.cwd,
    env: io.env,
  });
  const client = io.createClient(connection);
  await client.connect();

  const handler = createWebhookHandler({
    secret: config.secret,
    writeAnnotation: (input) => client.createAnnotation(input),
  });
  const server = createReceiver({ handler });

  await new Promise<void>((resolvePromise) => {
    server.listen(config.port, config.host, () => {
      io.out(
        chalk.green(
          `monitor-annotate receiver listening on http://${config.host}:${config.port}`,
        ),
      );
      io.out(
        chalk.dim(
          'Endpoints: POST /webhook/{github|gitlab|generic}, GET /health',
        ),
      );
      io.out(
        chalk.yellow(
          '⚠  Put this behind TLS / a reverse proxy — webhooks carry the shared secret.',
        ),
      );
      resolvePromise();
    });
  });
  return 0;
}
