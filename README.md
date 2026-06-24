# RGM Power Tools

Open-source CLIs (and a dashboard) that fill gaps in
[Redgate Monitor](https://www.red-gate.com/products/redgate-monitor/). They share
one engine — `@rgm-power-tools/core` — and the same connection details, so each
works on its own or together.

## The tools

| Tool | What it does |
| ---- | ------------ |
| **[monitor-config](packages/alert-config)** | Alert settings as version-controlled YAML — `export` / `diff` / `apply` / `validate`. "Terraform for Monitor alerts." |
| **[monitor-tagger](packages/tagger)** | A metadata layer (owner, business unit, criticality, cost center) over groups, as YAML. Tags become filter keys every tool can use. |
| **[monitor-doctor](packages/doctor)** | A linter for your install — silent servers, alerts with no notifications, stale metrics, wasted licenses. "`npm audit` for Monitor." |
| **[monitor-cost](packages/cost)** | License utilization & spend audit; flags wasted slots and projects onboarding cost. |
| **[monitor-replay](packages/replay)** | Forensic post-mortem generator — an incident window becomes a pre-filled markdown report. |
| **[monitor-annotate](packages/annotate)** | Auto-annotates the timeline from deploy/CI webhooks, so incidents always have "what changed?" context. |
| **[monitor-dashboard](packages/server)** | Self-hostable web UI + JSON API that drives all of the above. |
| **[core](packages/core)** | Shared Monitor client, auth, types, and tag engine. |

Each tool's README has its full command reference.

## Download / Windows install

Prefer not to install Node? The **dashboard** ships as a self-contained Windows
build — Node runtime, server, and web UI fused into one `.exe`. Two ways to get
it, both produced by `pnpm package` into `packaging/dist/`:

| Option | What it is |
| ------ | ---------- |
| **`monitor-dashboard-setup.exe`** | A simple install wizard — installs the app, adds Start Menu / desktop shortcuts, and launches the dashboard (opens your browser) on finish. |
| **`monitor-dashboard-portable.zip`** | No install: unzip and run `monitor-dashboard.exe`. No admin rights needed. |

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
