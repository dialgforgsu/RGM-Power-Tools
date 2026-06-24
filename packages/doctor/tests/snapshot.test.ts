import { describe, it, expect } from 'vitest';
import { MockMonitorClient } from '@rgm-power-tools/core';
import { gatherSnapshot } from '../src/snapshot.js';

describe('gatherSnapshot', () => {
  it('collects objects, diagnostics, and per-object alert settings', async () => {
    const client = new MockMonitorClient({
      monitoredObjects: [
        { id: 'i1', name: 'SQL-01', type: 'Instance' },
        { id: 'i2', name: 'SQL-02', type: 'Instance' },
      ],
      alertSettings: {
        i1: { 1004: { alertType: 1004, enabled: true, settings: {} } },
      },
      alertActivity: [{ objectId: 'i1', lastAlertUtc: null, alertCount: 0 }],
      customMetrics: [
        { id: 'm1', name: 'cpu', enabled: true, lastDataUtc: '2026-06-20T00:00:00Z' },
      ],
      serverStatuses: [
        { objectId: 'i1', name: 'SQL-01', status: 'Active', consumesLicense: true, lastDataUtc: null },
      ],
    });

    const snap = await gatherSnapshot(client);
    expect(snap.objects).toHaveLength(2);
    expect(Object.keys(snap.alertSettingsByObject).sort()).toEqual(['i1', 'i2']);
    expect(snap.alertSettingsByObject.i2).toEqual({}); // no settings -> empty bag
    expect(snap.alertActivity).toHaveLength(1);
    expect(snap.customMetrics[0]!.name).toBe('cpu');
    expect(snap.serverStatuses[0]!.consumesLicense).toBe(true);
  });
});
