# monitor-config — Alert Config as Code

Treat Redgate Monitor alert configuration as version-controlled YAML.
**Terraform for Monitor alerts:** export live settings to YAML, diff
environments, and apply changes idempotently.

## Why

Monitor's alert settings drift across environments over time. There's no native
diff/audit workflow, and the only programmatic surface is the PowerShell API —
which most teams underuse because it needs bespoke scripting. `monitor-config`
turns alert config into a file you can review, commit, and apply.

## Prerequisites

- **Node.js 20+**
- **PowerShell** (`pwsh` 7+, or Windows PowerShell)
- The **Monitor PowerShell module** + an **auth token**, both obtained from your
  Monitor instance: _Configuration → API_. Monitor **v14+** only.

## Quickstart (60 seconds)

```bash
# Build (from the repo root)
pnpm install && pnpm -r build

# Configure credentials (flags, env vars, or .monitor-config.json all work)
export MONITOR_URL="https://monitor.example.com"
export MONITOR_AUTH_TOKEN="your-token-here"

# In a fresh directory for your config repo:
monitor-config init        # scaffold starter YAML + .gitignore + local config
monitor-config validate    # schema-check the YAML (no network)
monitor-config export       # pull live settings into monitor-config.yaml
monitor-config diff         # show local YAML vs live Monitor state
monitor-config apply --dry-run   # preview changes
monitor-config apply             # apply them (prompts for confirmation)
```

> The examples use the `monitor-config` binary. Until it's linked onto your
> `PATH`, run it as `node packages/alert-config/dist/cli.js <command>` or via
> `pnpm --filter @rgm-power-tools/monitor-config exec monitor-config`.

## Authentication

Connection details are resolved in priority order:

1. CLI flags `--url` and `--auth-token`
2. Environment variables `MONITOR_URL` and `MONITOR_AUTH_TOKEN`
3. A `.monitor-config.json` file in the working directory (gitignored by
   default — created by `init`)

The token is **never logged** and **never written** into exported YAML —
exported configs use `${MONITOR_URL}` / `${MONITOR_AUTH_TOKEN}` placeholders.

## Commands

| Command                                | Summary                                                                         |
| -------------------------------------- | ------------------------------------------------------------------------------- |
| `init [--force]`                       | Scaffold a starter `monitor-config.yaml`, `.gitignore`, `.monitor-config.json`. |
| `validate [file]`                      | Schema-check a config. No network. Exit 0 valid, 1 invalid (with line numbers). |
| `export [-o file] [--group n]`         | Pull live groups/servers/alert settings into deterministically-ordered YAML.    |
| `diff [--source f] [--target f\|live]` | Compare configs. Exit 0 if in sync, 1 if different (for CI).                    |
| `apply [--dry-run] [--yes]`            | Plan, confirm, then write only what differs. Idempotent.                        |

Every command supports `--help`. Errors are rendered as friendly messages; pass
`--verbose` for full stack traces.

### diff modes

```bash
monitor-config diff                              # local monitor-config.yaml vs live
monitor-config diff --target live                # explicit form of the above
monitor-config diff --source prod.yaml --target dr.yaml   # two files, no network
```

Output is colorized — added settings green, removed red, changed yellow —
grouped by group. Exit code `1` when differences are found, so it slots into CI.

## Config schema

YAML is authored in `snake_case`. The schema is defined with [zod] in
[`src/schema.ts`](src/schema.ts) and is the single source of truth.

```yaml
version: 1

connection:
  base_monitor_url: ${MONITOR_URL}
  auth_token: ${MONITOR_AUTH_TOKEN}

groups:
  - name: Production
    description: Customer-facing production servers
    servers:
      - PROD-SQL-01
      - PROD-SQL-02
    alerts:
      cpu_utilization:
        enabled: true
        thresholds:
          high: { value: 90, duration_seconds: 600 }
          medium: { value: 75, duration_seconds: 300 }
        notifications:
          email: [dba-oncall@example.com]
          slack: '#prod-alerts'
      long_running_query:
        enabled: true
        threshold_seconds: 600
      disk_space:
        enabled: true
        thresholds:
          high: { value: 95 }
          medium: { value: 85 }

  # Inherit from another group and override only what differs.
  - name: Development
    inherits_from: Production
    servers:
      - DEV-SQL-01
    overrides:
      alerts:
        cpu_utilization:
          enabled: false
        long_running_query:
          threshold_seconds: 1800
```

### Inheritance

A group may `inherit_from` another group and supply `overrides.alerts` to change
only specific fields. Inheritance is resolved (flattened) before diff/apply, and
`export` always writes **flat, fully-resolved** groups — it never reverse-engineers
inheritance, which keeps exports deterministic and diffs stable.

### Supported alerts

The MVP ships a curated, strongly-typed subset. Unknown alert keys are rejected
by `validate`:

`cpu_utilization`, `memory_utilization`, `disk_space`, `long_running_query`,
`blocking_process`, `deadlock`, `job_failed`.

Adding another alert is a two-line change: a schema entry in
[`src/schema.ts`](src/schema.ts) and an ID in
[`src/alert-types.ts`](src/alert-types.ts).

## Worked example: keep DR in sync with PROD

```bash
# 1. Capture both environments to files
monitor-config export --url https://prod-monitor  -o prod.yaml
monitor-config export --url https://dr-monitor     -o dr.yaml

# 2. See exactly how DR has drifted from PROD
monitor-config diff --source prod.yaml --target dr.yaml

# 3. Make dr.yaml the source of truth, edit as needed, then apply to DR
cp prod.yaml monitor-config.yaml
monitor-config apply --url https://dr-monitor --dry-run   # review the plan
monitor-config apply --url https://dr-monitor             # apply
monitor-config apply --url https://dr-monitor             # idempotent: no-op
```

## How it talks to Monitor

`monitor-config` shells out to the Monitor PowerShell module via the
[`@rgm-power-tools/core`](../core) `MonitorClient`. PowerShell is an
implementation detail behind that interface, so it could later swap to direct
HTTP without touching this package.

> ⚠️ **Alert-type IDs.** The numeric `AlertType` values the write cmdlet needs
> are mapped in [`src/alert-types.ts`](src/alert-types.ts). They're aligned to
> the documented taxonomy but **must be confirmed against your instance** before
> relying on `apply` in production — read them from the live module and adjust.

## Testing

```bash
pnpm --filter @rgm-power-tools/monitor-config test
```

Tests use a mock `MonitorClient` (no live instance or PowerShell required), so
the full suite — including `export`/`diff`/`apply` integration tests — runs
offline.

[zod]: https://zod.dev
