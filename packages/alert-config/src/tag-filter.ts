import { resolve } from 'node:path';
import {
  DEFAULT_TAGS_FILE,
  loadTagSet,
  parseTagFilters,
  filterByTags,
} from '@rgm-power-tools/core';
import { resolveConfig } from './resolve.js';
import type { ConfigFile } from './schema.js';

/**
 * Tag-filtering options shared by the network commands. This is the seam that
 * lets `monitor-config` consume the overlay authored by `monitor-tagger`: the
 * tags become filter keys, so `--tag criticality=high` scopes a command to just
 * those groups. Any future tool can reuse the same engine from core.
 */
export interface TagFilterOptions {
  /** Repeatable `key=value` filters. */
  tag?: string[];
  /** Tags file path (default: monitor-tags.yaml in the working directory). */
  tagsFile?: string;
}

/**
 * Filter a config's groups to those whose tags match `--tag` filters. With no
 * filters this is a no-op and the tags file is never even read — so tagging is
 * entirely opt-in and existing workflows are unaffected.
 *
 * Inheritance is resolved (flattened) before filtering, so dropping a group can
 * never break an `inherits_from` reference: the returned config is a flat set of
 * effective group policies containing only the matched groups.
 */
export function filterConfigByTags(
  config: ConfigFile,
  options: TagFilterOptions,
  cwd: string,
): ConfigFile {
  const filters = parseTagFilters(options.tag ?? []);
  if (filters.length === 0) return config;

  const tagsPath = resolve(cwd, options.tagsFile ?? DEFAULT_TAGS_FILE);
  const set = loadTagSet(tagsPath);

  const resolved = resolveConfig(config);
  const allowed = new Set(
    filterByTags(
      set,
      resolved.groups.map((g) => g.name),
      filters,
    ),
  );

  const groups: ConfigFile['groups'] = resolved.groups
    .filter((g) => allowed.has(g.name))
    .map((g) => ({
      name: g.name,
      ...(g.description !== undefined ? { description: g.description } : {}),
      servers: g.servers,
      alerts: g.alerts,
    }));

  return { version: config.version, connection: config.connection, groups };
}
