import type {
  MonitorClient,
  MonitorGroup,
  MonitoredObject,
} from '@rgm-power-tools/core';
import { ALERT_NAMES, type AlertName, type ConfigFile } from './schema.js';
import { alertNameForId, settingToAlertConfig } from './mapping.js';

/** Connection placeholders written into exported YAML; never the real token. */
export const CONNECTION_PLACEHOLDERS = {
  base_monitor_url: '${MONITOR_URL}',
  auth_token: '${MONITOR_AUTH_TOKEN}',
} as const;

/**
 * Read live Monitor state and shape it into a {@link ConfigFile} — the same
 * group-based, flat, fully-resolved form `export` writes and `diff`/`apply`
 * compare against. Alert settings are read at the group level (the group object
 * carries the policy that its member servers inherit).
 *
 * Output is deterministically ordered: groups by name, servers alphabetically,
 * alerts in the canonical {@link ALERT_NAMES} order.
 */
export async function buildLiveConfig(
  client: MonitorClient,
  options: { group?: string } = {},
): Promise<ConfigFile> {
  const [objects, groups] = await Promise.all([
    client.getMonitoredObjects(),
    client.getGroups(),
  ]);

  const nameById = new Map<string, string>(objects.map((o) => [o.id, o.name]));
  const groupObjectByName = indexGroupObjects(objects);

  const selected = options.group
    ? groups.filter((g) => g.name === options.group)
    : groups;

  const resultGroups = await Promise.all(
    [...selected]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((group) => buildGroup(client, group, nameById, groupObjectByName)),
  );

  return {
    version: 1,
    connection: { ...CONNECTION_PLACEHOLDERS },
    groups: resultGroups,
  };
}

function indexGroupObjects(
  objects: MonitoredObject[],
): Map<string, MonitoredObject> {
  const map = new Map<string, MonitoredObject>();
  for (const obj of objects) {
    if (obj.type === 'Group') map.set(obj.name, obj);
  }
  return map;
}

async function buildGroup(
  client: MonitorClient,
  group: MonitorGroup,
  nameById: Map<string, string>,
  groupObjectByName: Map<string, MonitoredObject>,
): Promise<ConfigFile['groups'][number]> {
  const servers = group.memberIds
    .map((id) => nameById.get(id))
    .filter((n): n is string => Boolean(n))
    .sort((a, b) => a.localeCompare(b));

  // Read alert policy from the group object itself (member servers inherit it).
  const groupObject = groupObjectByName.get(group.name) ?? {
    id: group.id,
    name: group.name,
    type: 'Group' as const,
  };
  const settings = await client.getAlertSettings(groupObject);

  const alerts: Record<string, unknown> = {};
  for (const name of ALERT_NAMES) {
    const entry = findSettingForAlert(settings, name);
    if (entry) alerts[name] = settingToAlertConfig(entry);
  }

  const result: ConfigFile['groups'][number] = {
    name: group.name,
    ...(group.description ? { description: group.description } : {}),
    servers,
    alerts: alerts as ConfigFile['groups'][number]['alerts'],
  };
  return result;
}

function findSettingForAlert(
  settings: Awaited<ReturnType<MonitorClient['getAlertSettings']>>,
  name: AlertName,
) {
  for (const entry of Object.values(settings)) {
    if (alertNameForId(entry.alertType) === name) return entry;
  }
  return undefined;
}
