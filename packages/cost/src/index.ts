/**
 * Library surface for `@rgm-power-tools/monitor-cost`. The CLI is one consumer;
 * the dashboard server is another — it gathers cost data and runs the same pure
 * analysis to render a utilization/waste card.
 */

export { gatherCostData, type CostData } from './gather.js';
export { analyzeCost, projectCost } from './analyze.js';
export { resolveCostOptions, CostOptionError, type RawCostOptions } from './options.js';
export {
  type CostOptions,
  type CostReport,
  type IdleServer,
  type Projection,
} from './types.js';
