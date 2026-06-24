# Packaging the dashboard for Windows

This folder builds the **`monitor-dashboard`** server (`packages/server`, which
internally drives every tool) into a self-contained Windows binary and ships it
two ways:

| Artifact (`packaging/dist/`) | What it is |
| ---------------------------- | ---------- |
| `monitor-dashboard.exe` | Self-contained executable — Node runtime + server + web UI fused into one file. No Node install needed. |
| `monitor-dashboard-setup.exe` | **Install wizard** (Inno Setup). Installs the exe, adds Start Menu / optional desktop shortcuts, and offers to launch on finish. |
| `monitor-dashboard-portable.zip` | **No-install option.** The exe + a readme. Unzip and run; no admin rights. |

## Build everything

From the repo root:

```bash
pnpm package          # build packages, exe, portable zip, and (if present) the installer
```

Or individual steps:

```bash
pnpm package:exe       # just monitor-dashboard.exe
pnpm package:portable  # just the portable zip (needs the exe)
node packaging/build-all.mjs   # full pipeline (same as `pnpm package`)
```

## Prerequisites

- **Node 20+** on PATH (the build fuses *your local* `node.exe` into the binary,
  so the exe runs on the same Node major version you built with).
- `esbuild` and `postject` — installed as repo dev dependencies.
- **Inno Setup 6** — only needed for `monitor-dashboard-setup.exe`. If it's
  missing the build skips the installer and still produces the exe + zip. Install
  with `winget install JRSoftware.InnoSetup` (the build looks for `ISCC.exe`
  under Program Files and `%LOCALAPPDATA%\Programs\Inno Setup 6`).

## How it works

1. `build-exe.mjs` base64-embeds the dashboard's static assets
   (`packages/server/public/*`) into `.generated/assets.json`.
2. esbuild bundles `standalone.mjs` plus every workspace/npm dependency into a
   single CommonJS file (`build/dashboard.cjs`).
3. Node's [SEA](https://nodejs.org/api/single-executable-applications.html)
   tooling turns that bundle into a blob and `postject` injects it into a copy
   of `node.exe` → `dist/monitor-dashboard.exe`.
4. `installer.iss` (Inno Setup) and `build-portable.mjs` wrap that exe.

`standalone.mjs` is the only packaging-specific source. It mirrors
`packages/server/src/cli.ts` but: serves the embedded assets from a temp dir
(the fused exe has no `public/` folder on disk); defaults to loopback + no-auth
so a double-click "just works" locally; and opens the browser on start. The
existing `cli.ts` and all tests are untouched.

## Runtime requirements (not bundled, can't be)

The dashboard shells out to PowerShell, so the target machine still needs:

- **PowerShell 7** (`pwsh`) or Windows PowerShell, and
- the **Redgate Monitor PowerShell module** — licensed per Monitor instance and
  not redistributable, so no package can include it. Install it on the machine
  and ensure it's on `PSModulePath`.
- a Monitor URL + auth token (`MONITOR_URL` / `MONITOR_AUTH_TOKEN`, or a
  `.monitor-config.json` in the working directory).

## Security note

With no `--token` / `DASHBOARD_TOKEN`, the exe starts **without auth on loopback
only** for convenience. The server still refuses to bind a public interface
without a token. To expose it on the network, pass `--token <16+ chars>` and
`--host 0.0.0.0` (put it behind TLS / a reverse proxy).
