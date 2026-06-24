/**
 * Library surface for `@rgm-power-tools/monitor-config`. The CLI (`cli.ts`) is
 * one consumer; the self-hostable server is another. Everything the rest of the
 * toolkit needs to read, diff, validate, and apply alert config is re-exported
 * here so callers never reach into deep module paths.
 */

export { parseConfig, readConfigFile, serializeConfig } from './yaml-io.js';
export {
  resolveConfig,
  ConfigSemanticError,
  type ResolvedConfig,
  type ResolvedGroup,
} from './resolve.js';
export {
  diffConfigs,
  type DiffResult,
  type GroupDiff,
  type FieldChange,
  type ChangeKind,
} from './diff-engine.js';
export { applyConfig, type ApplyResult } from './apply-plan.js';
export { buildLiveConfig } from './live-state.js';
export { filterConfigByTags, type TagFilterOptions } from './tag-filter.js';
export { DEFAULT_CONFIG_FILE } from './constants.js';
export {
  ConfigValidationError,
  ConfigFileError,
  type ValidationIssue,
} from './errors.js';
export {
  configSchema,
  ALERT_NAMES,
  type ConfigFile,
  type GroupConfig,
  type AlertName,
} from './schema.js';
