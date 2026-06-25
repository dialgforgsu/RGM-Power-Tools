'use strict';

/**
 * Simulated Redgate Monitor "test environment" for the static GitHub Pages demo.
 *
 * GitHub Pages serves static files only — there is no Node server, no
 * PowerShell, and no real Monitor instance. So instead of talking to a backend,
 * this script patches `window.fetch` and answers the dashboard's `/api/*` calls
 * from in-memory fixtures that mirror the real response shapes (see
 * packages/server/src/api.ts and packages/core/src/types.ts).
 *
 * The real dashboard UI (app.js) is loaded unmodified after this file, so what
 * you see is the genuine front-end — only the network layer is faked. Writes
 * (apply / tag sync / annotate) mutate this in-memory state for the session, so
 * the demo behaves statefully: apply once and the next diff is clean.
 */
(function () {
  // --- Seeded "test environment" -------------------------------------------

  const CONNECTION = {
    baseUrl: 'https://monitor.demo.red-gate.com',
    tokenHint: 'rg_demo_****_f3a9',
    workdir: '/home/dba/monitor-config',
  };

  // Live Monitor groups (name + server count).
  const liveGroups = [
    { name: 'Production', servers: 4 },
    { name: 'Payments', servers: 2 },
    { name: 'Staging', servers: 2 },
    { name: 'Development', servers: 3 },
    { name: 'Analytics', servers: 1 },
  ];

  // Tag overlay (monitor-tags.yaml). Deliberately missing Staging & Analytics
  // so "Sync from Monitor" has something to add.
  const tagState = {
    version: 1,
    groups: [
      {
        name: 'Production',
        tags: {
          owner: 'dba-team',
          business_unit: 'Payments',
          criticality: 'high',
          cost_center: '4200',
        },
      },
      {
        name: 'Payments',
        tags: {
          owner: 'payments-dba',
          business_unit: 'Payments',
          criticality: 'high',
          cost_center: '4200',
        },
      },
      {
        name: 'Development',
        tags: { owner: 'dba-team', criticality: 'low' },
      },
    ],
  };

  // Alert-config drift: local YAML vs live Monitor. Mutable so `apply` clears it.
  function freshPlan() {
    return {
      hasChanges: true,
      groups: [
        {
          name: 'Production',
          status: 'modified',
          changes: [
            {
              kind: 'changed',
              path: 'cpu_utilization.thresholds.high.value',
              from: 90,
              to: 85,
            },
            {
              kind: 'added',
              path: 'cpu_utilization.notifications.slack',
              to: '#prod-alerts',
            },
            {
              kind: 'changed',
              path: 'long_running_query.threshold_seconds',
              from: 600,
              to: 300,
            },
          ],
        },
        // In desired config but not yet in Monitor (apply will skip it).
        { name: 'DR', status: 'added', changes: [] },
        // In Monitor but not in the local config (apply never deletes).
        { name: 'Analytics', status: 'removed', changes: [] },
      ],
    };
  }
  let applied = false;

  // Which live groups each plan group maps to, for --tag filtering.
  const groupTags = Object.fromEntries(
    tagState.groups.map((g) => [g.name, g.tags]),
  );
  function planMatchesFilters(groupName, filters) {
    if (!filters.length) return true;
    const tags = groupTags[groupName] || {};
    // Same key repeated = OR; different keys = AND (mirrors monitor-tagger).
    const byKey = {};
    for (const f of filters) {
      const [k, v] = f.split('=').map((s) => s.trim().toLowerCase());
      (byKey[k] = byKey[k] || []).push(v);
    }
    return Object.entries(byKey).every(([k, vals]) =>
      vals.includes(String(tags[k] ?? '').toLowerCase()),
    );
  }

  // monitor-doctor findings.
  const doctorReport = {
    total: 4,
    counts: { error: 2, warning: 2, info: 0 },
    findings: [
      {
        severity: 'error',
        title: 'Enabled alert has no notification channel',
        subject: 'PROD-SQL-02 / cpu_utilization',
        detail:
          'This alert will fire but page nobody — add an email or Slack channel.',
        checkId: 'alert-no-notification',
      },
      {
        severity: 'error',
        title: 'Decommissioned server still holding a license',
        subject: 'OLD-SQL-07',
        detail: 'Stopped 92 days ago but still consuming a monitoring slot.',
        checkId: 'decommissioned-licensed',
      },
      {
        severity: 'warning',
        title: 'Server has never raised an alert',
        subject: 'DEV-SQL-01',
        detail: 'Likely missing alert configuration — a silent blind spot.',
        checkId: 'never-alerting',
      },
      {
        severity: 'warning',
        title: 'Custom metric has returned no data in 30 days',
        subject: 'Payments / queue_depth',
        detail: 'The query may be broken or the metric abandoned.',
        checkId: 'stale-custom-metric',
      },
    ],
  };

  // monitor-cost: license capacity and idle (wasted) servers.
  const COST = {
    totalSlots: 50,
    usedSlots: 42,
    costPerSlot: 600,
    currency: 'USD',
    idleDays: 30,
    idleServers: [
      { name: 'OLD-SQL-07', status: 'Stopped', daysIdle: 92 },
      { name: 'LEGACY-APP-01', status: 'Stopped', daysIdle: 140 },
      { name: 'TEST-DB-02', status: 'Active', daysIdle: null },
      { name: 'QA-SQL-04', status: 'Active', daysIdle: 45 },
      { name: 'REPORTING-03', status: 'Active', daysIdle: 61 },
    ],
  };

  function costReport() {
    const freeSlots = COST.totalSlots - COST.usedSlots;
    const wastedSlots = COST.idleServers.length;
    return {
      usedSlots: COST.usedSlots,
      totalSlots: COST.totalSlots,
      freeSlots,
      utilizationPct: Math.round((COST.usedSlots / COST.totalSlots) * 100),
      licenseCost: COST.totalSlots * COST.costPerSlot,
      currency: COST.currency,
      idleDays: COST.idleDays,
      wastedSlots,
      wastedSpend: wastedSlots * COST.costPerSlot,
      idleServers: COST.idleServers,
    };
  }

  function costProjection(addServers) {
    const freeSlots = COST.totalSlots - COST.usedSlots;
    const withinLicense = addServers <= freeSlots;
    const additionalSlotsNeeded = withinLicense ? 0 : addServers - freeSlots;
    const additionalSpend = additionalSlotsNeeded * COST.costPerSlot;
    return {
      addServers,
      freeSlots,
      withinLicense,
      additionalSlotsNeeded,
      additionalSpend,
      currency: COST.currency,
      projectedLicenseCost:
        COST.totalSlots * COST.costPerSlot + additionalSpend,
    };
  }

  // monitor-replay: a seeded incident. Annotations added via the UI append here.
  const incident = {
    window: {
      startUtc: '2026-06-24T12:30:00Z',
      endUtc: '2026-06-24T14:30:00Z',
    },
    alerts: [
      {
        raisedUtc: '2026-06-24T12:53:02Z',
        clearedUtc: '2026-06-24T13:21:30Z',
        severity: 'High',
        object: 'PROD-SQL-01',
        alertName: 'CPU utilization',
        detail: '95% sustained for 10 minutes',
      },
      {
        raisedUtc: '2026-06-24T13:02:10Z',
        clearedUtc: '2026-06-24T13:40:00Z',
        severity: 'Medium',
        object: 'PROD-SQL-01',
        alertName: 'Long-running query',
        detail: 'checkout query exceeded 600s',
      },
      {
        raisedUtc: '2026-06-24T13:15:00Z',
        clearedUtc: null,
        severity: 'High',
        object: 'PROD-SQL-02',
        alertName: 'Blocking process',
        detail: 'session 73 blocking 12 others',
      },
    ],
    slowQueries: [
      {
        capturedUtc: '2026-06-24T13:10:45Z',
        durationMs: 8400,
        object: 'PROD-SQL-01',
        database: 'checkout',
        query:
          'SELECT o.* FROM orders o JOIN order_items i ON i.order_id = o.id\nWHERE o.status = @status ORDER BY o.created_at DESC;',
      },
      {
        capturedUtc: '2026-06-24T13:18:22Z',
        durationMs: 4200,
        object: 'PROD-SQL-01',
        database: 'checkout',
        query: 'UPDATE inventory SET reserved = reserved + 1 WHERE sku = @sku;',
      },
      {
        capturedUtc: '2026-06-24T13:25:09Z',
        durationMs: 2100,
        object: 'PROD-SQL-02',
        database: 'orders',
        query: 'SELECT COUNT(*) FROM orders WHERE created_at > @since;',
      },
    ],
    backups: [
      {
        startedUtc: '2026-06-24T13:30:00Z',
        object: 'PROD-SQL-01',
        database: 'checkout',
        type: 'Full',
        sizeBytes: 5368709120,
        outcome: 'Succeeded',
      },
      {
        startedUtc: '2026-06-24T13:45:00Z',
        object: 'PROD-SQL-02',
        database: 'orders',
        type: 'Log',
        sizeBytes: null,
        outcome: 'Failed',
      },
    ],
    annotations: [
      {
        createdUtc: '2026-06-24T12:48:11Z',
        author: 'ci-bot',
        object: 'PROD-SQL-01',
        text: 'Deployed checkout v2.4.0 to PROD',
      },
    ],
  };

  // --- Post-mortem renderer (mirrors packages/replay/src/render.ts) ---------

  function cell(value) {
    const s = value == null ? '' : String(value);
    const clean = s.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ').trim();
    return clean === '' ? '—' : clean;
  }
  function codeBlock(code, lang) {
    let longest = 0;
    for (const m of code.matchAll(/`+/g))
      longest = Math.max(longest, m[0].length);
    const fence = '`'.repeat(Math.max(3, longest + 1));
    return `${fence}${lang || ''}\n${code}\n${fence}`;
  }
  function humanizeDuration(ms) {
    const totalMin = Math.round(ms / 60000);
    if (totalMin < 60) return `${totalMin}m`;
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return m === 0 ? `${h}h` : `${h}h ${m}m`;
  }
  function fmtMs(ms) {
    return ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${ms} ms`;
  }
  function fmtBytes(bytes) {
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
  function buildTimeline(data) {
    const e = [];
    for (const a of data.alerts) {
      e.push({
        ts: a.raisedUtc,
        type: 'Alert raised',
        detail: `${a.alertName} on ${a.object}${a.severity ? ` (${a.severity})` : ''}`,
      });
      if (a.clearedUtc) {
        e.push({
          ts: a.clearedUtc,
          type: 'Alert cleared',
          detail: `${a.alertName} on ${a.object}`,
        });
      }
    }
    for (const q of data.slowQueries) {
      e.push({
        ts: q.capturedUtc,
        type: 'Slow query',
        detail: `${fmtMs(q.durationMs)} on ${q.object}${q.database ? `/${q.database}` : ''}`,
      });
    }
    for (const b of data.backups) {
      e.push({
        ts: b.startedUtc,
        type: 'Backup',
        detail: `${b.type} of ${b.object}/${b.database}${b.outcome ? ` — ${b.outcome}` : ''}`,
      });
    }
    for (const n of data.annotations) {
      e.push({
        ts: n.createdUtc,
        type: 'Annotation',
        detail: `${n.author ? `${n.author}: ` : ''}${n.text}`,
      });
    }
    return e.sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts));
  }
  function renderPostMortem(data, title) {
    const w = data.window;
    const durationMs = Date.parse(w.endUtc) - Date.parse(w.startUtc);
    const failedBackups = data.backups.filter(
      (b) => (b.outcome || '').toLowerCase() === 'failed',
    ).length;
    const slowest = data.slowQueries.reduce(
      (m, q) => Math.max(m, q.durationMs),
      0,
    );
    const out = [];
    out.push(`# Post-mortem: ${title}`, '');
    out.push(`> Generated ${new Date().toISOString()} by \`monitor-replay\`.`);
    out.push(
      `> Window: **${w.startUtc} → ${w.endUtc}** (${humanizeDuration(durationMs)}).`,
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
    out.push('## Timeline', '');
    const tl = buildTimeline(data);
    out.push('| Time (UTC) | Event | Detail |', '| --- | --- | --- |');
    for (const e of tl)
      out.push(`| ${cell(e.ts)} | ${cell(e.type)} | ${cell(e.detail)} |`);
    out.push('');
    out.push(`## Alerts (${data.alerts.length})`, '');
    out.push(
      '| Raised (UTC) | Cleared (UTC) | Severity | Object | Alert | Detail |',
      '| --- | --- | --- | --- | --- | --- |',
    );
    for (const a of data.alerts) {
      out.push(
        `| ${cell(a.raisedUtc)} | ${cell(a.clearedUtc || 'still open')} | ${cell(a.severity)} | ${cell(a.object)} | ${cell(a.alertName)} | ${cell(a.detail)} |`,
      );
    }
    out.push('');
    out.push(`## Slow queries (${data.slowQueries.length})`, '');
    [...data.slowQueries]
      .sort((a, b) => b.durationMs - a.durationMs)
      .forEach((q, i) => {
        out.push(
          `### ${i + 1}. ${q.object}${q.database ? `/${q.database}` : ''} — ${fmtMs(q.durationMs)}`,
          `_Captured ${q.capturedUtc}_`,
          '',
          codeBlock(q.query, 'sql'),
          '',
        );
      });
    out.push(`## Backups (${data.backups.length})`, '');
    out.push(
      '| Started (UTC) | Object | Database | Type | Size | Outcome |',
      '| --- | --- | --- | --- | --- | --- |',
    );
    for (const b of data.backups) {
      out.push(
        `| ${cell(b.startedUtc)} | ${cell(b.object)} | ${cell(b.database)} | ${cell(b.type)} | ${cell(fmtBytes(b.sizeBytes))} | ${cell(b.outcome)} |`,
      );
    }
    out.push('');
    out.push(`## Annotations (${data.annotations.length})`, '');
    out.push(
      '| Time (UTC) | Author | Object | Note |',
      '| --- | --- | --- | --- |',
    );
    for (const n of data.annotations) {
      out.push(
        `| ${cell(n.createdUtc)} | ${cell(n.author)} | ${cell(n.object)} | ${cell(n.text)} |`,
      );
    }
    out.push('');
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

  // --- Request routing ------------------------------------------------------

  function deepCopy(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function handle(method, pathname, query, body) {
    const route = `${method} ${pathname}`;
    switch (route) {
      case 'GET /api/health':
        return { ok: true };

      case 'GET /api/status':
        return { connected: true, ...CONNECTION };

      case 'GET /api/groups':
        return deepCopy(liveGroups).sort((a, b) =>
          a.name.localeCompare(b.name),
        );

      case 'GET /api/tags':
        return deepCopy(tagState);

      case 'POST /api/tags/sync': {
        const tagged = new Set(tagState.groups.map((g) => g.name));
        const liveNames = liveGroups.map((g) => g.name);
        const added = liveNames.filter((n) => !tagged.has(n));
        const missing = [...tagged].filter((n) => !liveNames.includes(n));
        if (body && body.write === true) {
          for (const name of added) tagState.groups.push({ name, tags: {} });
          tagState.groups.sort((a, b) => a.name.localeCompare(b.name));
        }
        return {
          added,
          missing,
          written: Boolean(body && body.write === true),
        };
      }

      case 'GET /api/diff': {
        const filters = query.getAll('tag');
        if (applied) return { hasChanges: false, groups: [] };
        const plan = freshPlan();
        plan.groups = plan.groups.filter((g) =>
          planMatchesFilters(g.name, filters),
        );
        plan.hasChanges = plan.groups.length > 0;
        return plan;
      }

      case 'POST /api/apply': {
        const filters = Array.isArray(body && body.filters) ? body.filters : [];
        const plan = applied
          ? { hasChanges: false, groups: [] }
          : (() => {
              const p = freshPlan();
              p.groups = p.groups.filter((g) =>
                planMatchesFilters(g.name, filters),
              );
              p.hasChanges = p.groups.length > 0;
              return p;
            })();
        if (!body || body.confirm !== true) return { applied: false, plan };
        // Count writable field changes; "DR" exists in config but not Monitor.
        const modified = plan.groups.filter((g) => g.status === 'modified');
        const written = modified.reduce((n, g) => n + g.changes.length, 0);
        const missingGroups = plan.groups
          .filter((g) => g.status === 'added')
          .map((g) => g.name);
        applied = true;
        return { applied: true, plan, result: { written, missingGroups } };
      }

      case 'GET /api/doctor':
        return deepCopy(doctorReport);

      case 'GET /api/cost': {
        const addRaw = query.get('add');
        const add = addRaw ? Number(addRaw) : undefined;
        const report = costReport();
        if (add !== undefined && Number.isInteger(add) && add > 0) {
          return { report, projection: costProjection(add) };
        }
        return { report };
      }

      case 'GET /api/replay': {
        const title = query.get('title') || 'Incident replay';
        const markdown = renderPostMortem(incident, title);
        return {
          markdown,
          counts: {
            alerts: incident.alerts.length,
            slowQueries: incident.slowQueries.length,
            backups: incident.backups.length,
            annotations: incident.annotations.length,
          },
        };
      }

      case 'POST /api/annotate': {
        const text =
          body && typeof body.text === 'string' ? body.text.trim() : '';
        if (!text) {
          const err = new Error('Annotation text is required.');
          err.status = 400;
          throw err;
        }
        incident.annotations.push({
          createdUtc: new Date().toISOString(),
          author: 'demo-user',
          object: body && body.object ? String(body.object) : undefined,
          text,
        });
        return { created: true };
      }

      default: {
        const err = new Error(`No such endpoint: ${pathname}.`);
        err.status = 404;
        throw err;
      }
    }
  }

  // --- fetch patch ----------------------------------------------------------

  const realFetch = window.fetch ? window.fetch.bind(window) : null;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  window.fetch = async function (input, init) {
    const url = typeof input === 'string' ? input : input && input.url;
    const parsed = new URL(url, window.location.origin);
    if (!parsed.pathname.startsWith('/api/')) {
      if (realFetch) return realFetch(input, init);
      throw new Error(`Unmocked request: ${url}`);
    }

    const method = ((init && init.method) || 'GET').toUpperCase();
    let body;
    if (init && typeof init.body === 'string') {
      try {
        body = JSON.parse(init.body);
      } catch {
        body = undefined;
      }
    }

    await sleep(120); // a touch of latency so it feels like a real call
    try {
      const data = handle(method, parsed.pathname, parsed.searchParams, body);
      return new Response(JSON.stringify(data), {
        status: 200,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: err.status || 500,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      });
    }
  };

  // --- Bootstrap ------------------------------------------------------------
  // app.js loads after us and ends in an idle state. Once it's parsed, connect
  // and load groups so the demo opens "live".
  window.addEventListener('load', function () {
    try {
      if (!sessionStorage.getItem('rgm-dashboard-token')) {
        sessionStorage.setItem('rgm-dashboard-token', 'demo-token-0123456789');
      }
    } catch {
      /* sessionStorage may be unavailable; the mock ignores auth anyway */
    }
    if (typeof window.refreshStatus === 'function') {
      Promise.resolve(window.refreshStatus()).then(function () {
        if (typeof window.loadGroups === 'function') window.loadGroups();
      });
    }
  });
})();
