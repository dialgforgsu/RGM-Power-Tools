import { createHash, timingSafeEqual } from 'node:crypto';

function sha256(value: string): Buffer {
  return createHash('sha256').update(value, 'utf8').digest();
}

/**
 * Constant-time comparison of a presented bearer token against the configured
 * one. Both sides are hashed to a fixed-length digest first, so neither the
 * comparison nor the token length leaks information through response timing.
 */
export function tokensMatch(presented: string, expected: string): boolean {
  if (!expected) return false;
  return timingSafeEqual(sha256(presented), sha256(expected));
}

/** Extract a bearer token from an Authorization header value. */
export function bearerToken(authorization: string | undefined): string {
  if (!authorization) return '';
  const match = /^Bearer\s+(.+)$/i.exec(authorization.trim());
  return match ? match[1]!.trim() : '';
}
