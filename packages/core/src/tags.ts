/**
 * The shared tag engine. A "tag overlay" is a small YAML file
 * (`monitor-tags.yaml`) that attaches metadata — owner, business unit,
 * criticality, cost center, and any custom keys — to Monitor groups by name.
 *
 * This lives in `core` on purpose: tags are not specific to any one tool. The
 * `monitor-tagger` CLI authors and maintains the file, but every tool in the
 * toolkit (and any future one) can read it through {@link loadTagSet} and turn
 * tags into filter keys with {@link parseTagFilters} / {@link filterByTags}.
 * That is what lets the tools compose — e.g. `monitor-config apply
 * --tag criticality=high` applies only to groups tagged that way.
 */

import { readFileSync, existsSync } from 'node:fs';
import { parse as parseYaml } from 'yaml';
import { z } from 'zod';
import { TagError } from './errors.js';

/** Default tag overlay file, looked for in the working directory. */
export const DEFAULT_TAGS_FILE = 'monitor-tags.yaml';

/**
 * The curated metadata dimensions every tool understands. Custom keys are also
 * allowed — these are simply the ones the scaffolding and docs promote.
 */
export const KNOWN_TAG_KEYS = [
  'owner',
  'business_unit',
  'criticality',
  'cost_center',
] as const;

export type KnownTagKey = (typeof KNOWN_TAG_KEYS)[number];

/** Object keys that must never be copied from external data (prototype safety). */
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/** A group's tags: well-known dimensions plus any custom string keys. */
export type Tags = Record<string, string>;

/** One group's metadata overlay. `name` matches a Monitor group name. */
export interface TaggedGroup {
  name: string;
  tags: Tags;
}

/** The parsed, validated tag overlay. */
export interface TagSet {
  version: 1;
  groups: TaggedGroup[];
}

// --- Schema ------------------------------------------------------------------

// Tag values are authored as strings, but YAML naturally yields numbers/booleans
// (e.g. `cost_center: 4200`, `criticality: 1`); coerce them so filtering is
// always string-to-string and predictable.
const tagValueSchema = z
  .union([z.string(), z.number(), z.boolean()])
  .transform((v) => String(v));

const tagsSchema = z.record(z.string().min(1), tagValueSchema);

const taggedGroupSchema = z
  .object({
    name: z.string().min(1),
    tags: tagsSchema.optional().default({}),
  })
  .strict();

const tagSetSchema = z
  .object({
    version: z.literal(1),
    groups: z.array(taggedGroupSchema).optional().default([]),
  })
  .strict();

// --- Parsing / loading -------------------------------------------------------

/** Strip prototype-polluting keys from a freshly-parsed tag bag. */
function sanitizeTags(tags: Tags): Tags {
  const clean: Tags = {};
  for (const [k, v] of Object.entries(tags)) {
    if (FORBIDDEN_KEYS.has(k)) continue;
    clean[k] = v;
  }
  return clean;
}

/** Parse and validate tag-overlay YAML text into a {@link TagSet}. */
export function parseTagSet(text: string): TagSet {
  let data: unknown;
  try {
    data = parseYaml(text);
  } catch (cause) {
    throw new TagError('The tags file is not valid YAML.', { cause });
  }

  const result = tagSetSchema.safeParse(data ?? { version: 1, groups: [] });
  if (!result.success) {
    const first = result.error.issues[0];
    const where = first?.path.length ? ` at "${first.path.join('.')}"` : '';
    throw new TagError(
      `Tags file failed validation${where}: ${first?.message ?? 'unknown error'}.`,
    );
  }

  const seen = new Set<string>();
  const groups: TaggedGroup[] = result.data.groups.map((g) => {
    if (seen.has(g.name)) {
      throw new TagError(
        `Duplicate group "${g.name}" in tags file. Group names must be unique.`,
      );
    }
    seen.add(g.name);
    return { name: g.name, tags: sanitizeTags(g.tags) };
  });

  return { version: result.data.version, groups };
}

/** Read and validate a tag overlay from disk. Throws if the file is absent. */
export function loadTagSet(path: string): TagSet {
  if (!existsSync(path)) {
    throw new TagError(
      `Tags file not found: ${path}. Run "monitor-tagger init" to create one.`,
    );
  }
  let text: string;
  try {
    text = readFileSync(path, 'utf8');
  } catch (cause) {
    throw new TagError(`Could not read tags file: ${path}.`, { cause });
  }
  return parseTagSet(text);
}

/**
 * Like {@link loadTagSet} but returns an empty set when the file is absent —
 * for tools that filter by tags only when an overlay happens to be present.
 */
export function loadTagSetIfPresent(path: string): TagSet {
  if (!existsSync(path)) return { version: 1, groups: [] };
  return loadTagSet(path);
}

// --- Lookup / filtering ------------------------------------------------------

/** Look up a single group's tags by name. Returns `{}` if untagged/unknown. */
export function tagsForGroup(set: TagSet, groupName: string): Tags {
  for (const g of set.groups) {
    if (g.name === groupName) return g.tags;
  }
  return {};
}

/** A parsed `key=value` filter. */
export interface TagFilter {
  key: string;
  value: string;
}

/**
 * Parse `key=value` filter expressions (e.g. `owner=dba-team`). Keys and values
 * are trimmed; values may contain `=`. Throws {@link TagError} on a malformed
 * expression so the CLI can report it clearly.
 */
export function parseTagFilters(specs: readonly string[]): TagFilter[] {
  return specs.map((spec) => {
    const eq = spec.indexOf('=');
    if (eq <= 0) {
      throw new TagError(
        `Invalid tag filter "${spec}". Use key=value, e.g. owner=dba-team.`,
      );
    }
    const key = spec.slice(0, eq).trim();
    const value = spec.slice(eq + 1).trim();
    if (!key || !value) {
      throw new TagError(
        `Invalid tag filter "${spec}". Both key and value are required.`,
      );
    }
    return { key, value };
  });
}

/**
 * Does a tag bag satisfy the filters? Semantics: AND across distinct keys, OR
 * within the same key repeated. Value comparison is case-insensitive. An empty
 * filter list matches everything.
 */
export function matchesTagFilters(
  tags: Tags,
  filters: readonly TagFilter[],
): boolean {
  if (filters.length === 0) return true;

  const wanted = new Map<string, Set<string>>();
  for (const { key, value } of filters) {
    const set = wanted.get(key) ?? new Set<string>();
    set.add(value.toLowerCase());
    wanted.set(key, set);
  }

  for (const [key, values] of wanted) {
    const actual = Object.prototype.hasOwnProperty.call(tags, key)
      ? tags[key]?.toLowerCase()
      : undefined;
    if (actual === undefined || !values.has(actual)) return false;
  }
  return true;
}

/**
 * Filter a list of group names down to those whose tags satisfy `filters`.
 * Order is preserved. With no filters, the input is returned unchanged.
 */
export function filterByTags(
  set: TagSet,
  groupNames: readonly string[],
  filters: readonly TagFilter[],
): string[] {
  if (filters.length === 0) return [...groupNames];
  return groupNames.filter((name) =>
    matchesTagFilters(tagsForGroup(set, name), filters),
  );
}
