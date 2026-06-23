import { resolve } from 'node:path';
import { resolveConnection } from '@rgm-power-tools/core';
import { DEFAULT_CONFIG_FILE } from '../constants.js';
import { readConfigFile } from '../yaml-io.js';
import { buildLiveConfig } from '../live-state.js';
import { diffConfigs } from '../diff-engine.js';
import { renderDiff } from '../output.js';
import type { ConfigFile } from '../schema.js';
import type { CliIO } from '../io.js';

export interface DiffOptions {
  source?: string;
  /** A YAML path, or the literal "live" to compare against the instance. */
  target?: string;
  url?: string;
  authToken?: string;
}

const LIVE = 'live';

/**
 * Compare two configurations. With no args, compares ./monitor-config.yaml to
 * live Monitor state. Returns exit code 1 when differences are found (for CI),
 * 0 when in sync.
 */
export async function runDiff(
  options: DiffOptions,
  io: CliIO,
): Promise<number> {
  const sourcePath = resolve(io.cwd, options.source ?? DEFAULT_CONFIG_FILE);
  const sourceConfig = readConfigFile(sourcePath);
  const sourceLabel = options.source ?? DEFAULT_CONFIG_FILE;

  const targetSpec = options.target ?? LIVE;
  let targetConfig: ConfigFile;
  let targetLabel: string;

  if (targetSpec === LIVE) {
    const connection = resolveConnection({
      url: options.url,
      authToken: options.authToken,
      cwd: io.cwd,
      env: io.env,
    });
    const client = io.createClient(connection);
    await client.connect();
    targetConfig = await buildLiveConfig(client);
    targetLabel = 'live';
  } else {
    targetConfig = readConfigFile(resolve(io.cwd, targetSpec));
    targetLabel = targetSpec;
  }

  const result = diffConfigs(sourceConfig, targetConfig);
  renderDiff(result, io.out, { source: sourceLabel, target: targetLabel });
  return result.hasChanges ? 1 : 0;
}
