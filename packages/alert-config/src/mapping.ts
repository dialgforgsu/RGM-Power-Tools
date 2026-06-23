import type { RawAlertSetting } from '@rgm-power-tools/core';
import { ALERT_NAME_BY_ID, ALERT_TYPE_IDS } from './alert-types.js';
import type { AlertName } from './schema.js';

/**
 * The translation seam between our YAML alert config and Monitor's per-alert
 * settings bag.
 *
 * For the MVP the two shapes are intentionally identical (the YAML fields are
 * stored verbatim as the settings bag), so round-trips are exact. When the real
 * Monitor field names are confirmed, this is the *only* file that needs to
 * change: translate keys here and everything upstream keeps working.
 */

/** Build the settings bag Monitor stores from a YAML alert config object. */
export function alertConfigToSettings(
  config: Record<string, unknown>,
): Record<string, unknown> {
  return structuredClone(config);
}

/** Rebuild a YAML alert config object from a Monitor raw alert setting. */
export function settingToAlertConfig(
  raw: RawAlertSetting,
): Record<string, unknown> {
  return structuredClone(raw.settings);
}

/** Resolve a curated alert name to its numeric Monitor AlertType. */
export function alertTypeId(name: AlertName): number {
  return ALERT_TYPE_IDS[name];
}

/** Resolve a numeric Monitor AlertType to a curated alert name, if supported. */
export function alertNameForId(id: number): AlertName | undefined {
  return ALERT_NAME_BY_ID[id];
}
