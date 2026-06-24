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
