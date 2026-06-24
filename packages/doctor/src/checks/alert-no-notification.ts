import type { Check, Finding } from '../types.js';
import { hasNotificationChannel } from './util.js';

/**
 * Enabled alerts that fire into the void — no email/Slack/webhook channel
 * configured. They will trigger but page nobody.
 */
export const alertNoNotification: Check = {
  id: 'alert-no-notification',
  title: 'Alert types with no notification channel',
  description:
    'Enabled alerts that have no notification channel configured — they ' +
    'trigger but reach no one.',
  severity: 'error',
  run(snapshot): Finding[] {
    const nameById = new Map(snapshot.objects.map((o) => [o.id, o.name]));
    const findings: Finding[] = [];

    for (const [objectId, settingsMap] of Object.entries(
      snapshot.alertSettingsByObject,
    )) {
      const orphaned: number[] = [];
      for (const setting of Object.values(settingsMap)) {
        if (!setting.enabled) continue;
        if (!hasNotificationChannel(setting.settings)) {
          orphaned.push(setting.alertType);
        }
      }
      if (orphaned.length > 0) {
        findings.push({
          checkId: this.id,
          severity: this.severity,
          title: `${orphaned.length} enabled alert type(s) with no notification`,
          subject: nameById.get(objectId) ?? objectId,
          detail: `Alert type(s) ${orphaned
            .sort((a, b) => a - b)
            .join(', ')} are enabled but route to no channel.`,
        });
      }
    }
    return findings;
  },
};
