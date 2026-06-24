/**
 * Library surface for `@rgm-power-tools/server` — the self-hostable dashboard
 * and JSON API over the toolkit. Import {@link createServer} to embed it, or use
 * the `monitor-dashboard` binary to run it standalone.
 */

export { createServer, type CreateServerOptions } from './server.js';
export { createApi, type ApiRequest, type ApiResponse, type ApiDeps } from './api.js';
export { ToolService, type ToolServiceOptions, type ApplyRequest } from './services.js';
export {
  resolveServerConfig,
  ServerConfigError,
  type ServerConfig,
  type ServerConfigInput,
} from './config.js';
export { tokensMatch, bearerToken } from './auth.js';
