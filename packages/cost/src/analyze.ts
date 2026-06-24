import type { LicenseSummary, ServerStatus } from '@rgm-power-tools/core';
import type {
  CostOptions,
  CostReport,
  IdleServer,
  Projection,
} from './types.js';

/** Whole days between an ISO timestamp and `now`. */
function daysSince(iso: string, now: Date): number {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return Number.POSITIVE_INFINITY;
  return Math.floor((now.getTime() - then) / 86_400_000);
}

/**
 * Compute the license-utilization report: how many slots are paid for vs used,
 * and which licensed servers are idle (no data within `idleDays`) and therefore
 * wasted spend. Pure — no I/O — so it's trivially unit-tested.
 */
export function analyzeCost(
  servers: readonly ServerStatus[],
  license: LicenseSummary,
  options: CostOptions,
  now: Date,
): CostReport {
  const totalSlots = Math.max(0, license.totalSlots);
  const usedSlots = Math.max(0, license.usedSlots);
  const freeSlots = Math.max(0, totalSlots - usedSlots);
  const utilizationPct =
    totalSlots > 0 ? Math.round((usedSlots / totalSlots) * 100) : 0;

  const idleServers: IdleServer[] = [];
  for (const s of servers) {
    if (!s.consumesLicense) continue;
    if (s.lastDataUtc == null) {
      idleServers.push({
        name: s.name,
        status: s.status,
        lastDataUtc: null,
        daysIdle: null,
      });
      continue;
    }
    const daysIdle = daysSince(s.lastDataUtc, now);
    if (daysIdle >= options.idleDays) {
      idleServers.push({
        name: s.name,
        status: s.status,
        lastDataUtc: s.lastDataUtc,
        daysIdle,
      });
    }
  }
  // Worst offenders first: never-seen (null) at the top, then longest idle.
  idleServers.sort(
    (a, b) =>
      (b.daysIdle ?? Number.POSITIVE_INFINITY) -
      (a.daysIdle ?? Number.POSITIVE_INFINITY),
  );

  const wastedSlots = idleServers.length;
  const report: CostReport = {
    totalSlots,
    usedSlots,
    freeSlots,
    utilizationPct,
    idleDays: options.idleDays,
    idleServers,
    wastedSlots,
    currency: options.currency,
  };
  if (options.costPerSlot != null) {
    report.costPerSlot = options.costPerSlot;
    report.licenseCost = totalSlots * options.costPerSlot;
    report.wastedSpend = wastedSlots * options.costPerSlot;
  }
  return report;
}

/**
 * Project the license impact of onboarding `addServers` more servers: how many
 * fit in free slots, how many new slots must be bought, and the added spend.
 */
export function projectCost(
  license: LicenseSummary,
  addServers: number,
  options: CostOptions,
): Projection {
  const add = Math.max(0, Math.trunc(addServers));
  const freeSlots = Math.max(0, license.totalSlots - license.usedSlots);
  const additionalSlotsNeeded = Math.max(0, add - freeSlots);

  const projection: Projection = {
    addServers: add,
    freeSlots,
    additionalSlotsNeeded,
    withinLicense: additionalSlotsNeeded === 0,
    currency: options.currency,
  };
  if (options.costPerSlot != null) {
    projection.costPerSlot = options.costPerSlot;
    projection.additionalSpend = additionalSlotsNeeded * options.costPerSlot;
    projection.projectedLicenseCost =
      (Math.max(0, license.totalSlots) + additionalSlotsNeeded) *
      options.costPerSlot;
  }
  return projection;
}
