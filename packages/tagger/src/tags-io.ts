import { writeFileSync } from 'node:fs';
import { stringify } from 'yaml';
import { KNOWN_TAG_KEYS, type Tags, type TagSet } from '@rgm-power-tools/core';

/**
 * Order a group's tags deterministically: the well-known dimensions first (in
 * their canonical order), then any custom keys alphabetically. Stable ordering
 * keeps the file diff-friendly across `sync` runs.
 */
function orderTags(tags: Tags): Tags {
  const ordered: Tags = {};
  for (const key of KNOWN_TAG_KEYS) {
    const value = tags[key];
    if (value !== undefined) ordered[key] = value;
  }
  for (const key of Object.keys(tags).sort()) {
    if ((KNOWN_TAG_KEYS as readonly string[]).includes(key)) continue;
    ordered[key] = tags[key]!;
  }
  return ordered;
}

/**
 * Serialize a {@link TagSet} to YAML with stable ordering (groups by name,
 * tags in canonical order). Unchanged state produces byte-identical output.
 */
export function serializeTagSet(set: TagSet): string {
  const groups = [...set.groups]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((g) => {
      const tags = orderTags(g.tags);
      // Emit `tags: {}` rather than `tags: null` for groups with no metadata yet.
      return { name: g.name, tags };
    });
  return stringify({ version: set.version, groups }, { lineWidth: 0 });
}

/** Write a tag set to disk as YAML. */
export function writeTagSet(path: string, set: TagSet): void {
  writeFileSync(path, serializeTagSet(set), 'utf8');
}

export interface ScaffoldResult {
  merged: TagSet;
  /** Live group names that were not in the file and got blank entries. */
  added: string[];
  /** Group names in the file that no longer exist live. */
  missing: string[];
}

/**
 * Reconcile an existing tag overlay against the live group list: keep every
 * existing entry and its tags untouched, append blank entries for live groups
 * not yet in the file, and flag file entries that no longer exist live (kept,
 * not deleted — removal is the user's call).
 */
export function scaffoldFromGroups(
  existing: TagSet,
  liveGroupNames: readonly string[],
): ScaffoldResult {
  const known = new Set(existing.groups.map((g) => g.name));
  const live = new Set(liveGroupNames);

  const added: string[] = [];
  for (const name of liveGroupNames) {
    if (!known.has(name)) added.push(name);
  }

  const missing = existing.groups
    .map((g) => g.name)
    .filter((name) => !live.has(name));

  const merged: TagSet = {
    version: 1,
    groups: [
      ...existing.groups,
      ...added.map((name) => ({ name, tags: {} as Tags })),
    ],
  };

  return { merged, added, missing };
}
