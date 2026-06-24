import type { MonitoredObject } from '@rgm-power-tools/core';

/** Server-like object types the audits care about. */
export const SERVER_TYPES: ReadonlySet<MonitoredObject['type']> = new Set([
  'Machine',
  'Instance',
  'Cluster',
]);

/** Whole days between an ISO timestamp and `now` (negative if in the future). */
export function daysSince(iso: string, now: Date): number {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return Number.POSITIVE_INFINITY;
  return Math.floor((now.getTime() - then) / 86_400_000);
}

/**
 * Does an alert's settings bag wire up at least one notification channel?
 * Looks for a non-empty `notifications.email` array or any non-empty string
 * channel (slack, webhook, …) — Monitor stores the bag verbatim, so we probe
 * shape rather than assume exact field names.
 */
export function hasNotificationChannel(settings: Record<string, unknown>): boolean {
  const n = settings.notifications;
  if (!n || typeof n !== 'object') return false;
  for (const value of Object.values(n as Record<string, unknown>)) {
    if (Array.isArray(value) && value.length > 0) return true;
    if (typeof value === 'string' && value.trim() !== '') return true;
  }
  return false;
}
