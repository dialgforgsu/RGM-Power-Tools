import type { Check } from '../types.js';
import { neverAlerting } from './never-alerting.js';
import { alertNoNotification } from './alert-no-notification.js';
import { staleCustomMetric } from './stale-custom-metric.js';
import { decommissionedLicensed } from './decommissioned-licensed.js';

/**
 * All checks the linter knows about. Adding a rule is a matter of writing a
 * {@link Check} and adding it here — everything downstream is registry-driven.
 */
export const CHECKS: readonly Check[] = [
  neverAlerting,
  alertNoNotification,
  staleCustomMetric,
  decommissionedLicensed,
];

export function checkById(id: string): Check | undefined {
  return CHECKS.find((c) => c.id === id);
}

export {
  neverAlerting,
  alertNoNotification,
  staleCustomMetric,
  decommissionedLicensed,
};
