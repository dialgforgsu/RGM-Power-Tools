import { describe, it, expect } from 'vitest';
import { MockMonitorClient } from '@rgm-power-tools/core';
import { gatherCostData } from '../src/gather.js';

describe('gatherCostData', () => {
  it('collects server statuses and the license summary', async () => {
    const client = new MockMonitorClient({
      serverStatuses: [
        { objectId: 's1', name: 'SQL-01', status: 'Active', consumesLicense: true, lastDataUtc: null },
      ],
      licenseSummary: { totalSlots: 5, usedSlots: 3, edition: 'Pro' },
    });
    const { servers, license } = await gatherCostData(client);
    expect(servers).toHaveLength(1);
    expect(license.totalSlots).toBe(5);
    expect(license.usedSlots).toBe(3);
    expect(license.edition).toBe('Pro');
  });

  it('defaults to an empty/zero license on an unseeded mock', async () => {
    const { servers, license } = await gatherCostData(new MockMonitorClient());
    expect(servers).toEqual([]);
    expect(license).toEqual({ totalSlots: 0, usedSlots: 0 });
  });
});
