import type { Check, Finding } from '../types.js';
import { SERVER_TYPES } from './util.js';

/**
 * Servers that are monitored but have never raised a single alert. Usually a
 * sign that alerting was never configured on them — a silent blind spot.
 */
export const neverAlerting: Check = {
  id: 'never-alerting',
  title: 'Servers monitored but never alerting',
  description:
    'Server-like objects with no alert ever recorded — likely missing alert ' +
    'configuration rather than genuinely silent.',
  severity: 'warning',
  run(snapshot): Finding[] {
    const lastById = new Map(
      snapshot.alertActivity.map((a) => [a.objectId, a.lastAlertUtc]),
    );
    const findings: Finding[] = [];
    for (const obj of snapshot.objects) {
      if (!SERVER_TYPES.has(obj.type)) continue;
      const last = lastById.get(obj.id);
      if (last == null) {
        findings.push({
          checkId: this.id,
          severity: this.severity,
          title: 'No alert ever recorded',
          subject: obj.name,
          detail:
            'This server has never raised an alert. Confirm alert settings are ' +
            'applied to it (or the group it belongs to).',
        });
      }
    }
    return findings;
  },
};
