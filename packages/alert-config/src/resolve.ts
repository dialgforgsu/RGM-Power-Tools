import { MonitorToolError } from '@rgm-power-tools/core';
import type { AlertsConfig, ConfigFile, GroupConfig } from './schema.js';

/** Raised for semantic problems the Zod schema can't express (bad refs, cycles). */
export class ConfigSemanticError extends MonitorToolError {}

/** A group with inheritance and overrides fully flattened. */
export interface ResolvedGroup {
  name: string;
  description?: string;
  servers: string[];
  alerts: AlertsConfig;
}

export interface ResolvedConfig {
  version: 1;
  groups: ResolvedGroup[];
}

/** Deep-merge plain objects (arrays and scalars from `source` win). */
function deepMerge<T>(base: T, source: Partial<T>): T {
  if (
    base === null ||
    typeof base !== 'object' ||
    Array.isArray(base) ||
    source === null ||
    typeof source !== 'object' ||
    Array.isArray(source)
  ) {
    return (source as T) ?? base;
  }
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [k, v] of Object.entries(source as Record<string, unknown>)) {
    if (v === undefined) continue;
    const existing = out[k];
    if (
      existing !== null &&
      typeof existing === 'object' &&
      !Array.isArray(existing) &&
      v !== null &&
      typeof v === 'object' &&
      !Array.isArray(v)
    ) {
      out[k] = deepMerge(existing, v as Record<string, unknown>);
    } else {
      out[k] = v;
    }
  }
  return out as T;
}

/**
 * Flatten inheritance and overrides so every group carries its full, effective
 * alert configuration. Validates that `inherits_from` references exist and that
 * there are no cycles.
 */
export function resolveConfig(config: ConfigFile): ResolvedConfig {
  const byName = new Map<string, GroupConfig>();
  for (const group of config.groups) {
    if (byName.has(group.name)) {
      throw new ConfigSemanticError(
        `Duplicate group name "${group.name}". Group names must be unique.`,
      );
    }
    byName.set(group.name, group);
  }

  const cache = new Map<string, ResolvedGroup>();

  const resolveGroup = (name: string, trail: string[]): ResolvedGroup => {
    const cached = cache.get(name);
    if (cached) return cached;

    const group = byName.get(name);
    if (!group) {
      throw new ConfigSemanticError(
        `Group "${trail[trail.length - 1] ?? name}" inherits from "${name}", ` +
          'which does not exist.',
      );
    }

    if (trail.includes(name)) {
      throw new ConfigSemanticError(
        `Inheritance cycle detected: ${[...trail, name].join(' -> ')}.`,
      );
    }

    let baseAlerts: AlertsConfig = {};
    if (group.inherits_from) {
      const parent = resolveGroup(group.inherits_from, [...trail, name]);
      baseAlerts = parent.alerts;
    }

    let alerts = deepMerge(baseAlerts, group.alerts ?? {});
    if (group.overrides?.alerts) {
      alerts = deepMerge(
        alerts,
        group.overrides.alerts as Partial<AlertsConfig>,
      );
    }

    const resolved: ResolvedGroup = {
      name: group.name,
      description: group.description,
      servers: group.servers ?? [],
      alerts,
    };
    cache.set(name, resolved);
    return resolved;
  };

  return {
    version: config.version,
    groups: config.groups.map((g) => resolveGroup(g.name, [])),
  };
}
