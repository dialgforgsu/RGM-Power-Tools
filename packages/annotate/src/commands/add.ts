import chalk from 'chalk';
import { resolveConnection } from '@rgm-power-tools/core';
import { AnnotateError } from '../types.js';
import type { CliIO } from '../io.js';

export interface AddOptions {
  text?: string;
  object?: string;
  author?: string;
  time?: string;
  url?: string;
  authToken?: string;
}

/**
 * Post a single annotation to the Monitor timeline — handy at the end of a
 * deploy pipeline that prefers a CLI call over a webhook.
 */
export async function runAdd(options: AddOptions, io: CliIO): Promise<number> {
  if (!options.text || !options.text.trim()) {
    throw new AnnotateError('--text is required.');
  }

  const connection = resolveConnection({
    url: options.url,
    authToken: options.authToken,
    cwd: io.cwd,
    env: io.env,
  });
  const client = io.createClient(connection);
  await client.connect();

  await client.createAnnotation({
    text: options.text,
    ...(options.object ? { object: options.object } : {}),
    ...(options.author ? { author: options.author } : {}),
    ...(options.time ? { createdUtc: options.time } : {}),
  });

  io.out(chalk.green('✓ Annotation added to the Monitor timeline.'));
  return 0;
}
