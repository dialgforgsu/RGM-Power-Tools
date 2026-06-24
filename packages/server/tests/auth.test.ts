import { describe, it, expect } from 'vitest';
import { tokensMatch, bearerToken } from '../src/auth.js';
import { resolveServerConfig, ServerConfigError } from '../src/config.js';

describe('tokensMatch', () => {
  it('accepts the correct token', () => {
    expect(tokensMatch('s3cret-token-value', 's3cret-token-value')).toBe(true);
  });
  it('rejects a wrong token', () => {
    expect(tokensMatch('nope', 's3cret-token-value')).toBe(false);
  });
  it('rejects when either side is empty', () => {
    expect(tokensMatch('', 'x')).toBe(false);
    expect(tokensMatch('x', '')).toBe(false);
  });
  it('handles differing lengths without throwing', () => {
    expect(tokensMatch('short', 'a-much-longer-token')).toBe(false);
  });
});

describe('bearerToken', () => {
  it('parses a Bearer header', () => {
    expect(bearerToken('Bearer abc123')).toBe('abc123');
    expect(bearerToken('bearer   abc123')).toBe('abc123');
  });
  it('returns empty for missing/other schemes', () => {
    expect(bearerToken(undefined)).toBe('');
    expect(bearerToken('Basic abc')).toBe('');
  });
});

describe('resolveServerConfig', () => {
  it('defaults to loopback and refuses no token without --no-auth', () => {
    expect(() => resolveServerConfig({ env: {} })).toThrow(ServerConfigError);
  });

  it('allows no token only on loopback with allowNoAuth', () => {
    const cfg = resolveServerConfig({ allowNoAuth: true, env: {} });
    expect(cfg.host).toBe('127.0.0.1');
    expect(cfg.token).toBe('');
  });

  it('refuses a public bind without a token even with allowNoAuth', () => {
    expect(() =>
      resolveServerConfig({ allowNoAuth: true, host: '0.0.0.0', env: {} }),
    ).toThrow(ServerConfigError);
  });

  it('rejects a too-short token', () => {
    expect(() => resolveServerConfig({ token: 'short', env: {} })).toThrow(
      ServerConfigError,
    );
  });

  it('accepts a strong token and a custom port', () => {
    const cfg = resolveServerConfig({
      token: 'a-sufficiently-long-token',
      port: '8080',
      env: {},
    });
    expect(cfg.token).toBe('a-sufficiently-long-token');
    expect(cfg.port).toBe(8080);
  });

  it('rejects an invalid port', () => {
    expect(() =>
      resolveServerConfig({ token: 'a-sufficiently-long-token', port: '70000', env: {} }),
    ).toThrow(ServerConfigError);
  });
});
