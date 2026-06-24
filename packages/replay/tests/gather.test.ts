import { describe, it, expect } from 'vitest';
import { MockMonitorClient } from '@rgm-power-tools/core';
import { gatherTimeline } from '../src/gather.js';

const window = {
  startUtc: '2026-06-24T01:00:00.000Z',
  endUtc: '2026-06-24T02:00:00.000Z',
};

describe('gatherTimeline', () => {
  it('collects only events within the window', async () => {
    const client = new MockMonitorClient({
      alertEvents: [
        { id: 'in', raisedUtc: '2026-06-24T01:30:00Z', clearedUtc: null, alertType: 1, object: 'A' },
        { id: 'out', raisedUtc: '2026-06-24T05:00:00Z', clearedUtc: null, alertType: 1, object: 'A' },
      ],
      slowQueries: [
        { capturedUtc: '2026-06-24T01:45:00Z', object: 'A', durationMs: 1000, query: 'SELECT 1' },
        { capturedUtc: '2026-06-23T23:00:00Z', object: 'A', durationMs: 1000, query: 'SELECT 2' },
      ],
      backups: [
        { startedUtc: '2026-06-24T01:10:00Z', completedUtc: null, object: 'A', database: 'db', type: 'Full', sizeBytes: null },
      ],
      annotations: [
        { createdUtc: '2026-06-24T01:20:00Z', text: 'note in' },
        { createdUtc: '2026-06-24T09:00:00Z', text: 'note out' },
      ],
    });

    const data = await gatherTimeline(client, window);
    expect(data.alerts.map((a) => a.id)).toEqual(['in']);
    expect(data.slowQueries).toHaveLength(1);
    expect(data.backups).toHaveLength(1);
    expect(data.annotations.map((n) => n.text)).toEqual(['note in']);
    expect(data.window).toEqual(window);
  });
});
