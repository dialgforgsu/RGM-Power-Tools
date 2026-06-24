# monitor-tagger — Tags as Code

A metadata layer for [Redgate Monitor](https://www.red-gate.com/products/redgate-monitor/)
groups. Monitor groups tell you _what_ is monitored; tags tell you _who owns
it_, _which business unit pays for it_, _how critical it is_, and anything else
you want to track. Tags live in a version-controlled YAML file
(`monitor-tags.yaml`) right next to your `monitor-config.yaml`.

Part of [RGM Power Tools](../../README.md). It shares the same engine
(`@rgm-power-tools/core`) as `monitor-config`, and the tag overlay it produces
becomes **filter keys every other tool can use**.

## Why

Monitor has no place to record ownership or cost metadata, and no way to act on
it. With a tag overlay you can answer "which servers does the Payments team own?"
and drive other tools from the answer — e.g. apply alert config only to critical
groups.

## The tag file

```yaml
version: 1
groups:
  - name: Production # must match a Monitor group name
    tags:
      owner: dba-team
      business_unit: Payments
      criticality: high
      cost_center: "4200"
  - name: Development
    tags:
      owner: dba-team
      criticality: low
```

The well-known dimensions every tool understands are **`owner`**,
**`business_unit`**, **`criticality`**, and **`cost_center`**. You can add any
custom keys you like — they all work as filters.

## Commands

| Command                            | What it does                                                        |
| ---------------------------------- | ------------------------------------------------------------------- |
| `monitor-tagger init`              | Scaffold a starter `monitor-tags.yaml`                              |
| `monitor-tagger sync`              | Pull live group names from Monitor; add/keep entries (never deletes) |
| `monitor-tagger list`              | Show groups and tags; filter with `--filter key=value`              |
| `monitor-tagger validate [file]`   | Schema-check the tags file (no network)                             |

### Examples

```bash
# 1. Scaffold and populate from live Monitor groups
monitor-tagger init
monitor-tagger sync                 # adds an entry per live group

# 2. Edit monitor-tags.yaml to fill in owner/criticality/etc., then query
monitor-tagger list --filter owner=dba-team
monitor-tagger list --filter criticality=high --filter criticality=medium
monitor-tagger list --live          # also flag live groups not yet tagged
```

`--filter` is repeatable. Repeating the **same key** is OR (`criticality=high`
OR `criticality=medium`); **different keys** are AND. Value matching is
case-insensitive.

## Using tags from other tools

The tag overlay is read by the whole toolkit. For example, `monitor-config`
accepts the same `--tag` filters to scope a run to matching groups:

```bash
# Only push alert config to groups tagged criticality=high
monitor-config apply --tag criticality=high

# Diff just the Payments business unit
monitor-config diff --tag business_unit=Payments
```

Tagging is opt-in: without `--tag`, the tags file is never read and behavior is
unchanged.

## Configuration

Connection details (for `sync` and `list --live`) are resolved exactly as in
`monitor-config`: `--url`/`--auth-token` flags, the `MONITOR_URL` /
`MONITOR_AUTH_TOKEN` environment variables, or `.monitor-config.json`. The auth
token is never written to the tags file.

## License

[MIT](../../LICENSE)
