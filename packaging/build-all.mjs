/**
 * One-shot packaging build. Produces, under packaging/dist/:
 *   - monitor-dashboard.exe            (self-contained binary)
 *   - monitor-dashboard-setup.exe      (install wizard, if Inno Setup is present)
 *   - monitor-dashboard-portable.zip   (no-install option)
 *
 * Run from the repo root:  node packaging/build-all.mjs
 */
import { execFileSync, execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..');

function step(name, fn) {
  console.log(`\n=== ${name} ===`);
  fn();
}

function run(cmd, args, opts = {}) {
  execFileSync(cmd, args, { stdio: 'inherit', cwd: repoRoot, ...opts });
}

// 1. Build all workspace packages so esbuild can follow the compiled dist.
step('Build workspace packages (pnpm -r build)', () => {
  // corepack-provided pnpm; matches the repo's pinned packageManager.
  execSync('corepack pnpm -r build', {
    stdio: 'inherit',
    cwd: repoRoot,
    env: { ...process.env, COREPACK_ENABLE_DOWNLOAD_PROMPT: '0' },
  });
});

// 2. Self-contained exe.
step('Build monitor-dashboard.exe', () => {
  run(process.execPath, [join(here, 'build-exe.mjs')]);
});

// 3. Portable zip.
step('Build portable zip', () => {
  run(process.execPath, [join(here, 'build-portable.mjs')]);
});

// 4. Installer wizard (best effort — needs Inno Setup's ISCC.exe).
step('Build installer wizard (Inno Setup)', () => {
  const localApp = process.env.LOCALAPPDATA ?? '';
  const candidates = [
    'C:\\Program Files (x86)\\Inno Setup 6\\ISCC.exe',
    'C:\\Program Files\\Inno Setup 6\\ISCC.exe',
    localApp && join(localApp, 'Programs', 'Inno Setup 6', 'ISCC.exe'),
  ].filter(Boolean);
  const iscc = candidates.find((p) => existsSync(p));
  if (!iscc) {
    console.warn(
      'ISCC.exe not found — skipping installer. Install Inno Setup 6\n' +
        '  (winget install JRSoftware.InnoSetup) and re-run, or compile manually:\n' +
        `  "C:\\Program Files (x86)\\Inno Setup 6\\ISCC.exe" ${join(here, 'installer.iss')}`,
    );
    return;
  }
  run(iscc, [join(here, 'installer.iss')], { cwd: here });
});

console.log('\nAll done. Artifacts in packaging/dist/.');
