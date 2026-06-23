import type { AlertName } from './schema.js';

/**
 * Maps each curated alert name to Monitor's numeric AlertType, which the write
 * cmdlet (`Update-RedgateMonitorAlertSpecificSettings -AlertType <int>`)
 * requires.
 *
 * ⚠️  These IDs are placeholders aligned to the documented Monitor alert
 * taxonomy and MUST be confirmed against your target instance before relying on
 * `apply` in production. Read them from the live module with
 * `Get-SqlMonitorAlertSettings` and adjust here — nothing else needs to change.
 */
export const ALERT_TYPE_IDS: Record<AlertName, number> = {
  cpu_utilization: 1001,
  memory_utilization: 1002,
  disk_space: 1003,
  long_running_query: 1004,
  blocking_process: 1005,
  deadlock: 1006,
  job_failed: 1007,
};

/** Reverse lookup: numeric AlertType → curated alert name (if supported). */
export const ALERT_NAME_BY_ID: Record<number, AlertName> = Object.fromEntries(
  Object.entries(ALERT_TYPE_IDS).map(([name, id]) => [id, name as AlertName]),
) as Record<number, AlertName>;
