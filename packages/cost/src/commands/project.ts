import { resolveConnection } from '@rgm-power-tools/core';
import { gatherCostData } from '../gather.js';
import { projectCost } from '../analyze.js';
import { renderProjection } from '../output.js';
import { resolveCostOptions, CostOptionError } from '../options.js';
import type { CliIO } from '../io.js';

export interface ProjectOptions {
  add?: string;
  costPerSlot?: string;
  currency?: string;
  json?: boolean;
  url?: string;
  authToken?: string;
}

/** Project the license impact of onboarding N more servers. */
export async function runProject(
  options: ProjectOptions,
  io: CliIO,
): Promise<number> {
  const add = Number(options.add);
  if (!Number.isInteger(add) || add <= 0) {
    throw new CostOptionError('--add must be a positive integer.');
  }

  const costOptions = resolveCostOptions({
    costPerSlot: options.costPerSlot,
    currency: options.currency,
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

  const { license } = await gatherCostData(client);
  const projection = projectCost(license, add, costOptions);

  if (options.json) {
    io.out(JSON.stringify(projection, null, 2));
  } else {
    renderProjection(projection, io.out);
  }
  return 0;
}
