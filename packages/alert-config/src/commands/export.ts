import { resolve } from 'node:path';
import { writeFileSync } from 'node:fs';
import chalk from 'chalk';
import { resolveConnection } from '@rgm-power-tools/core';
import { DEFAULT_CONFIG_FILE } from '../constants.js';
import { buildLiveConfig } from '../live-state.js';
import { serializeConfig } from '../yaml-io.js';
import type { CliIO } from '../io.js';

export interface ExportOptions {
  output?: string;
  group?: string;
  url?: string;
  authToken?: string;
}

/**
 * Connect to Monitor, pull all groups/servers/alert settings, and write clean,
 * deterministically-ordered YAML to the output path. `--group` filters to one
 * group. The token is never written — connection placeholders are emitted.
 */
export async function runExport(
  options: ExportOptions,
  io: CliIO,
): Promise<number> {
  const connection = resolveConnection({
    url: options.url,
    authToken: options.authToken,
    cwd: io.cwd,
    env: io.env,
  });

  const client = io.createClient(connection);
  await client.connect();

  const config = await buildLiveConfig(client, { group: options.group });
  if (config.groups.length === 0) {
    io.out(
      chalk.yellow(
        options.group
          ? `No group named "${options.group}" was found.`
          : 'No groups found on this Monitor instance.',
      ),
    );
    return 0;
  }

  const outputPath = resolve(io.cwd, options.output ?? DEFAULT_CONFIG_FILE);
  writeFileSync(outputPath, serializeConfig(config), 'utf8');

  io.out(
    chalk.green(
      `✓ Exported ${config.groups.length} group(s) to ${outputPath}.`,
    ),
  );
  return 0;
}
