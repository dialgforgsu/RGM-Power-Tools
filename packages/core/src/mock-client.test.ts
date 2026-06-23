import { describe, it, expect } from 'vitest';
import { MockMonitorClient } from './index.js';
import type { MonitoredObject } from './index.js';

const prod: MonitoredObject = {
  id: '1',
  name: 'PROD-SQL-01',
  type: 'Instance',
};

describe('MockMonitorClient', () => {
  it('serves seeded reads', async () => {
    const client = new MockMonitorClient({
      monitoredObjects: [prod],
      alertSettings: {
        '1': { 100: { alertType: 100, enabled: true, settings: { x: 1 } } },
      },
    });
    await client.connect();
    expect(client.connected).toBe(true);
    expect(await client.getMonitoredObjects()).toHaveLength(1);
    const settings = await client.getAlertSettings(prod);
    expect(settings[100]?.enabled).toBe(true);
  });

  it('records writes', async () => {
    const client = new MockMonitorClient({ monitoredObjects: [prod] });
    await client.updateAlertSetting(prod, 100, { enabled: false });
    expect(client.updateCount).toBe(1);
    expect(client.updates[0]).toMatchObject({ objectId: '1', alertType: 100 });
    const settings = await client.getAlertSettings(prod);
    expect(settings[100]?.enabled).toBe(false);
  });

  it('isolates returned state from internal state', async () => {
    const client = new MockMonitorClient({ monitoredObjects: [prod] });
    const objs = await client.getMonitoredObjects();
    objs[0]!.name = 'mutated';
    const again = await client.getMonitoredObjects();
    expect(again[0]!.name).toBe('PROD-SQL-01');
  });
});
