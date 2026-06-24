# monitor-doctor — a linter for your Monitor installation

**`npm audit` for Redgate Monitor.** Point it at your instance and it surfaces
the quiet problems that pile up over time:

- **Servers monitored but never alerting** — likely missing alert config; a
  silent blind spot.
- **Alert types with no notification channel** — enabled alerts that trigger but
  page nobody.
- **Custom metrics with no recent data** — queries that have returned nothing in
  30 days (broken or abandoned).
- **Decommissioned servers still consuming licenses** — stopped/retired servers
  you're still paying to license.

Part of [RGM Power Tools](../../README.md). It uses the same engine and
connection details as the other tools, so it runs standalone or alongside them
(it's also built into the [dashboard](../server/README.md)).

## Usage

```bash
pnpm -r build

export MONITOR_URL="https://monitor.example.com"
export MONITOR_AUTH_TOKEN="your-token-here"

monitor-doctor                 # audit everything (alias for `check`)
monitor-doctor check --json    # machine-readable output for CI
monitor-doctor check --check decommissioned-licensed   # one check only
monitor-doctor list            # show available checks
```

Connection details resolve exactly as the other tools: `--url`/`--auth-token`
flags, `MONITOR_URL`/`MONITOR_AUTH_TOKEN`, or `.monitor-config.json`.

## Exit codes (CI-friendly)

`check` exits non-zero when a finding meets the `--fail-on` threshold, so you can
gate a pipeline on it:

```bash
monitor-doctor check --fail-on warning   # fail the build on any warning or error
```

| `--fail-on` | Exit 1 when…                          |
| ----------- | ------------------------------------- |
| `error`     | any error-level finding (default)     |
| `warning`   | any warning- or error-level finding   |
| `info`      | any finding at all                    |

## Checks

| Id                         | Severity | Flags                                                   |
| -------------------------- | -------- | ------------------------------------------------------- |
| `never-alerting`           | warning  | Server-like objects that have never raised an alert     |
| `alert-no-notification`    | error    | Enabled alerts with no notification channel             |
| `stale-custom-metric`      | warning  | Enabled custom metrics with no data in 30 days          |
| `decommissioned-licensed`  | error    | Stopped/decommissioned servers still holding a license  |

Adding a check is a matter of writing a `Check` (a pure function over a gathered
snapshot) and registering it in `src/checks/index.ts`.

## How it works

`monitor-doctor` gathers one read-only snapshot of Monitor state
(`gatherSnapshot`), then runs each check as a pure function over that snapshot —
so checks are deterministic and unit-tested with hand-built data, no live
instance required.

## License

[MIT](../../LICENSE)
