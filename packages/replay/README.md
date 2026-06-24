# monitor-replay — forensic post-mortem generator

Turns 90 minutes of incident-review prep into 5. Give it an incident time
window and it pulls **every alert, slow query, backup, and annotation** from
Redgate Monitor and assembles a pre-populated markdown post-mortem — a merged
timeline plus tables, with an analysis scaffold left for the humans.

Part of [RGM Power Tools](../../README.md). Same engine and connection details
as the other tools; runs standalone or inside the [dashboard](../server/README.md).

## Usage

```bash
pnpm -r build

export MONITOR_URL="https://monitor.example.com"
export MONITOR_AUTH_TOKEN="your-token-here"

# Relative window ending now
monitor-replay --last 2h > postmortem.md

# Explicit window, write to a file, custom title
monitor-replay \
  --from 2026-06-24T01:00:00Z \
  --to   2026-06-24T02:30:00Z \
  --title "PROD checkout outage" \
  --output postmortem.md
```

The markdown goes to **stdout** (so you can pipe/redirect it); with `--output`
it's written to a file and a one-line summary is printed to stderr.

## Options

| Flag                  | Purpose                                              |
| --------------------- | ---------------------------------------------------- |
| `--last <duration>`   | Window ending now, e.g. `90m`, `2h`, `1d`            |
| `--from <iso>` / `--to <iso>` | Explicit ISO-8601 UTC window                 |
| `--title <title>`     | Post-mortem title                                    |
| `-o, --output <file>` | Write to a file instead of stdout                    |
| `--url` / `--auth-token` | Override connection (else env/`.monitor-config.json`) |

Provide **either** `--last` **or** `--from`/`--to`.

## What the report contains

- **Header** — title, generated timestamp, and the window with its duration.
- **Summary** — counts of alerts/queries/backups/annotations, slowest query,
  failed-backup highlight, and a blank for the narrative.
- **Timeline** — every event merged into one chronological table.
- **Alerts / Slow queries / Backups / Annotations** — detailed sections (slow
  queries rendered as fenced SQL blocks, byte sizes and durations humanized).
- **Analysis** — Impact / Root cause / Resolution / Action items / Lessons,
  pre-stubbed with TODOs.

## How it works

`monitor-replay` resolves the window, gathers the four time-windowed reads in
parallel, and renders the markdown with a **pure** function (`renderPostMortem`)
— deterministic and unit-tested with hand-built data, no live instance required.

## License

[MIT](../../LICENSE)
