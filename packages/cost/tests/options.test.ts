import { describe, it, expect } from 'vitest';
import { resolveCostOptions, CostOptionError } from '../src/options.js';

describe('resolveCostOptions', () => {
  it('applies defaults', () => {
    const o = resolveCostOptions({ env: {} });
    expect(o.idleDays).toBe(30);
    expect(o.costPerSlot).toBeUndefined();
    expect(o.currency).toBe('');
  });

  it('reads from environment', () => {
    const o = resolveCostOptions({
      env: {
        MONITOR_IDLE_DAYS: '14',
        MONITOR_COST_PER_SLOT: '50',
        MONITOR_CURRENCY: 'GBP',
      },
    });
    expect(o.idleDays).toBe(14);
    expect(o.costPerSlot).toBe(50);
    expect(o.currency).toBe('GBP');
  });

  it('lets flags override the environment', () => {
    const o = resolveCostOptions({
      idleDays: '7',
      costPerSlot: '99',
      currency: 'EUR',
      env: { MONITOR_IDLE_DAYS: '14', MONITOR_COST_PER_SLOT: '50' },
    });
    expect(o.idleDays).toBe(7);
    expect(o.costPerSlot).toBe(99);
    expect(o.currency).toBe('EUR');
  });

  it('rejects a non-numeric cost', () => {
    expect(() => resolveCostOptions({ costPerSlot: 'free' })).toThrow(
      CostOptionError,
    );
  });

  it('rejects a negative idle-days', () => {
    expect(() => resolveCostOptions({ idleDays: '-1' })).toThrow(CostOptionError);
  });
});
