import type { MonitorClient, TimeWindow } from '@rgm-power-tools/core';
import type { IncidentData } from './types.js';

/** Pull every alert, slow query, backup, and annotation in the window. */
export async function gatherTimeline(
  client: MonitorClient,
  window: TimeWindow,
): Promise<IncidentData> {
  const [alerts, slowQueries, backups, annotations] = await Promise.all([
    client.getAlertsInWindow(window),
    client.getSlowQueriesInWindow(window),
    client.getBackupsInWindow(window),
    client.getAnnotationsInWindow(window),
  ]);
  return { window, alerts, slowQueries, backups, annotations };
}
