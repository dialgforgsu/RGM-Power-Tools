import { describe, it, expect } from 'vitest';
import { renderPostMortem } from '../src/render.js';
import type { IncidentData } from '../src/types.js';

const window = {
  startUtc: '2026-06-24T01:00:00.000Z',
  endUtc: '2026-06-24T02:30:00.000Z',
};

function fullData(): IncidentData {
  return {
    window,
    alerts: [
      {
        id: 'a1',
        raisedUtc: '2026-06-24T01:05:00.000Z',
        clearedUtc: '2026-06-24T01:40:00.000Z',
        alertType: 1001,
        alertName: 'High CPU',
        severity: 'High',
        object: 'PROD-SQL-01',
        detail: 'CPU at 98%',
      },
    ],
    slowQueries: [
      {
        capturedUtc: '2026-06-24T01:10:00.000Z',
        object: 'PROD-SQL-01',
        database: 'sales',
        durationMs: 42000,
        query: 'SELECT * FROM orders WHERE total | 1 > 0',
      },
    ],
    backups: [
      {
        startedUtc: '2026-06-24T01:20:00.000Z',
        completedUtc: null,
        object: 'PROD-SQL-01',
        database: 'sales',
        type: 'Full',
        sizeBytes: 1073741824,
        outcome: 'Failed',
      },
    ],
    annotations: [
      {
        createdUtc: '2026-06-24T01:15:00.000Z',
        author: 'dba',
        object: 'PROD-SQL-01',
        text: 'Failover initiated',
      },
    ],
  };
}

describe('renderPostMortem', () => {
  it('includes a summary with counts and failed-backup highlight', () => {
    const md = renderPostMortem(fullData(), { title: 'CPU incident' });
    expect(md).toContain('# Post-mortem: CPU incident');
    expect(md).toContain('- **Alerts:** 1');
    expect(md).toContain('- **Slow queries:** 1 (slowest 42.0 s)');
    expect(md).toContain('**1 failed**');
    expect(md).toContain('- **Annotations:** 1');
  });

  it('renders a chronological timeline including alert clear', () => {
    const md = renderPostMortem(fullData());
    const timeline = md.slice(md.indexOf('## Timeline'));
    // raised (01:05) before slow query (01:10) before annotation (01:15)...
    expect(timeline.indexOf('Alert raised')).toBeLessThan(timeline.indexOf('Slow query'));
    expect(timeline).toContain('Alert cleared');
  });

  it('puts query text in a fenced code block and escapes table pipes', () => {
    const md = renderPostMortem(fullData());
    expect(md).toContain('```sql');
    expect(md).toContain('SELECT * FROM orders WHERE total | 1 > 0'); // raw in code block
    // The annotation/alert detail in tables must escape pipes; ensure no broken
    // table cell from the query is in a table (it lives in a code block).
    expect(md).toContain('| CPU at 98% |');
  });

  it('formats bytes and includes the analysis scaffold', () => {
    const md = renderPostMortem(fullData());
    expect(md).toContain('1.0 GB');
    expect(md).toContain('### Root cause');
    expect(md).toContain('- [ ]');
  });

  it('handles an empty window gracefully', () => {
    const md = renderPostMortem({
      window,
      alerts: [],
      slowQueries: [],
      backups: [],
      annotations: [],
    });
    expect(md).toContain('_No alerts in this window._');
    expect(md).toContain('_No events recorded in this window._');
    expect(md).toContain('- **Alerts:** 0');
  });

  it('uses a longer fence when the query contains a triple backtick', () => {
    const data = fullData();
    // A 3-backtick run would collide with a normal ```fence, so escalate to 4.
    data.slowQueries[0]!.query = 'SELECT 1 ``` injected';
    const md = renderPostMortem(data);
    expect(md).toContain('````sql');
  });
});
