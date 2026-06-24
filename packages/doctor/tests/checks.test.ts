import { describe, it, expect } from 'vitest';
import type { MonitoredObject } from '@rgm-power-tools/core';
import {
  neverAlerting,
  alertNoNotification,
  staleCustomMetric,
  decommissionedLicensed,
} from '../src/checks/index.js';
import type { MonitorSnapshot } from '../src/types.js';

const NOW = new Date('2026-06-24T00:00:00.000Z');

function emptySnapshot(): MonitorSnapshot {
  return {
    objects: [],
    groups: [],
    alertSettingsByObject: {},
    alertActivity: [],
    customMetrics: [],
    serverStatuses: [],
  };
}

const server = (id: string, name: string, type: MonitoredObject['type'] = 'Instance'): MonitoredObject => ({
  id,
  name,
  type,
});

describe('never-alerting', () => {
  it('flags server-like objects with no recorded alert', () => {
    const snap = emptySnapshot();
    snap.objects = [
      server('i1', 'SQL-01'),
      server('i2', 'SQL-02'),
      server('db1', 'mydb', 'Database'), // not server-like → ignored
    ];
    snap.alertActivity = [
      { objectId: 'i1', lastAlertUtc: '2026-06-01T00:00:00Z', alertCount: 5 },
      // i2 has no activity entry at all -> never alerted
    ];
    const findings = neverAlerting.run(snap, NOW);
    expect(findings.map((f) => f.subject)).toEqual(['SQL-02']);
    expect(findings[0]!.severity).toBe('warning');
  });

  it('flags an object whose lastAlertUtc is explicitly null', () => {
    const snap = emptySnapshot();
    snap.objects = [server('i1', 'SQL-01', 'Machine')];
    snap.alertActivity = [{ objectId: 'i1', lastAlertUtc: null, alertCount: 0 }];
    expect(neverAlerting.run(snap, NOW)).toHaveLength(1);
  });
});

describe('alert-no-notification', () => {
  it('flags enabled alerts with no notification channel', () => {
    const snap = emptySnapshot();
    snap.objects = [server('i1', 'SQL-01')];
    snap.alertSettingsByObject = {
      i1: {
        1001: {
          alertType: 1001,
          enabled: true,
          settings: { notifications: { email: ['a@b.com'] } },
        },
        1004: { alertType: 1004, enabled: true, settings: {} },
        1009: {
          alertType: 1009,
          enabled: false,
          settings: {}, // disabled -> ignored
        },
      },
    };
    const findings = alertNoNotification.run(snap, NOW);
    expect(findings).toHaveLength(1);
    expect(findings[0]!.subject).toBe('SQL-01');
    expect(findings[0]!.detail).toContain('1004');
    expect(findings[0]!.detail).not.toContain('1001');
    expect(findings[0]!.severity).toBe('error');
  });

  it('treats an empty notifications object as no channel', () => {
    const snap = emptySnapshot();
    snap.objects = [server('i1', 'SQL-01')];
    snap.alertSettingsByObject = {
      i1: {
        1001: {
          alertType: 1001,
          enabled: true,
          settings: { notifications: { email: [], slack: '' } },
        },
      },
    };
    expect(alertNoNotification.run(snap, NOW)).toHaveLength(1);
  });
});

describe('stale-custom-metric', () => {
  it('flags never-collected and stale metrics, skips fresh and disabled', () => {
    const snap = emptySnapshot();
    snap.customMetrics = [
      { id: 'm1', name: 'fresh', enabled: true, lastDataUtc: '2026-06-20T00:00:00Z' },
      { id: 'm2', name: 'stale', enabled: true, lastDataUtc: '2026-04-01T00:00:00Z' },
      { id: 'm3', name: 'never', enabled: true, lastDataUtc: null },
      { id: 'm4', name: 'disabled-stale', enabled: false, lastDataUtc: '2025-01-01T00:00:00Z' },
    ];
    const findings = staleCustomMetric.run(snap, NOW);
    expect(findings.map((f) => f.subject).sort()).toEqual(['never', 'stale']);
  });
});

describe('decommissioned-licensed', () => {
  it('flags retired servers that still hold a license', () => {
    const snap = emptySnapshot();
    snap.serverStatuses = [
      { objectId: 's1', name: 'OLD-01', status: 'Decommissioned', consumesLicense: true, lastDataUtc: null },
      { objectId: 's2', name: 'OLD-02', status: 'Stopped', consumesLicense: false, lastDataUtc: null },
      { objectId: 's3', name: 'LIVE-01', status: 'Active', consumesLicense: true, lastDataUtc: null },
    ];
    const findings = decommissionedLicensed.run(snap, NOW);
    expect(findings.map((f) => f.subject)).toEqual(['OLD-01']);
    expect(findings[0]!.severity).toBe('error');
  });
});
