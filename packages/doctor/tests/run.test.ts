import { describe, it, expect } from 'vitest';
import {
  runChecks,
  hasFindingsAtOrAbove,
  UnknownCheckError,
} from '../src/run.js';
import type { MonitorSnapshot } from '../src/types.js';

const NOW = new Date('2026-06-24T00:00:00.000Z');

function snapshotWithIssues(): MonitorSnapshot {
  return {
    objects: [{ id: 'i1', name: 'SQL-01', type: 'Instance' }],
    groups: [],
    alertSettingsByObject: {
      i1: { 1004: { alertType: 1004, enabled: true, settings: {} } }, // error
    },
    alertActivity: [], // i1 never alerted -> warning
    customMetrics: [],
    serverStatuses: [
      { objectId: 's1', name: 'OLD', status: 'Decommissioned', consumesLicense: true, lastDataUtc: null }, // error
    ],
  };
}

describe('runChecks', () => {
  it('runs all checks and sorts errors before warnings', () => {
    const report = runChecks(snapshotWithIssues(), { now: NOW });
    expect(report.total).toBe(3);
    expect(report.counts).toEqual({ error: 2, warning: 1, info: 0 });
    expect(report.findings[0]!.severity).toBe('error');
    expect(report.findings.at(-1)!.severity).toBe('warning');
    expect(report.checksRun.length).toBe(4);
  });

  it('can run a single check by id', () => {
    const report = runChecks(snapshotWithIssues(), {
      checks: ['decommissioned-licensed'],
      now: NOW,
    });
    expect(report.checksRun).toEqual(['decommissioned-licensed']);
    expect(report.total).toBe(1);
  });

  it('throws on an unknown check id', () => {
    expect(() => runChecks(snapshotWithIssues(), { checks: ['nope'] })).toThrow(
      UnknownCheckError,
    );
  });

  it('reports a clean install as zero findings', () => {
    const clean: MonitorSnapshot = {
      objects: [],
      groups: [],
      alertSettingsByObject: {},
      alertActivity: [],
      customMetrics: [],
      serverStatuses: [],
    };
    const report = runChecks(clean, { now: NOW });
    expect(report.total).toBe(0);
    expect(hasFindingsAtOrAbove(report, 'info')).toBe(false);
  });
});

describe('hasFindingsAtOrAbove', () => {
  it('respects the threshold', () => {
    const report = runChecks(snapshotWithIssues(), { now: NOW });
    expect(hasFindingsAtOrAbove(report, 'error')).toBe(true);
    expect(hasFindingsAtOrAbove(report, 'warning')).toBe(true);
  });

  it('is false at error when only warnings exist', () => {
    const warnOnly: MonitorSnapshot = {
      objects: [{ id: 'i1', name: 'SQL-01', type: 'Instance' }],
      groups: [],
      alertSettingsByObject: {},
      alertActivity: [],
      customMetrics: [],
      serverStatuses: [],
    };
    const report = runChecks(warnOnly, { now: NOW });
    expect(report.counts.warning).toBe(1);
    expect(hasFindingsAtOrAbove(report, 'error')).toBe(false);
  });
});
