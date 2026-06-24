import { MonitorToolError } from '@rgm-power-tools/core';
import type { CostOptions } from './types.js';

/** Raised for invalid cost option values. */
export class CostOptionError extends MonitorToolError {}

export interface RawCostOptions {
  idleDays?: number | string;
  costPerSlot?: number | string;
  currency?: string;
  env?: NodeJS.ProcessEnv;
}

function toNumber(value: number | string, name: string): number {
  const n = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(n)) {
    throw new CostOptionError(`Invalid --${name}: "${value}" is not a number.`);
  }
  return n;
}

/**
 * Resolve {@link CostOptions} from flags, then environment, then defaults.
 * Cost is currency-agnostic: if no `costPerSlot` is given (flag or
 * MONITOR_COST_PER_SLOT), the audit reports slots only and omits spend figures.
 */
export function resolveCostOptions(raw: RawCostOptions = {}): CostOptions {
  const env = raw.env ?? {};

  const idleDays = Math.trunc(
    toNumber(raw.idleDays ?? env.MONITOR_IDLE_DAYS ?? 30, 'idle-days'),
  );
  if (idleDays < 0) throw new CostOptionError('--idle-days must be >= 0.');

  const costRaw = raw.costPerSlot ?? env.MONITOR_COST_PER_SLOT;
  let costPerSlot: number | undefined;
  if (costRaw !== undefined && costRaw !== '') {
    costPerSlot = toNumber(costRaw, 'cost-per-slot');
    if (costPerSlot < 0) {
      throw new CostOptionError('--cost-per-slot must be >= 0.');
    }
  }

  const currency = (raw.currency ?? env.MONITOR_CURRENCY ?? '').trim();
  return { idleDays, costPerSlot, currency };
}
