import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveConnection, redactToken, AuthError } from './index.js';

describe('resolveConnection', () => {
  it('prefers explicit options over env and file', () => {
    const conn = resolveConnection({
      url: 'https://flag.example.com',
      authToken: 'flag-token',
      env: {
        MONITOR_URL: 'https://env.example.com',
        MONITOR_AUTH_TOKEN: 'env',
      },
    });
    expect(conn.baseUrl).toBe('https://flag.example.com');
    expect(conn.authToken).toBe('flag-token');
  });

  it('falls back to environment variables', () => {
    const conn = resolveConnection({
      env: {
        MONITOR_URL: 'https://env.example.com/',
        MONITOR_AUTH_TOKEN: 'env-token',
      },
    });
    expect(conn.baseUrl).toBe('https://env.example.com');
    expect(conn.authToken).toBe('env-token');
  });

  it('reads .monitor-config.json as a last resort', () => {
    const dir = mkdtempSync(join(tmpdir(), 'mc-auth-'));
    try {
      writeFileSync(
        join(dir, '.monitor-config.json'),
        JSON.stringify({
          base_monitor_url: 'https://file.example.com',
          auth_token: 'file-token',
        }),
      );
      const conn = resolveConnection({ cwd: dir, env: {} });
      expect(conn.baseUrl).toBe('https://file.example.com');
      expect(conn.authToken).toBe('file-token');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('throws AuthError when url is missing', () => {
    expect(() =>
      resolveConnection({ authToken: 't', env: {}, cwd: tmpdir() }),
    ).toThrow(AuthError);
  });

  it('throws AuthError when token is missing', () => {
    expect(() =>
      resolveConnection({ url: 'https://x', env: {}, cwd: tmpdir() }),
    ).toThrow(AuthError);
  });
});

describe('redactToken', () => {
  it('masks long tokens', () => {
    expect(redactToken('abcdefghijklmnop')).toBe('abcd…op');
  });
  it('fully masks short tokens', () => {
    expect(redactToken('short')).toBe('****');
  });
});
