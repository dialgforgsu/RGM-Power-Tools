'use strict';

// The dashboard never sees the Monitor auth token; it authenticates to this
// server with a separate bearer token, kept in sessionStorage for the tab only.
const TOKEN_KEY = 'rgm-dashboard-token';

function getToken() {
  return sessionStorage.getItem(TOKEN_KEY) || '';
}
function setToken(value) {
  if (value) sessionStorage.setItem(TOKEN_KEY, value);
  else sessionStorage.removeItem(TOKEN_KEY);
}

function log(message, kind) {
  const el = document.getElementById('log');
  const time = new Date().toLocaleTimeString();
  const line = `[${time}] ${message}\n`;
  el.append(line);
  el.scrollTop = el.scrollHeight;
  if (kind === 'error') console.error(message);
}

async function api(method, path, body) {
  const headers = {};
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* non-JSON */
  }
  if (!res.ok) {
    const msg = (data && data.error) || `${res.status} ${res.statusText}`;
    throw new Error(msg);
  }
  return data;
}

function setConnected(ok, text) {
  const dot = document.getElementById('conn-dot');
  dot.classList.toggle('ok', ok === true);
  dot.classList.toggle('bad', ok === false);
  document.getElementById('conn-text').textContent = text;
}

function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

function el(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined && text !== null) node.textContent = String(text);
  if (className) node.className = className;
  return node;
}

// --- Actions ---------------------------------------------------------------

async function refreshStatus() {
  try {
    const s = await api('GET', '/api/status');
    document.getElementById('st-url').textContent = s.baseUrl;
    document.getElementById('st-token').textContent = s.tokenHint;
    document.getElementById('st-workdir').textContent = s.workdir;
    setConnected(true, 'Connected');
    log('Connected to Monitor.');
  } catch (err) {
    setConnected(false, 'Error');
    log(`Status failed: ${err.message}`, 'error');
  }
}

async function loadGroups() {
  const body = document.getElementById('groups-body');
  try {
    const groups = await api('GET', '/api/groups');
    clear(body);
    if (!groups.length) {
      const tr = el('tr');
      tr.append(el('td', 'No groups found.', 'muted'));
      body.append(tr);
      return;
    }
    for (const g of groups) {
      const tr = el('tr');
      tr.append(el('td', g.name));
      tr.append(el('td', g.servers));
      body.append(tr);
    }
    log(`Loaded ${groups.length} group(s).`);
  } catch (err) {
    log(`Load groups failed: ${err.message}`, 'error');
  }
}

async function loadTags() {
  const area = document.getElementById('tags-area');
  try {
    const set = await api('GET', '/api/tags');
    clear(area);
    if (!set.groups || !set.groups.length) {
      area.append(el('p', 'No tags defined yet.', 'muted'));
      return;
    }
    const keys = [];
    for (const g of set.groups) {
      for (const k of Object.keys(g.tags || {})) {
        if (!keys.includes(k)) keys.push(k);
      }
    }
    const table = el('table');
    const thead = el('thead');
    const htr = el('tr');
    htr.append(el('th', 'Group'));
    for (const k of keys) htr.append(el('th', k));
    thead.append(htr);
    table.append(thead);
    const tbody = el('tbody');
    for (const g of set.groups) {
      const tr = el('tr');
      tr.append(el('td', g.name));
      for (const k of keys) tr.append(el('td', (g.tags || {})[k] || '—'));
      tbody.append(tr);
    }
    table.append(tbody);
    area.append(table);
    log(`Loaded tags for ${set.groups.length} group(s).`);
  } catch (err) {
    log(`Load tags failed: ${err.message}`, 'error');
  }
}

async function syncTags(write) {
  try {
    const r = await api('POST', '/api/tags/sync', { write: write === true });
    log(
      `Tag sync: ${r.added.length} new, ${r.missing.length} missing-live` +
        (r.written ? ' (written).' : ' (dry run).'),
    );
    if (r.added.length) log(`  new: ${r.added.join(', ')}`);
    if (r.missing.length) log(`  missing live: ${r.missing.join(', ')}`);
    if (write) await loadTags();
  } catch (err) {
    log(`Tag sync failed: ${err.message}`, 'error');
  }
}

