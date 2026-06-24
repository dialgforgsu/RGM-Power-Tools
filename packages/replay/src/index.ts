/**
 * Library surface for `@rgm-power-tools/monitor-replay`. The CLI is one
 * consumer; the dashboard server is another — it parses a window, gathers the
 * timeline, and renders the same markdown post-mortem.
 */

export { parseWindow, parseDurationMs, type WindowInput } from './window.js';
export { gatherTimeline } from './gather.js';
export { renderPostMortem } from './render.js';
export {
  ReplayError,
  type IncidentData,
  type RenderOptions,
} from './types.js';
