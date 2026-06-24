import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { serveStatic } from '../src/static.js';

let root: string;
let secretDir: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'rgm-static-'));
  writeFileSync(join(root, 'index.html'), '<h1>ok</h1>', 'utf8');
  writeFileSync(join(root, 'app.js'), 'console.log(1)', 'utf8');
  // A sibling secret OUTSIDE the served root.
  secretDir = mkdtempSync(join(tmpdir(), 'rgm-secret-'));
  writeFileSync(join(secretDir, 'secret.txt'), 'TOP SECRET', 'utf8');
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
  rmSync(secretDir, { recursive: true, force: true });
});

describe('serveStatic', () => {
  it('serves / as index.html', async () => {
    const file = await serveStatic(root, '/');
    expect(file?.content.toString()).toContain('ok');
    expect(file?.contentType).toContain('text/html');
  });

  it('serves a known asset with the right content type', async () => {
    const file = await serveStatic(root, '/app.js');
    expect(file?.contentType).toContain('text/javascript');
  });

  it('returns null for a missing file', async () => {
    expect(await serveStatic(root, '/nope.js')).toBeNull();
  });

  it('blocks directory traversal', async () => {
    expect(await serveStatic(root, '/../../etc/passwd')).toBeNull();
    expect(await serveStatic(root, '/..%2f..%2fsecret.txt')).toBeNull();
    // Even an encoded absolute-ish escape stays inside the root.
    expect(await serveStatic(root, '/%2e%2e/secret.txt')).toBeNull();
  });
});
