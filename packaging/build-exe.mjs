/**
 * Build packaging/dist/monitor-dashboard.exe — a single, self-contained Windows
 * executable of the dashboard server.
 *
 * Pipeline:
 *   1. Embed the dashboard's static assets (public/*) as base64 JSON.
 *   2. esbuild-bundle standalone.mjs + every dependency into one CJS file.
 *   3. Build a Node SEA blob from that bundle and fuse it into a copy of the
 *      local node.exe with postject.
 *
 * Prerequisite: `pnpm -r build` must have run, so @rgm-power-tools/server and
 * its deps exist as compiled dist/ that esbuild can follow. build-all.mjs does
 * this for you.
 */
import { build as esbuild } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import {
  copyFileSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..');
const publicDir = join(repoRoot, 'packages', 'server', 'public');
const genDir = join(here, '.generated');
const buildDir = join(here, 'build');
const outDir = join(here, 'dist');

const FUSE = 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2';
const ASSET_FILES = ['index.html', 'app.js', 'styles.css'];

function log(msg) {
  console.log(`[build-exe] ${msg}`);
}

function clean() {
  for (const d of [genDir, buildDir, outDir]) {
    rmSync(d, { recursive: true, force: true });
    mkdirSync(d, { recursive: true });
  }
}

function embedAssets() {
  const assets = {};
  for (const name of ASSET_FILES) {
    assets[name] = readFileSync(join(publicDir, name)).toString('base64');
  }
  writeFileSync(join(genDir, 'assets.json'), JSON.stringify(assets));
  log(`embedded ${ASSET_FILES.length} static assets`);
}

async function bundle() {
  const outfile = join(buildDir, 'dashboard.cjs');
  await esbuild({
    entryPoints: [join(here, 'standalone.mjs')],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: `node${process.versions.node.split('.')[0]}`,
    outfile,
    minify: true,
    // packaging/ is not a workspace package, so the @rgm-power-tools/* names
    // don't resolve from here. Point them at the built dist entries; esbuild
    // follows their transitive deps from inside packages/*/node_modules (where
    // pnpm keeps the workspace + npm symlinks).
    alias: {
      '@rgm-power-tools/server': join(repoRoot, 'packages', 'server', 'dist', 'index.js'),
      '@rgm-power-tools/core': join(repoRoot, 'packages', 'core', 'dist', 'index.js'),
    },
    // Quiet a harmless esbuild note about a dynamic require inside a dep.
    logLevel: 'error',
  });
  log(`bundled -> ${outfile}`);
  return outfile;
}

function buildSeaBlob(bundlePath) {
  const blob = join(buildDir, 'sea-prep.blob');
  const seaConfig = join(buildDir, 'sea-config.json');
  writeFileSync(
    seaConfig,
    JSON.stringify({
      main: bundlePath,
      output: blob,
      disableExperimentalSEAWarning: true,
      useSnapshot: false,
      useCodeCache: false,
    }),
  );
  execFileSync(process.execPath, ['--experimental-sea-config', seaConfig], {
    stdio: 'inherit',
  });
  log(`built SEA blob -> ${blob}`);
  return blob;
}

function fuse(blob) {
  const exe = join(outDir, 'monitor-dashboard.exe');
  copyFileSync(process.execPath, exe);
  log(`copied node runtime -> ${exe}`);

  const postjectCli = require.resolve('postject/dist/cli.js');
  execFileSync(
    process.execPath,
    [
      postjectCli,
      exe,
      'NODE_SEA_BLOB',
      blob,
      '--sentinel-fuse',
      FUSE,
    ],
    { stdio: 'inherit' },
  );
  log(`fused SEA blob into exe`);
  return exe;
}

async function main() {
  clean();
  embedAssets();
  const bundlePath = await bundle();
  const blob = buildSeaBlob(bundlePath);
  const exe = fuse(blob);
  log(`done: ${exe}`);
}

main().catch((err) => {
  console.error('[build-exe] FAILED:', err.message);
  process.exit(1);
});
