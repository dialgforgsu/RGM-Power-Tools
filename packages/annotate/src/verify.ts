import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

/** Lowercase hex HMAC-SHA256 of `body` keyed by `secret`. */
export function hmacSha256Hex(body: string, secret: string): string {
  return createHmac('sha256', secret).update(body, 'utf8').digest('hex');
}

/**
 * Constant-time string comparison. Both sides are hashed to a fixed-length
 * digest first, so neither the comparison nor the length leaks via timing.
 */
export function constantTimeEqual(a: string, b: string): boolean {
  const ah = createHash('sha256').update(a, 'utf8').digest();
  const bh = createHash('sha256').update(b, 'utf8').digest();
  return timingSafeEqual(ah, bh);
}

/**
 * Verify a `sha256=<hex>` signature header against an HMAC of the raw body.
 * Returns false if the header is missing/malformed or doesn't match.
 */
export function verifyHmacHeader(
  rawBody: string,
  secret: string,
  headerValue: string | undefined,
): boolean {
  if (!headerValue) return false;
  const match = /^sha256=([0-9a-f]+)$/i.exec(headerValue.trim());
  if (!match) return false;
  const expected = hmacSha256Hex(rawBody, secret);
  return constantTimeEqual(match[1]!.toLowerCase(), expected);
}
