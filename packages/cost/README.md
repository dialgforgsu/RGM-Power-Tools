# monitor-cost — license utilization & spend audit

The easiest ROI argument in the suite. `monitor-cost` looks at your Redgate
Monitor licensing and answers two questions:

1. **Where is license spend being wasted?** It surfaces servers that hold a
   monitoring slot but haven't sent data in _N_ days — slots you're paying for
   and not using.
2. **What will it cost to grow?** It projects the license impact of onboarding
   more servers: how many fit in free slots, how many new slots you'd buy, and
   the added spend.

Part of [RGM Power Tools](../../README.md). Same engine and connection details
as the other tools; runs standalone or inside the [dashboard](../server/README.md).

## Usage

```bash
pnpm -r build

export MONITOR_URL="https://monitor.example.com"
export MONITOR_AUTH_TOKEN="your-token-here"

monitor-cost                                  # utilization + waste audit
monitor-cost --cost-per-slot 600 --currency USD   # include spend figures
monitor-cost --idle-days 14                   # stricter "idle" threshold
monitor-cost project --add 10                 # cost to onboard 10 servers
monitor-cost report --json                    # machine-readable
```

Monitor's API doesn't know your contract price, so **cost-per-slot is yours to
provide** — via `--cost-per-slot` or `MONITOR_COST_PER_SLOT`. Without it, the
audit reports slots only (no money). Label the currency with `--currency` or
`MONITOR_CURRENCY`.

### Example output

```
License utilization
  42/50 slots used (84%), 8 free.
  License cost: 30,000 USD.

5 wasted slot(s) = 3,000 USD reclaimable
Licensed servers with no data in 30+ days:
  • OLD-SQL-07 (Stopped, idle 92 days)
  • TEST-DB-02 (Active, never sent data)
  ...
```

## Options

| Flag / env                              | Default | Purpose                                  |
| --------------------------------------- | ------- | ---------------------------------------- |
| `--idle-days` / `MONITOR_IDLE_DAYS`     | `30`    | Days without data before a slot is waste |
| `--cost-per-slot` / `MONITOR_COST_PER_SLOT` | _(none)_ | Per-slot price; enables spend figures |
| `--currency` / `MONITOR_CURRENCY`       | _(none)_ | Label for money output                   |
| `--fail-on-waste`                       | off     | `report` exits 1 if any waste is found   |
| `--add` (project)                       | —       | Number of servers to project onboarding  |
| `--json`                                | off     | Machine-readable output                  |

Connection details resolve exactly as the other tools: `--url`/`--auth-token`,
`MONITOR_URL`/`MONITOR_AUTH_TOKEN`, or `.monitor-config.json`.

## How it works

`monitor-cost` reads per-server status and the license summary, then runs the
math as **pure functions** (`analyzeCost`, `projectCost`) — deterministic and
unit-tested with hand-built data, no live instance required.

## License

[MIT](../../LICENSE)
