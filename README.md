# RGM Power Tools

Open-source power tools that supplement [Redgate Monitor](https://www.red-gate.com/products/redgate-monitor/)
for power users. A monorepo of focused CLIs that fill gaps in Monitor's native
workflows.

The tools are designed to **work together**: they share one engine
(`@rgm-power-tools/core` — the Monitor client, auth, and types) and a common
YAML conventions, so output from one is input to the next. `monitor-tagger`
adds a metadata layer (owner, business unit, criticality, cost center) that
every other tool — including `monitor-config` — can use as filter keys.

## Packages

| Package                                          | What it does                                                                |
| ------------------------------------------------ | --------------------------------------------------------------------------- |
| [`packages/core`](packages/core)                 | Shared Monitor client (PowerShell-backed), auth, types, and the tag engine  |
| [`packages/alert-config`](packages/alert-config) | `monitor-config` — treat Monitor alert settings as version-controlled YAML  |
| [`packages/tagger`](packages/tagger)             | `monitor-tagger` — a metadata/tagging layer over Monitor groups, as YAML    |
| [`packages/doctor`](packages/doctor)             | `monitor-doctor` — a linter/audit for your Monitor installation             |
| [`packages/cost`](packages/cost)                 | `monitor-cost` — license utilization & spend audit, with onboarding projection |
| [`packages/replay`](packages/replay)             | `monitor-replay` — forensic post-mortem generator from an incident window   |
| [`packages/server`](packages/server)             | `monitor-dashboard` — self-hostable web dashboard + JSON API for the tools  |

## monitor-config — Alert Config as Code

Think **"Terraform for Monitor alerts."** Monitor's alert settings drift across
environments over time, there's no native diff/audit workflow, and the only
programmatic surface is the PowerShell API. `monitor-config` wraps that API in a
Git-friendly YAML workflow:

- **export** — pull every alert setting into a YAML file you can commit
- **diff** — see what differs between PROD and DR, or between live and committed
- **apply** — push YAML back into Monitor, idempotently
- **validate** — schema-check YAML before applying

See **[packages/alert-config/README.md](packages/alert-config/README.md)** for
the full command reference and worked example.

## monitor-tagger — Tags as Code

Monitor groups tell you _what_ is monitored, but not _who owns it_, _which
business unit pays for it_, or _how critical it is_. `monitor-tagger` adds that
metadata layer as version-controlled YAML alongside your `monitor-config`:

- **init** — scaffold a starter `monitor-tags.yaml`
- **sync** — pull live group names from Monitor and scaffold/refresh tag entries
- **list** — show groups and their tags, filtered by any tag (`--filter owner=dba-team`)
- **validate** — schema-check the tags file

Tags are well-known dimensions (`owner`, `business_unit`, `criticality`,
`cost_center`) plus any custom keys you add. They become **filter keys every
other tool can use**: for example, apply alert config only to critical servers:

```bash
monitor-config apply --tag criticality=high
```

The tag engine lives in `@rgm-power-tools/core`, so future tools get the same
filtering for free. See **[packages/tagger/README.md](packages/tagger/README.md)**.

## monitor-doctor — lint your Monitor installation

**`npm audit` for Monitor.** It finds the quiet problems that accumulate: servers
monitored but never alerting, alert types with no notification channel, custom
metrics that haven't returned data in 30 days, and decommissioned servers still
consuming licenses.

```bash
export MONITOR_URL=https://monitor.example.com MONITOR_AUTH_TOKEN=...
monitor-doctor                          # audit everything
monitor-doctor check --fail-on warning  # CI gate (exit 1 on warnings+)
monitor-doctor list                     # show the checks
```

Checks are pure functions over a single gathered snapshot, so new audits are
easy to add. See **[packages/doctor/README.md](packages/doctor/README.md)**.

## monitor-cost — license utilization & spend audit

The easiest ROI argument in the suite. It surfaces servers paying for monitoring
slots that haven't sent data in N days (wasted spend), and projects what
onboarding more servers will cost.

```bash
export MONITOR_URL=https://monitor.example.com MONITOR_AUTH_TOKEN=...
monitor-cost --cost-per-slot 600 --currency USD   # utilization + reclaimable $
monitor-cost project --add 10                     # cost to onboard 10 servers
```

Cost-per-slot is yours to supply (`--cost-per-slot` / `MONITOR_COST_PER_SLOT`);
without it the audit reports slots only. See
**[packages/cost/README.md](packages/cost/README.md)**.

## monitor-replay — forensic post-mortem generator

Turns 90 minutes of incident-review prep into 5. Give it a time window and it
pulls every alert, slow query, backup, and annotation from Monitor into a
pre-populated markdown post-mortem — merged timeline, tables, and an analysis
scaffold with TODOs.

```bash
export MONITOR_URL=https://monitor.example.com MONITOR_AUTH_TOKEN=...
monitor-replay --last 2h > postmortem.md
monitor-replay --from 2026-06-24T01:00:00Z --to 2026-06-24T02:30:00Z \
  --title "PROD outage" --output postmortem.md
```

The factual sections are filled from Monitor; the analysis is yours to write.
See **[packages/replay/README.md](packages/replay/README.md)**.

## monitor-dashboard — self-host the whole toolkit

Prefer a UI over the CLIs? Run the self-hostable dashboard. It wraps the same
engine in a small web app + JSON API so you can check the connection, browse
groups, manage tags, and preview/apply alert config (tag-scoped) from one place.

```bash
# Node
pnpm -r build
export MONITOR_URL=https://monitor.example.com MONITOR_AUTH_TOKEN=...
export DASHBOARD_TOKEN="$(openssl rand -hex 24)"   # required
node packages/server/dist/cli.js --workdir /path/to/config-repo
# -> http://127.0.0.1:4570

# Docker (one command)
DASHBOARD_TOKEN=$(openssl rand -hex 24) \
MONITOR_URL=https://monitor.example.com MONITOR_AUTH_TOKEN=... \
docker compose up --build
```

It binds loopback by default, gates every API route behind a constant-time
bearer token, never sends the Monitor token to the browser, and makes applies
explicit (dry-run unless confirmed). See
**[packages/server/README.md](packages/server/README.md)** for the security
model and full API.

## Prerequisites

- **Node.js 20+**
- **PowerShell** — `pwsh` (PowerShell 7+) or Windows PowerShell
- The **Redgate Monitor PowerShell module**, downloaded from your Monitor
  instance (Configuration → API → _Downloading the PowerShell Module_)
- A **Monitor auth token**, generated from the same screen
- Monitor **v14 or later**

## Quickstart (60 seconds)

```bash
# 1. Install dependencies and build
pnpm install
pnpm -r build

# 2. Point the CLI at your Monitor instance
export MONITOR_URL="https://monitor.example.com"
export MONITOR_AUTH_TOKEN="your-token-here"

# 3. Scaffold a config repo, pull live settings, and diff
cd my-monitor-config
node ../packages/alert-config/dist/cli.js init
node ../packages/alert-config/dist/cli.js export      # writes monitor-config.yaml
node ../packages/alert-config/dist/cli.js diff        # local vs live
```

(After `pnpm -r build`, the `monitor-config` binary is also available via
`pnpm --filter @rgm-power-tools/monitor-config exec monitor-config …`, or
link it globally with `pnpm link`.)

## Development

```bash
pnpm install          # install all workspace deps
pnpm -r build         # build every package
pnpm -r test          # run all unit + integration tests (vitest)
pnpm -r typecheck     # type-check without emitting
pnpm lint             # eslint (flat config)
pnpm format           # prettier --write
```

The monorepo uses **pnpm workspaces**. `core` is consumed by the tools as
`@rgm-power-tools/core` (a `workspace:*` dependency) and exports clean
TypeScript types so future tools can reuse them.

## License

[MIT](LICENSE)
