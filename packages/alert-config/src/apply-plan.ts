import type { MonitorClient } from '@redgate-power-tools/core';
import { resolveConfig } from './resolve.js';
import { ALERT_NAMES, type AlertName, type ConfigFile } from './schema.js';
import {
  alertConfigToSettings,
  alertNameForId,
  alertTypeId,
} from './mapping.js';
import { deepEqual } from './util.js';

export interface ApplyResult {
  /** Number of alert settings written. */
  written: number;
  /** Group names referenced in config but not found live (skipped). */
  missingGroups: string[];
}

/**
 * Make live Monitor state match the desired config, writing only what differs.
 * Idempotent: a second call with the same config writes nothing because every
 * desired setting already deep-equals the live one.
 */
export async function applyConfig(
  client: MonitorClient,
  config: ConfigFile,
): Promise<ApplyResult> {
  const desired = resolveConfig(config);
  const objects = await client.getMonitoredObjects();
  const groupObjectByName = new Map(
    objects.filter((o) => o.type === 'Group').map((o) => [o.name, o]),
  );

  let written = 0;
  const missingGroups: string[] = [];

  for (const group of desired.groups) {
    const groupObject = groupObjectByName.get(group.name);
    if (!groupObject) {
      missingGroups.push(group.name);
      continue;
    }

    const live = await client.getAlertSettings(groupObject);
    const liveByName = new Map<AlertName, Record<string, unknown>>();
    for (const entry of Object.values(live)) {
      const name = alertNameForId(entry.alertType);
      if (name) liveByName.set(name, entry.settings);
    }

    for (const name of ALERT_NAMES) {
      const alertConfig = group.alerts[name];
      if (!alertConfig) continue;
      const desiredSettings = alertConfigToSettings(
        alertConfig as Record<string, unknown>,
      );
      if (deepEqual(desiredSettings, liveByName.get(name))) continue;
      await client.updateAlertSetting(
        groupObject,
        alertTypeId(name),
        desiredSettings,
      );
      written++;
    }
  }

  return { written, missingGroups };
}
