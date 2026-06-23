import deepDiff from 'deep-diff';
import { resolveConfig, type ResolvedGroup } from './resolve.js';
import type { ConfigFile } from './schema.js';

export type ChangeKind = 'added' | 'removed' | 'changed';

export interface FieldChange {
  kind: ChangeKind;
  /** Dotted path within the group, e.g. `alerts.cpu_utilization.enabled`. */
  path: string;
  from?: unknown;
  to?: unknown;
}

export interface GroupDiff {
  name: string;
  /** `added`/`removed` when the whole group exists on only one side. */
  status: 'added' | 'removed' | 'changed';
  changes: FieldChange[];
}

export interface DiffResult {
  groups: GroupDiff[];
  hasChanges: boolean;
}

/** Comparable slice of a resolved group (name is the key, not a field). */
function comparable(group: ResolvedGroup) {
  return {
    description: group.description,
    servers: [...group.servers].sort((a, b) => a.localeCompare(b)),
    alerts: group.alerts,
  };
}

/**
 * Diff two configs (source → target). Inheritance is resolved on both sides
 * first, so the comparison is between effective alert policies. Groups are
 * matched by name; a group present on only one side is reported whole.
 */
export function diffConfigs(
  source: ConfigFile,
  target: ConfigFile,
): DiffResult {
  const src = new Map(resolveConfig(source).groups.map((g) => [g.name, g]));
  const tgt = new Map(resolveConfig(target).groups.map((g) => [g.name, g]));

  const names = [...new Set([...src.keys(), ...tgt.keys()])].sort((a, b) =>
    a.localeCompare(b),
  );

  const groups: GroupDiff[] = [];
  for (const name of names) {
    const s = src.get(name);
    const t = tgt.get(name);

    if (s && !t) {
      groups.push({ name, status: 'removed', changes: [] });
      continue;
    }
    if (!s && t) {
      groups.push({ name, status: 'added', changes: [] });
      continue;
    }
    if (!s || !t) continue;

    const changes = fieldChanges(comparable(s), comparable(t));
    if (changes.length > 0) {
      groups.push({ name, status: 'changed', changes });
    }
  }

  return { groups, hasChanges: groups.length > 0 };
}

function fieldChanges(lhs: unknown, rhs: unknown): FieldChange[] {
  const diffs = deepDiff.diff(lhs, rhs) ?? [];
  const changes: FieldChange[] = [];
  for (const d of diffs) {
    const basePath = (d.path ?? []).join('.');
    switch (d.kind) {
      case 'N':
        changes.push({ kind: 'added', path: basePath, to: d.rhs });
        break;
      case 'D':
        changes.push({ kind: 'removed', path: basePath, from: d.lhs });
        break;
      case 'E':
        changes.push({
          kind: 'changed',
          path: basePath,
          from: d.lhs,
          to: d.rhs,
        });
        break;
      case 'A': {
        const path = basePath ? `${basePath}.${d.index}` : String(d.index);
        const item = d.item;
        if (item.kind === 'N')
          changes.push({ kind: 'added', path, to: item.rhs });
        else if (item.kind === 'D')
          changes.push({ kind: 'removed', path, from: item.lhs });
        else if (item.kind === 'E')
          changes.push({ kind: 'changed', path, from: item.lhs, to: item.rhs });
        break;
      }
    }
  }
  return changes.sort((a, b) => a.path.localeCompare(b.path));
}
