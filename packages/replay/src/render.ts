import type {
  AlertEvent,
  BackupEvent,
  SlowQuery,
} from '@rgm-power-tools/core';
import type { IncidentData, RenderOptions } from './types.js';

const DEFAULT_MAX_QUERIES = 10;

/** Escape a value for use inside a markdown table cell. */
function cell(value: unknown): string {
  const s = value == null ? '' : String(value);
  const clean = s.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ').trim();
  return clean === '' ? '—' : clean;
}

/** A code fence long enough to safely wrap `code` (handles embedded backticks). */
function codeBlock(code: string, lang = ''): string {
  let longest = 0;
  for (const m of code.matchAll(/`+/g)) longest = Math.max(longest, m[0].length);
  const fence = '`'.repeat(Math.max(3, longest + 1));
  return `${fence}${lang}\n${code}\n${fence}`;
}

function humanizeDuration(ms: number): string {
  const totalMin = Math.round(ms / 60_000);
  if (totalMin < 60) return `${totalMin}m`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function fmtMs(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${ms} ms`;
}

function fmtBytes(bytes: number | null): string {
  if (bytes == null) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let n = bytes;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

interface TimelineEntry {
  ts: string;
  type: string;
  detail: string;
}

function buildTimeline(data: IncidentData): TimelineEntry[] {
  const entries: TimelineEntry[] = [];
  for (const a of data.alerts) {
    entries.push({
      ts: a.raisedUtc,
      type: 'Alert raised',
      detail: `${a.alertName ?? `type ${a.alertType}`} on ${a.object}${a.severity ? ` (${a.severity})` : ''}`,
    });
    if (a.clearedUtc) {
      entries.push({
        ts: a.clearedUtc,
        type: 'Alert cleared',
        detail: `${a.alertName ?? `type ${a.alertType}`} on ${a.object}`,
      });
    }
  }
  for (const q of data.slowQueries) {
    entries.push({
      ts: q.capturedUtc,
      type: 'Slow query',
      detail: `${fmtMs(q.durationMs)} on ${q.object}${q.database ? `/${q.database}` : ''}`,
    });
  }
  for (const b of data.backups) {
    entries.push({
      ts: b.startedUtc,
      type: 'Backup',
      detail: `${b.type} of ${b.object}/${b.database}${b.outcome ? ` — ${b.outcome}` : ''}`,
    });
  }
  for (const n of data.annotations) {
    entries.push({
      ts: n.createdUtc,
      type: 'Annotation',
      detail: `${n.author ? `${n.author}: ` : ''}${n.text}`,
    });
  }
  return entries.sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts));
}

function alertsSection(alerts: AlertEvent[]): string[] {
  const lines = [`## Alerts (${alerts.length})`, ''];
  if (alerts.length === 0) {
    lines.push('_No alerts in this window._', '');
    return lines;
  }
  lines.push(
    '| Raised (UTC) | Cleared (UTC) | Severity | Object | Alert | Detail |',
    '| --- | --- | --- | --- | --- | --- |',
  );
  for (const a of [...alerts].sort((x, y) => Date.parse(x.raisedUtc) - Date.parse(y.raisedUtc))) {
    lines.push(
      `| ${cell(a.raisedUtc)} | ${cell(a.clearedUtc ?? 'still open')} | ${cell(a.severity)} | ${cell(a.object)} | ${cell(a.alertName ?? `type ${a.alertType}`)} | ${cell(a.detail)} |`,
    );
  }
  lines.push('');
  return lines;
}

function slowQueriesSection(queries: SlowQuery[], maxQueries: number): string[] {
  const lines = [`## Slow queries (${queries.length})`, ''];
  if (queries.length === 0) {
    lines.push('_No slow queries in this window._', '');
    return lines;
  }
  const sorted = [...queries].sort((a, b) => b.durationMs - a.durationMs);
  const shown = sorted.slice(0, maxQueries);
  shown.forEach((q, i) => {
    lines.push(
      `### ${i + 1}. ${q.object}${q.database ? `/${q.database}` : ''} — ${fmtMs(q.durationMs)}`,
      `_Captured ${q.capturedUtc}_`,
      '',
      codeBlock(q.query || '(query text unavailable)', 'sql'),
      '',
    );
  });
  if (sorted.length > shown.length) {
    lines.push(`_…and ${sorted.length - shown.length} more slower-than-usual queries._`, '');
  }
  return lines;
}

function backupsSection(backups: BackupEvent[]): string[] {
  const lines = [`## Backups (${backups.length})`, ''];
  if (backups.length === 0) {
    lines.push('_No backups in this window._', '');
    return lines;
  }
  lines.push(
    '| Started (UTC) | Object | Database | Type | Size | Outcome |',
    '| --- | --- | --- | --- | --- | --- |',
  );
  for (const b of [...backups].sort((x, y) => Date.parse(x.startedUtc) - Date.parse(y.startedUtc))) {
    lines.push(
      `| ${cell(b.startedUtc)} | ${cell(b.object)} | ${cell(b.database)} | ${cell(b.type)} | ${cell(fmtBytes(b.sizeBytes))} | ${cell(b.outcome)} |`,
    );
  }
  lines.push('');
  return lines;
}

/**
 * Render a pre-populated markdown post-mortem from gathered incident data. The
 * factual sections (timeline, alerts, queries, backups, annotations) are filled
 * in from Monitor; the analysis section is a scaffold with TODOs for the human.
 *
 * Pure and deterministic — no I/O, no clock unless `generatedUtc` is supplied.
 */
export function renderPostMortem(
  data: IncidentData,
  options: RenderOptions = {},
): string {
  const { window } = data;
  const durationMs = Date.parse(window.endUtc) - Date.parse(window.startUtc);
  const maxQueries = options.maxQueries ?? DEFAULT_MAX_QUERIES;
  const title =
    options.title ?? `Incident ${window.startUtc} → ${window.endUtc}`;

  const failedBackups = data.backups.filter(
    (b) => (b.outcome ?? '').toLowerCase() === 'failed',
  ).length;
  const slowest = data.slowQueries.reduce(
    (max, q) => Math.max(max, q.durationMs),
    0,
  );

  const out: string[] = [];
  out.push(`# Post-mortem: ${title}`, '');
  if (options.generatedUtc) {
    out.push(`> Generated ${options.generatedUtc} by \`monitor-replay\`.`);
  } else {
    out.push('> Generated by `monitor-replay`.');
  }
  out.push(
    `> Window: **${window.startUtc} → ${window.endUtc}** (${humanizeDuration(durationMs)}).`,
    '',
  );

  out.push('## Summary', '');
  out.push(
    `- **Alerts:** ${data.alerts.length}`,
    `- **Slow queries:** ${data.slowQueries.length}${slowest ? ` (slowest ${fmtMs(slowest)})` : ''}`,
    `- **Backups:** ${data.backups.length}${failedBackups ? ` (**${failedBackups} failed**)` : ''}`,
    `- **Annotations:** ${data.annotations.length}`,
    '',
    '_One-paragraph summary of what happened and the customer impact (fill in)._',
    '',
  );

  // Timeline
  out.push('## Timeline', '');
  const timeline = buildTimeline(data);
  if (timeline.length === 0) {
    out.push('_No events recorded in this window._', '');
  } else {
    out.push('| Time (UTC) | Event | Detail |', '| --- | --- | --- |');
    for (const e of timeline) {
      out.push(`| ${cell(e.ts)} | ${cell(e.type)} | ${cell(e.detail)} |`);
    }
    out.push('');
  }

  out.push(...alertsSection(data.alerts));
  out.push(...slowQueriesSection(data.slowQueries, maxQueries));
  out.push(...backupsSection(data.backups));

  // Annotations
  out.push(`## Annotations (${data.annotations.length})`, '');
  if (data.annotations.length === 0) {
    out.push('_No annotations in this window._', '');
  } else {
    out.push('| Time (UTC) | Author | Object | Note |', '| --- | --- | --- | --- |');
    for (const n of [...data.annotations].sort((a, b) => Date.parse(a.createdUtc) - Date.parse(b.createdUtc))) {
      out.push(`| ${cell(n.createdUtc)} | ${cell(n.author)} | ${cell(n.object)} | ${cell(n.text)} |`);
    }
    out.push('');
  }

  // Analysis scaffold
  out.push(
    '## Analysis',
    '',
    '### Impact',
    '_Who/what was affected, and for how long?_',
    '',
    '### Root cause',
    '_What actually caused the incident?_',
    '',
    '### Resolution',
    '_How was it resolved or mitigated?_',
    '',
    '### Action items',
    '- [ ] _Owner — follow-up action_',
    '',
    '### Lessons learned',
    '_What went well, what didn’t, what to change._',
    '',
  );

  return out.join('\n');
}
