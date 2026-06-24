import { resolve } from 'node:path';
import { writeFileSync } from 'node:fs';
import chalk from 'chalk';
import { resolveConnection } from '@rgm-power-tools/core';
import { parseWindow } from '../window.js';
import { gatherTimeline } from '../gather.js';
import { renderPostMortem } from '../render.js';
import type { CliIO } from '../io.js';

export interface GenerateOptions {
  from?: string;
  to?: string;
  last?: string;
  title?: string;
  /** Write to this file instead of stdout. */
  output?: string;
  url?: string;
  authToken?: string;
}

/**
 * Generate a pre-populated markdown post-mortem for an incident window. Writes
 * to `--output` if given, otherwise prints the markdown to stdout.
 */
export async function runGenerate(
  options: GenerateOptions,
  io: CliIO,
): Promise<number> {
  const window = parseWindow({
    from: options.from,
    to: options.to,
    last: options.last,
  });

  const connection = resolveConnection({
    url: options.url,
    authToken: options.authToken,
    cwd: io.cwd,
    env: io.env,
  });
  const client = io.createClient(connection);
  await client.connect();

  const data = await gatherTimeline(client, window);
  const markdown = renderPostMortem(data, {
    title: options.title,
    generatedUtc: new Date().toISOString(),
  });

  if (options.output) {
    const path = resolve(io.cwd, options.output);
    writeFileSync(path, markdown, 'utf8');
    io.err(
      chalk.green(
        `✓ Wrote post-mortem to ${path} ` +
          `(${data.alerts.length} alert(s), ${data.slowQueries.length} slow ` +
          `quer(y/ies), ${data.backups.length} backup(s), ${data.annotations.length} annotation(s)).`,
      ),
    );
  } else {
    io.out(markdown);
  }
  return 0;
}
