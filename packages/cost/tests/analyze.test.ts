import { describe, it, expect } from 'vitest';
import type { LicenseSummary, ServerStatus } from '@rgm-power-tools/core';
import { analyzeCost, projectCost } from '../src/analyze.js';
import type { CostOptions } from '../src/types.js';

const NOW = new Date('2026-06-24T00:00:00.000Z');

const license: LicenseSummary = { totalSlots: 10, usedSlots: 7 };

const servers: ServerStatus[] = [
  { objectId: 's1', name: 'LIVE-01', status: 'Active', consumesLicense: true, lastDataUtc: '2026-06-23T00:00:00Z' },
  { objectId: 's2', name: 'STALE-01', status: 'Active', consumesLicense: true, lastDataUtc: '2026-04-01T00:00:00Z' },
  { objectId: 's3', name: 'NEVER-01', status: 'Active', consumesLicense: true, lastDataUtc: null },
  { objectId: 's4', name: 'UNLICENSED', status: 'Active', consumesLicense: false, lastDataUtc: null },
];

const opts = (over: Partial<CostOptions> = {}): CostOptions => ({
  idleDays: 30,
  currency: 'USD',
  ...over,
});

describe('analyzeCost', () => {
  it('computes utilization and waste', () => {
    const report = analyzeCost(servers, license, opts({ costPerSlot: 100 }), NOW);
    expect(report.totalSlots).toBe(10);
    expect(report.usedSlots).toBe(7);
    expect(report.freeSlots).toBe(3);
    expect(report.utilizationPct).toBe(70);
    expect(report.wastedSlots).toBe(2); // STALE-01 + NEVER-01
    expect(report.idleServers.map((s) => s.name)).toEqual(['NEVER-01', 'STALE-01']);
    expect(report.idleServers[0]!.daysIdle).toBeNull();
    expect(report.licenseCost).toBe(1000);
    expect(report.wastedSpend).toBe(200);
  });

  it('omits spend figures when no cost-per-slot is given', () => {
    const report = analyzeCost(servers, license, opts(), NOW);
    expect(report.licenseCost).toBeUndefined();
    expect(report.wastedSpend).toBeUndefined();
    expect(report.wastedSlots).toBe(2);
  });

  it('ignores unlicensed servers and respects the idle threshold', () => {
    // With a 200-day threshold, only the never-seen server counts.
    const report = analyzeCost(servers, license, opts({ idleDays: 200 }), NOW);
    expect(report.idleServers.map((s) => s.name)).toEqual(['NEVER-01']);
  });

  it('handles a zero-capacity license without dividing by zero', () => {
    const report = analyzeCost([], { totalSlots: 0, usedSlots: 0 }, opts(), NOW);
    expect(report.utilizationPct).toBe(0);
    expect(report.freeSlots).toBe(0);
  });
});

describe('projectCost', () => {
  it('fits new servers within free slots', () => {
    const p = projectCost(license, 2, opts({ costPerSlot: 100 }));
    expect(p.additionalSlotsNeeded).toBe(0);
    expect(p.withinLicense).toBe(true);
    expect(p.additionalSpend).toBe(0);
    expect(p.projectedLicenseCost).toBe(1000);
  });

  it('computes overage beyond free slots', () => {
    const p = projectCost(license, 5, opts({ costPerSlot: 100 }));
    expect(p.freeSlots).toBe(3);
    expect(p.additionalSlotsNeeded).toBe(2);
    expect(p.withinLicense).toBe(false);
    expect(p.additionalSpend).toBe(200);
    expect(p.projectedLicenseCost).toBe(1200);
  });

  it('omits spend when no cost-per-slot is given', () => {
    const p = projectCost(license, 5, opts());
    expect(p.additionalSlotsNeeded).toBe(2);
    expect(p.additionalSpend).toBeUndefined();
  });
});
