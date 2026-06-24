import type { Check, Finding } from '../types.js';
import { daysSince } from './util.js';

/** Custom metrics are considered stale after this many days without data. */
export const STALE_METRIC_DAYS = 30;

/**
 * Custom metrics that have stopped returning data (or never did). A metric
 * collecting nothing for a month is almost always a broken query or a renamed
 * object — dead weight on the dashboard.
 */
export const staleCustomMetric: Check = {
  id: 'stale-custom-metric',
  title: 'Custom metrics with no recent data',
  description: `Enabled custom metrics that have returned no data in ${STALE_METRIC_DAYS} days.`,
  severity: 'warning',
  run(snapshot, now): Finding[] {
    const findings: Finding[] = [];
    for (const metric of snapshot.customMetrics) {
      if (!metric.enabled) continue;
      if (metric.lastDataUtc == null) {
        findings.push({
          checkId: this.id,
          severity: this.severity,
          title: 'Custom metric has never returned data',
          subject: metric.name,
          detail: 'No data point has ever been collected for this metric.',
        });
        continue;
      }
      const age = daysSince(metric.lastDataUtc, now);
      if (age >= STALE_METRIC_DAYS) {
        findings.push({
          checkId: this.id,
          severity: this.severity,
          title: `Custom metric stale for ${age} days`,
          subject: metric.name,
          detail: `Last data point was ${age} days ago (threshold ${STALE_METRIC_DAYS}).`,
        });
      }
    }
    return findings;
  },
};
