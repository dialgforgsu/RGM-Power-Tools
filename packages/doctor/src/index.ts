/**
 * Library surface for `@rgm-power-tools/monitor-doctor`. The CLI is one
 * consumer; the dashboard server is another — it gathers a snapshot and runs
 * the same checks to render a health report in the UI.
 */

export { gatherSnapshot } from './snapshot.js';
export {
  runChecks,
  hasFindingsAtOrAbove,
  UnknownCheckError,
  type RunOptions,
  type DoctorReport,
} from './run.js';
export { CHECKS, checkById } from './checks/index.js';
export {
  SEVERITY_RANK,
  type Severity,
  type Finding,
  type Check,
  type MonitorSnapshot,
} from './types.js';
