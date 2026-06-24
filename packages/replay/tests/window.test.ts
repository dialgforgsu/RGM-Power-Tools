import { describe, it, expect } from 'vitest';
import { parseWindow, parseDurationMs } from '../src/window.js';
import { ReplayError } from '../src/types.js';

describe('parseDurationMs', () => {
  it('parses minutes, hours, days', () => {
    expect(parseDurationMs('90m')).toBe(90 * 60_000);
    expect(parseDurationMs('2h')).toBe(2 * 3_600_000);
    expect(parseDurationMs('1d')).toBe(86_400_000);
    expect(parseDurationMs('3 hrs')).toBe(3 * 3_600_000);
  });
  it('rejects garbage', () => {
    expect(() => parseDurationMs('soon')).toThrow(ReplayError);
    expect(() => parseDurationMs('10')).toThrow(ReplayError);
  });
});

describe('parseWindow', () => {
  const now = new Date('2026-06-24T12:00:00.000Z');

  it('builds a relative window from --last', () => {
    const w = parseWindow({ last: '2h', now });
    expect(w.endUtc).toBe('2026-06-24T12:00:00.000Z');
    expect(w.startUtc).toBe('2026-06-24T10:00:00.000Z');
  });

  it('builds an explicit window from --from/--to', () => {
    const w = parseWindow({
      from: '2026-06-24T01:00:00Z',
      to: '2026-06-24T02:30:00Z',
    });
    expect(w.startUtc).toBe('2026-06-24T01:00:00.000Z');
    expect(w.endUtc).toBe('2026-06-24T02:30:00.000Z');
  });

  it('rejects from >= to', () => {
    expect(() =>
      parseWindow({ from: '2026-06-24T02:00:00Z', to: '2026-06-24T01:00:00Z' }),
    ).toThrow(ReplayError);
  });

  it('rejects combining --last with --from/--to', () => {
    expect(() =>
      parseWindow({ last: '1h', from: '2026-06-24T01:00:00Z', now }),
    ).toThrow(ReplayError);
  });

  it('rejects missing input', () => {
    expect(() => parseWindow({})).toThrow(ReplayError);
    expect(() => parseWindow({ from: '2026-06-24T01:00:00Z' })).toThrow(ReplayError);
  });

  it('rejects an invalid timestamp', () => {
    expect(() => parseWindow({ from: 'yesterday', to: '2026-06-24T02:00:00Z' })).toThrow(
      ReplayError,
    );
  });
});
