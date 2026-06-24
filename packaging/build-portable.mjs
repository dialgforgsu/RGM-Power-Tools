/**
 * Build packaging/dist/monitor-dashboard-portable.zip — the no-install option:
 * the self-contained exe plus a short readme. Unzip and run, no admin rights.
 *
 * Prerequisite: packaging/dist/monitor-dashboard.exe must exist (build-exe.mjs).
 * Uses PowerShell's Compress-Archive so there's no extra npm dependency.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, copyFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, 'dist');
const exe = join(outDir, 'monitor-dashboard.exe');
const zip = join(outDir, 'monitor-dashboard-portable.zip');

const README = `RGM Power Tools Dashboard - portable build
==========================================

Double-click monitor-dashboard.exe to start the dashboard. It listens on
http://127.0.0.1:4570 and opens your browser automatically.

Requirements at runtime (not bundled):
  - PowerShell 7 (pwsh) or Windows PowerShell
  - The Redgate Monitor PowerShell module (licensed per Monitor instance)
  - A Monitor URL + auth token (Monitor -> Configuration -> API)

Common options:
  monitor-dashboard.exe --port 8080
  monitor-dashboard.exe --token <a-strong-secret-16+-chars> --host 0.0.0.0
  monitor-dashboard.exe --no-open
  monitor-dashboard.exe --help

Set MONITOR_URL and MONITOR_AUTH_TOKEN (or use a .monitor-config.json in the
working directory) so the dashboard can reach your Monitor instance.
`;

function log(msg) {
  console.log(`[build-portable] ${msg}`);
}

if (!existsSync(exe)) {
  console.error(`[build-portable] FAILED: ${exe} not found. Run build-exe.mjs first.`);
  process.exit(1);
}

const staging = mkdtempSync(join(tmpdir(), 'rgm-portable-'));
try {
  copyFileSync(exe, join(staging, 'monitor-dashboard.exe'));
  writeFileSync(join(staging, 'README.txt'), README);
  rmSync(zip, { force: true });
  // Compress-Archive zips the staging contents (not the folder itself).
  execFileSync(
    'powershell',
    [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      `Compress-Archive -Path '${join(staging, '*')}' -DestinationPath '${zip}' -Force`,
    ],
    { stdio: 'inherit' },
  );
  log(`done: ${zip}`);
} finally {
  rmSync(staging, { recursive: true, force: true });
}
