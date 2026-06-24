import type { AlertSettingsMap, MonitorClient } from '@rgm-power-tools/core';
import type { MonitorSnapshot } from './types.js';

/**
 * Gather everything the checks need from a connected client in one pass. This
 * is the package's only I/O; checks operate purely on the returned snapshot.
 *
 * Alert settings are read per object (one call each) — fine for an occasional
 * audit, and the only way Monitor exposes them. Per-object failures degrade to
 * an empty settings bag rather than failing the whole run.
 */
export async function gatherSnapshot(
  client: MonitorClient,
): Promise<MonitorSnapshot> {
  const [objects, groups, alertActivity, customMetrics, serverStatuses] =
    await Promise.all([
      client.getMonitoredObjects(),
      client.getGroups(),
      client.getAlertActivity(),
      client.getCustomMetrics(),
      client.getServerStatuses(),
    ]);

  const pairs = await Promise.all(
    objects.map((o) =>
      client
        .getAlertSettings(o)
        .then((s) => [o.id, s] as const)
        .catch(() => [o.id, {} as AlertSettingsMap] as const),
    ),
  );
  const alertSettingsByObject: Record<string, AlertSettingsMap> = {};
  for (const [id, settings] of pairs) alertSettingsByObject[id] = settings;

  return {
    objects,
    groups,
    alertSettingsByObject,
    alertActivity,
    customMetrics,
    serverStatuses,
  };
}