function parseFilters() {
  return document
    .getElementById('filter-input')
    .value.split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function renderPlan(plan) {
  const area = document.getElementById('plan-area');
  clear(area);
  if (!plan.hasChanges) {
    area.append(
      el('p', 'No changes — Monitor matches the local config.', 'muted'),
    );
    return;
  }
  for (const group of plan.groups) {
    const wrap = el('div', null, 'group-diff');
    if (group.status === 'added') {
      wrap.append(el('h3', `+ ${group.name} (only desired)`, 'change-add'));
    } else if (group.status === 'removed') {
      wrap.append(el('h3', `- ${group.name} (only live)`, 'change-remove'));
    } else {
      wrap.append(el('h3', `~ ${group.name}`, 'change-mod'));
      for (const c of group.changes) {
        const cls =
          c.kind === 'added'
            ? 'change-add'
            : c.kind === 'removed'
              ? 'change-remove'
              : 'change-mod';
        const sign =
          c.kind === 'added' ? '+' : c.kind === 'removed' ? '-' : '~';
        const detail =
          c.kind === 'changed'
            ? `${c.path}: ${JSON.stringify(c.from)} → ${JSON.stringify(c.to)}`
            : `${c.path} = ${JSON.stringify(c.kind === 'added' ? c.to : c.from)}`;
        wrap.append(el('div', `  ${sign} ${detail}`, cls));
      }
    }
    area.append(wrap);
  }
}

async function showPlan() {
  try {
    const filters = parseFilters();
    const query = filters.map((f) => `tag=${encodeURIComponent(f)}`).join('&');
    const plan = await api('GET', `/api/diff${query ? `?${query}` : ''}`);
    renderPlan(plan);
    log(`Plan: ${plan.groups.length} group(s) with changes.`);
  } catch (err) {
    log(`Plan failed: ${err.message}`, 'error');
  }
}

async function applyChanges() {
  const filters = parseFilters();
  const scope = filters.length ? ` matching ${filters.join(', ')}` : '';
  if (
    !window.confirm(`Apply local alert config to Monitor for groups${scope}?`)
  ) {
    return;
  }
  try {
    const r = await api('POST', '/api/apply', { confirm: true, filters });
    renderPlan(r.plan);
    const written = r.result ? r.result.written : 0;
    log(`Applied ${written} change(s).`);
    if (r.result && r.result.missingGroups.length) {
      log(`  skipped (not in Monitor): ${r.result.missingGroups.join(', ')}`);
    }
  } catch (err) {
    log(`Apply failed: ${err.message}`, 'error');
  }
}

async function addAnnotation() {
  const textEl = document.getElementById('annot-text');
  const objectEl = document.getElementById('annot-object');
  const text = textEl.value.trim();
  if (!text) {
    log('Annotation text is required.', 'error');
    return;
  }
  try {
    await api('POST', '/api/annotate', {
      text,
      object: objectEl.value.trim() || undefined,
    });
    log(`Annotation added: ${text}`);
    textEl.value = '';
    objectEl.value = '';
  } catch (err) {
    log(`Annotate failed: ${err.message}`, 'error');
  }
}

async function runReplay() {
  const out = document.getElementById('replay-output');
  const params = new URLSearchParams();
  const last = document.getElementById('replay-last').value.trim();
  const from = document.getElementById('replay-from').value.trim();
  const to = document.getElementById('replay-to').value.trim();
  const title = document.getElementById('replay-title').value.trim();
  if (last) params.set('last', last);
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  if (title) params.set('title', title);
  out.value = 'Generating…';
  try {
    const data = await api('GET', `/api/replay?${params.toString()}`);
    out.value = data.markdown;
    const c = data.counts;
    log(
      `Post-mortem generated: ${c.alerts} alert(s), ${c.slowQueries} slow ` +
        `quer(y/ies), ${c.backups} backup(s), ${c.annotations} annotation(s).`,
    );
  } catch (err) {
    out.value = '';
    log(`Replay failed: ${err.message}`, 'error');
  }
}

async function copyReplay() {
  const text = document.getElementById('replay-output').value;
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    log('Post-mortem markdown copied to clipboard.');
  } catch {
    log('Copy failed — select the text and copy manually.', 'error');
  }
}

function money(amount, currency) {
  const s = Number(amount).toLocaleString('en-US');
  return currency ? `${s} ${currency}` : s;
}

