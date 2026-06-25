# RGM Power Tools

Open-source CLIs (and a dashboard) that fill gaps in
[Redgate Monitor](https://www.red-gate.com/products/redgate-monitor/). They share
one engine — `@rgm-power-tools/core` — and the same connection details, so each
works on its own or together.

## The tools

| Tool                                        | What it does                                                                                                                         |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| **[monitor-config](packages/alert-config)** | Alert settings as version-controlled YAML — `export` / `diff` / `apply` / `validate`. "Terraform for Monitor alerts."                |
| **[monitor-tagger](packages/tagger)**       | A metadata layer (owner, business unit, criticality, cost center) over groups, as YAML. Tags become filter keys every tool can use.  |
| **[monitor-doctor](packages/doctor)**       | A linter for your install — silent servers, alerts with no notifications, stale metrics, wasted licenses. "`npm audit` for Monitor." |
| **[monitor-replay](packages/replay)**       | Forensic post-mortem generator — an incident window becomes a pre-filled markdown report.                                            |
| **[monitor-annotate](packages/annotate)**   | Auto-annotates the timeline from deploy/CI webhooks, so incidents always have "what changed?" context.                               |
| **[monitor-dashboard](packages/server)**    | Self-hostable web UI + JSON API that drives all of the above.                                                                        |
| **[core](packages/core)**                   | Shared Monitor client, auth, types, and tag engine.                                                                                  |

Each tool's README has its full command reference.

## Example output

A taste of what each tool prints. Terminal output is colorized; shown here in
plain text.

### monitor-config

```text
$ monitor-config diff
Diff: monitor-config.yaml -> live

~ group "Production"
  ~ cpu_utilization.thresholds.high.value: 90 -> 85
  + cpu_utilization.notifications.slack = #prod-alerts
+ group "Staging" (only in live)

2 added, 1 changed, 0 removed.
```

Exit code is `1` when there are differences, so `diff` slots straight into CI.

### monitor-tagger

```text
$ monitor-tagger list --filter criticality=high
┌─────────────┬──────────┬───────────────┬─────────────┬─────────────┐
│ Group       │ Owner    │ Business Unit │ Criticality │ Cost Center │
├─────────────┼──────────┼───────────────┼─────────────┼─────────────┤
│ Production  │ dba-team │ Payments      │ high        │ 4200        │
│ Checkout    │ payments │ Payments      │ high        │ 4200        │
└─────────────┴──────────┴───────────────┴─────────────┴─────────────┘
```

### monitor-doctor

```text
$ monitor-doctor
error    Enabled alert has no notification channel — PROD-SQL-02 / cpu_utilization
        This alert will fire but page nobody.
        [alert-no-notification]
warning  Server has never raised an alert — DEV-SQL-01
        Likely missing alert configuration — a silent blind spot.
        [never-alerting]
error    Decommissioned server still holding a license — OLD-SQL-07
        Stopped 92 days ago but still consuming a monitoring slot.
        [decommissioned-licensed]

3 issue(s): 2 error(s), 1 warning(s).
```

### monitor-replay

Writes a pre-populated markdown post-mortem to stdout (truncated here):

```text
$ monitor-replay --last 2h --title "PROD checkout outage"
# Post-mortem: PROD checkout outage

> Generated 2026-06-24T14:32:00Z by `monitor-replay`.
> Window: **2026-06-24T12:32:00Z → 2026-06-24T14:32:00Z** (2h).

## Summary

- **Alerts:** 3
- **Slow queries:** 7 (slowest 8.4 s)
- **Backups:** 2 (**1 failed**)
- **Annotations:** 1

## Timeline

| Time (UTC) | Event | Detail |
| --- | --- | --- |
| 2026-06-24T12:48:11Z | Annotation | ci-bot: Deployed checkout v2.4.0 to PROD |
| 2026-06-24T12:53:02Z | Alert raised | CPU utilization on PROD-SQL-01 (high) |
| 2026-06-24T13:21:30Z | Alert cleared | CPU utilization on PROD-SQL-01 |

… alert/slow-query/backup tables and an Analysis scaffold (Impact, Root cause,
Resolution, Action items, Lessons) follow.
```

### monitor-annotate

```text
$ monitor-annotate add --text "Deployed web v1.2.3 to PROD" --object PROD-SQL-01
✓ Annotation added to the Monitor timeline.

$ monitor-annotate serve
monitor-annotate receiver listening on http://0.0.0.0:4575
Endpoints: POST /webhook/{github|gitlab|generic}, GET /health
⚠  Put this behind TLS / a reverse proxy — webhooks carry the shared secret.
```

### monitor-dashboard

```text
$ monitor-dashboard --token "$(openssl rand -hex 24)"
RGM Power Tools dashboard listening on http://127.0.0.1:4570 (token auth enabled)
Working directory: /home/dba/monitor-config
```

Then open the URL — the web UI drives every tool above. `core` has no output of
its own; it's the shared library the tools are built on.

## Download / Windows install

Prefer not to install Node? The **dashboard** ships as a self-contained Windows
build — Node runtime, server, and web UI fused into one `.exe`. Two ways to get
it, both produced by `pnpm package` into `packaging/dist/`:

| Option                               | What it is                                                                                                                                  |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **`monitor-dashboard-setup.exe`**    | A simple install wizard — installs the app, adds Start Menu / desktop shortcuts, and launches the dashboard (opens your browser) on finish. |
| **`monitor-dashboard-portable.zip`** | No install: unzip and run `monitor-dashboard.exe`. No admin rights needed.                                                                  |

```bash
pnpm install
pnpm package        # → packaging/dist/{monitor-dashboard-setup.exe, monitor-dashboard-portable.zip, monitor-dashboard.exe}
```

The exe starts on `http://127.0.0.1:4570` and opens your browser. To expose it on
the network, pass `--token <16+ chars> --host 0.0.0.0` (put it behind TLS / a
reverse proxy). It still needs **PowerShell** and the **Redgate Monitor
PowerShell module** present at runtime — those are licensed per instance and
can't be bundled. See [`packaging/`](packaging) for build details and the full
runtime requirements.

## Quickstart

You need **Node 20+**, **PowerShell** (`pwsh` or Windows PowerShell), the
**Redgate Monitor PowerShell module** and an **auth token** (Monitor →
Configuration → API), and **Monitor v14+**.

```bash
pnpm install && pnpm -r build

export MONITOR_URL="https://monitor.example.com"
export MONITOR_AUTH_TOKEN="your-token-here"

# Example: pull live alert settings into YAML, then diff against them
monitor-config init
monitor-config export      # writes monitor-config.yaml
monitor-config diff        # local vs live
```

Connection details come from `--url` / `--auth-token`, the `MONITOR_URL` /
`MONITOR_AUTH_TOKEN` environment variables, or a local `.monitor-config.json`.

> After `pnpm -r build`, run a tool via `pnpm link`, with
> `pnpm --filter @rgm-power-tools/monitor-config exec monitor-config …`, or
> directly as `node packages/<pkg>/dist/cli.js …`.

## How they fit together

Tags authored with `monitor-tagger` work as filter keys elsewhere (e.g.
`monitor-config apply --tag criticality=high`), and the dashboard exposes every
tool over one authenticated API. Anything that writes to Monitor is safe by
default: applies are dry-run until confirmed, the dashboard is token-gated and
loopback-only, and the webhook receiver verifies every request's signature.

## Development

```bash
pnpm -r build       # build every package
pnpm -r test        # run all tests (vitest)
pnpm -r typecheck   # type-check without emitting
pnpm lint           # eslint (flat config)
pnpm format         # prettier --write
```

Built on **pnpm workspaces**; the tools depend on `core` via `workspace:*`.

## License

[MIT](LICENSE)
