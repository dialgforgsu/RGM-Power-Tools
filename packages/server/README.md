# monitor-dashboard — self-hostable control plane

A small, self-hostable web dashboard and JSON API that drives the rest of the
RGM Power Tools from one place: check the Monitor connection, browse groups,
manage [tags](../tagger/README.md), run the
[health audit](../doctor/README.md) and
[license/cost audit](../cost/README.md), generate an incident
[post-mortem](../replay/README.md), add timeline
[annotations](../annotate/README.md), and preview/apply
[alert config](../alert-config/README.md) — including tag-scoped applies.

It reuses the same engine (`@rgm-power-tools/core`) and tool logic as the CLIs,
so the dashboard and the command line stay in lock-step.

## Running it

### With Node

```bash
pnpm -r build

export MONITOR_URL="https://monitor.example.com"
export MONITOR_AUTH_TOKEN="your-monitor-token"
export DASHBOARD_TOKEN="$(openssl rand -hex 24)"   # required

# Serve from the directory holding monitor-config.yaml / monitor-tags.yaml
node packages/server/dist/cli.js --workdir /path/to/your/config-repo
# -> http://127.0.0.1:4570
```

Open the URL, click **Set token**, paste your `DASHBOARD_TOKEN`, and you're in.

### With Docker (self-host)

From the repo root:

```bash
DASHBOARD_TOKEN=$(openssl rand -hex 24) \
MONITOR_URL=https://monitor.example.com \
MONITOR_AUTH_TOKEN=... \
docker compose up --build
```

The port is published to `127.0.0.1` only. See [`Dockerfile`](../../Dockerfile)
and [`docker-compose.yml`](../../docker-compose.yml). The container ships
PowerShell 7; mount the Redgate Monitor PowerShell module and set `PSModulePath`
(it is licensed per Monitor instance and not bundled).

## Options

| Flag / env                          | Default     | Purpose                                    |
| ----------------------------------- | ----------- | ------------------------------------------ |
| `--host` / `DASHBOARD_HOST`         | `127.0.0.1` | Interface to bind                          |
| `--port` / `DASHBOARD_PORT`         | `4570`      | TCP port                                   |
| `--token` / `DASHBOARD_TOKEN`       | _(none)_    | Bearer token the API requires (≥16 chars)  |
| `--workdir` / `RGM_WORKDIR`         | cwd         | Where the YAML files live                  |
| `--no-auth`                         | off         | Run without a token (loopback only)        |

Monitor connection details (`MONITOR_URL`, `MONITOR_AUTH_TOKEN`,
`.monitor-config.json`, or `--url`/`--auth-token`) are resolved exactly as the
CLIs do.

## Security model

This service can read your Monitor instance and **push alert config to it**, so
it is treated as sensitive by design:

- **Token-gated API.** Every `/api/*` route (except `/api/health`) requires
  `Authorization: Bearer <DASHBOARD_TOKEN>`, compared in constant time. The
  server refuses to start without a token unless you pass `--no-auth`, and it
  will **never** bind a public interface without a token.
- **Loopback by default.** Binds `127.0.0.1`; exposing it off-host warns you and
  should be done only behind TLS + a reverse proxy.
- **The Monitor token never reaches the browser.** The API returns only a
  redacted hint (`abcd…yz`).
- **Apply is explicit.** `POST /api/apply` is a dry run that returns the plan
  unless the body sets `confirm: true`.
- **Hardened transport.** Strict `Content-Security-Policy` (no inline scripts),
  `nosniff`, `X-Frame-Options: DENY`, JSON body size limit, directory-traversal
  protection on static files, and no internal error details leaked to clients.

## API

| Method & path              | Body / query              | Returns                          |
| -------------------------- | ------------------------- | -------------------------------- |
| `GET /api/health`          | —                         | `{ ok: true }` (open)            |
| `GET /api/status`          | —                         | connection + redacted token      |
| `GET /api/groups`          | —                         | live groups + server counts      |
| `GET /api/config`          | —                         | local `monitor-config.yaml` text |
| `POST /api/config/validate`| —                         | `{ valid: true }` or 400         |
| `GET /api/diff`            | `?tag=key=value` (repeat) | plan (live → desired)            |
| `POST /api/apply`          | `{ confirm?, filters? }`  | plan, and result when confirmed  |
| `GET /api/tags`            | —                         | the tag overlay                  |
| `POST /api/tags/validate`  | —                         | `{ valid, groups, tagged }`      |
| `POST /api/tags/sync`      | `{ write? }`              | `{ added, missing, written }`    |
| `GET /api/doctor`          | —                         | installation health report       |
| `GET /api/cost`            | `?add=<n>` (optional)     | license utilization + projection |
| `GET /api/replay`          | `?from=&to=` or `?last=`  | markdown post-mortem + counts    |
| `POST /api/annotate`       | `{ text, object?, author? }` | write a manual timeline annotation |

## License

[MIT](../../LICENSE)