async function runCost(add) {
  const area = document.getElementById('cost-area');
  try {
    const q = add ? `?add=${encodeURIComponent(add)}` : '';
    const data = await api('GET', `/api/cost${q}`);
    const r = data.report;
    clear(area);
    area.append(
      el(
        'div',
        `Slots: ${r.usedSlots}/${r.totalSlots} used (${r.utilizationPct}%), ${r.freeSlots} free.`,
      ),
    );
    if (r.licenseCost != null) {
      area.append(
        el('div', `License cost: ${money(r.licenseCost, r.currency)}.`),
      );
    }
    if (r.wastedSlots === 0) {
      area.append(el('p', '✓ No wasted slots.', 'muted'));
    } else {
      const head =
        r.wastedSpend != null
          ? `${r.wastedSlots} wasted slot(s) = ${money(r.wastedSpend, r.currency)} reclaimable`
          : `${r.wastedSlots} wasted slot(s)`;
      area.append(el('div', head, 'change-mod'));
      for (const s of r.idleServers) {
        const age =
          s.daysIdle == null ? 'never sent data' : `idle ${s.daysIdle} days`;
        area.append(
          el('div', `• ${s.name} (${s.status}, ${age})`, 'finding-detail'),
        );
      }
    }
    if (data.projection) {
      const p = data.projection;
      let line;
      if (p.withinLicense) {
        line = `Onboarding ${p.addServers}: fits within ${p.freeSlots} free slot(s).`;
      } else {
        line = `Onboarding ${p.addServers}: needs ${p.additionalSlotsNeeded} new slot(s)`;
        line +=
          p.additionalSpend != null
            ? ` = ${money(p.additionalSpend, p.currency)}.`
            : '.';
      }
      area.append(el('div', line, 'finding-subject'));
    }
    log('Cost audit complete.');
  } catch (err) {
    log(`Cost audit failed: ${err.message}`, 'error');
  }
}

async function runDoctor() {
  const area = document.getElementById('doctor-area');
  const summary = document.getElementById('doctor-summary');
  summary.textContent = 'Running…';
  try {
    const report = await api('GET', '/api/doctor');
    clear(area);
    if (report.total === 0) {
      summary.textContent = '';
      area.append(el('p', '✓ No issues found.', 'muted'));
      log('Health check: no issues found.');
      return;
    }
    summary.textContent =
      `${report.counts.error} error, ${report.counts.warning} warning, ` +
      `${report.counts.info} info`;
    for (const f of report.findings) {
      const row = el('div', null, 'finding');
      row.append(el('span', f.severity, `badge ${f.severity}`));
      const bodyEl = el('div', null, 'finding-body');
      const head = el('div');
      head.append(el('span', f.title));
      if (f.subject) {
        head.append(document.createTextNode(' — '));
        head.append(el('span', f.subject, 'finding-subject'));
      }
      bodyEl.append(head);
      if (f.detail) bodyEl.append(el('div', f.detail, 'finding-detail'));
      bodyEl.append(el('div', `[${f.checkId}]`, 'finding-check'));
      row.append(bodyEl);
      area.append(row);
    }
    log(`Health check: ${report.total} issue(s).`);
  } catch (err) {
    summary.textContent = '';
    log(`Health check failed: ${err.message}`, 'error');
  }
}

function promptToken() {
  const current = getToken();
  const next = window.prompt('Dashboard bearer token:', current);
  if (next === null) return;
  setToken(next.trim());
  log('Token updated.');
  refreshStatus();
}

// --- Wire up ---------------------------------------------------------------

document.getElementById('token-btn').addEventListener('click', promptToken);
document
  .getElementById('refresh-btn')
  .addEventListener('click', () => refreshStatus().then(loadGroups));
document.getElementById('tags-load-btn').addEventListener('click', loadTags);
document
  .getElementById('tags-sync-btn')
  .addEventListener('click', () => syncTags(false));
document
  .getElementById('tags-sync-write-btn')
  .addEventListener('click', () => syncTags(true));
document.getElementById('plan-btn').addEventListener('click', showPlan);
document.getElementById('apply-btn').addEventListener('click', applyChanges);
document.getElementById('doctor-btn').addEventListener('click', runDoctor);
document.getElementById('cost-btn').addEventListener('click', () => runCost());
document.getElementById('cost-project-btn').addEventListener('click', () => {
  const n = parseInt(document.getElementById('cost-add').value, 10);
  runCost(Number.isInteger(n) && n > 0 ? n : undefined);
});
document.getElementById('replay-btn').addEventListener('click', runReplay);
document.getElementById('replay-copy').addEventListener('click', copyReplay);
document.getElementById('annot-btn').addEventListener('click', addAnnotation);

// Don't connect on load — the dashboard and its tools open without contacting
// Monitor. The connection (and any token) is only needed once you use a tool:
// hit "Refresh", load groups, run a check, etc. Each action connects on demand.
setConnected(null, 'Not connected — use any tool to connect.');
