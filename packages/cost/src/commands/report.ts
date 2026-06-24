import { resolveConnection } from '@rgm-power-tools/core';
import { gatherCostData } from '../gather.js';
import { analyzeCost } from '../analyze.js';
import { renderReport } from '../output.js';
import { resolveCostOptions } from '../options.js';
import type { CliIO } from '../io.js';

export interface ReportOptions {
  idleDays?: string;
  costPerSlot?: string;
  currency?: string;
  json?: boolean;
  /** Exit non-zero if any wasted slots are found (for CI gating). */
  failOnWaste?: boolean;
  url?: string;
  authToken?: string;
}

/**
 * Audit license utilization: usage vs capacity, and licensed servers idle past
 * the threshold (wasted spend). Returns exit 1 only when `--fail-on-waste` is
 * set and waste exists.
 */
export async function runReport(
  options: ReportOptions,
  io: CliIO,
): Promise<number> {
  const costOptions = resolveCostOptions({
    idleDays: options.idleDays,
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

  const { servers, license } = await gatherCostData(client);
  const report = analyzeCost(servers, license, costOptions, new Date());

  if (options.json) {
    io.out(JSON.stringify(report, null, 2));
  } else {
    renderReport(report, io.out);
  }

  return options.failOnWaste && report.wastedSlots > 0 ? 1 : 0;
}
