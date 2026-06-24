/**
 * Library surface for `@rgm-power-tools/monitor-tagger`. The tag *engine*
 * (schema, loader, filtering) lives in `@rgm-power-tools/core`; this package
 * adds the file-management layer (serialization, scaffolding from live groups)
 * that the CLI and the self-hostable server both build on.
 */

export {
  serializeTagSet,
  writeTagSet,
  scaffoldFromGroups,
  type ScaffoldResult,
} from './tags-io.js';
export { DEFAULT_TAGS_FILE } from './constants.js';
