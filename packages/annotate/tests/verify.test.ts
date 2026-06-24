import { describe, it, expect } from 'vitest';
import {
  hmacSha256Hex,
  constantTimeEqual,
  verifyHmacHeader,
} from '../src/verify.js';

const SECRET = 'a-strong-webhook-secret';

describe('hmacSha256Hex', () => {
  it('is deterministic and 64 hex chars', () => {
    const a = hmacSha256Hex('hello', SECRET);
    const b = hmacSha256Hex('hello', SECRET);
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(hmacSha256Hex('hello', 'other')).not.toBe(a);
  });
});

describe('constantTimeEqual', () => {
  it('compares values regardless of length', () => {
    expect(constantTimeEqual('abc', 'abc')).toBe(true);
    expect(constantTimeEqual('abc', 'abd')).toBe(false);
    expect(constantTimeEqual('short', 'a-much-longer-value')).toBe(false);
  });
});

describe('verifyHmacHeader', () => {
  const body = '{"hello":"world"}';
  const good = `sha256=${hmacSha256Hex(body, SECRET)}`;

  it('accepts a correct signature', () => {
    expect(verifyHmacHeader(body, SECRET, good)).toBe(true);
  });
  it('rejects a wrong/absent/malformed signature', () => {
    expect(verifyHmacHeader(body, SECRET, `sha256=${hmacSha256Hex(body, 'x')}`)).toBe(false);
    expect(verifyHmacHeader(body, SECRET, undefined)).toBe(false);
    expect(verifyHmacHeader(body, SECRET, 'garbage')).toBe(false);
    expect(verifyHmacHeader('tampered', SECRET, good)).toBe(false);
  });
});
