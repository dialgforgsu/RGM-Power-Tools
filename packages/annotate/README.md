# monitor-annotate — deploy/CI annotations on the Monitor timeline

Incidents always start with "what changed?" `monitor-annotate` answers it
automatically: it receives deploy/CI webhooks and writes annotations onto the
Redgate Monitor timeline, so when an alert fires you can see the deploy that
preceded it right next to it.

Part of [RGM Power Tools](../../README.md). Same engine and connection details
as the other tools. Two ways to use it: a **webhook receiver** for automation,
and a one-shot **`add`** for deploy scripts.

## 1. Webhook receiver

```bash
pnpm -r build

export MONITOR_URL="https://monitor.example.com"
export MONITOR_AUTH_TOKEN="your-monitor-token"
export ANNOTATE_WEBHOOK_SECRET="$(openssl rand -hex 24)"   # required

monitor-annotate serve            # listens on 0.0.0.0:4575
```

Point your CI/CD at it:

| Provider  | Endpoint                  | Auth                                          |
| --------- | ------------------------- | --------------------------------------------- |
| GitHub    | `POST /webhook/github`    | `X-Hub-Signature-256` HMAC (the secret)       |
| GitLab    | `POST /webhook/gitlab`    | `X-Gitlab-Token` = the secret                 |
| Generic   | `POST /webhook/generic`   | `X-Signature-256` HMAC (the secret)           |

- GitHub understands `deployment_status`, `deployment`, `release`, and `push`.
- GitLab understands Deployment and Pipeline hooks.
- Generic accepts any JSON: `{ text?, app?, version?, environment?, ref?, sha?,
  actor?, status?, object?, url?, time? }`. A `text` field is used verbatim.

In-progress events (`running`/`pending`/…) are skipped; terminal outcomes
(`success`/`failed`) and releases are annotated. Add `?object=PROD-SQL-01` to a
webhook URL to attach the annotation to a specific monitored object.

`GET /health` returns `{ ok: true }` for liveness probes.

### Security

The receiver **writes to Monitor**, so it never runs unauthenticated:

- A `ANNOTATE_WEBHOOK_SECRET` (≥16 chars) is **mandatory**; every webhook is
  verified against it — HMAC signatures (GitHub/generic) and the GitLab token
  are compared in **constant time**.
- Annotation text often comes from untrusted payloads; it is always passed to
  PowerShell as an escaped, single-quoted string (never interpolated).
- Request body size is capped; security headers (`nosniff`, `DENY`) are set.
- Bind it behind TLS / a reverse proxy — the secret travels in the request.

## 2. One-shot `add` (for deploy scripts)

```bash
monitor-annotate add --text "Deployed web v1.2.3 to PROD" --object PROD-SQL-01
```

Useful as the last step of a pipeline that would rather make a CLI call than a
webhook. The dashboard also has a manual "Annotate timeline" box.

## License

[MIT](../../LICENSE)
