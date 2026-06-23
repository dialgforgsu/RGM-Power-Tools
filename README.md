# Redgate Monitor Power Tools

Open-source power tools that supplement [Redgate Monitor](https://www.red-gate.com/products/redgate-monitor/)
for power users. A monorepo of focused CLIs and services that fill gaps in
Monitor's native workflows.

> **Status:** early. The first tool — **Alert Config as Code** — is here. A
> second tool (Webhook Enrichment Proxy) is reserved and coming next.

## Packages

| Package                                            | What it does                                                               |
| -------------------------------------------------- | -------------------------------------------------------------------------- |
| [`packages/core`](packages/core)                   | Shared Monitor client (PowerShell-backed), auth, and TypeScript types      |
| [`packages/alert-config`](packages/alert-config)   | `monitor-config` — treat Monitor alert settings as version-controlled YAML |
| [`packages/webhook-proxy`](packages/webhook-proxy) | Reserved placeholder — coming next                                         |

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
`pnpm --filter @redgate-power-tools/monitor-config exec monitor-config …`, or
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
`@redgate-power-tools/core` (a `workspace:*` dependency) and exports clean
TypeScript types so future tools can reuse them.

## License

[MIT](LICENSE)
