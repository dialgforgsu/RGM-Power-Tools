/**
 * Library surface for `@rgm-power-tools/monitor-annotate`. The CLI is one
 * consumer; the dashboard server reuses the annotation builder for its manual
 * "add annotation" endpoint.
 */

export {
  createWebhookHandler,
  type WebhookRequest,
  type WebhookResult,
  type HandlerDeps,
} from './handler.js';
export { deployEventToAnnotation, shouldAnnotate } from './annotation.js';
export { PROVIDERS, providerByName, github, gitlab, generic } from './providers/index.js';
export { hmacSha256Hex, constantTimeEqual, verifyHmacHeader } from './verify.js';
export { resolveReceiverConfig, AnnotateConfigError, type ReceiverConfig } from './config.js';
export { createReceiver } from './server.js';
export {
  AnnotateError,
  WebhookAuthError,
  WebhookParseError,
  type DeployEvent,
  type Provider,
  type WebhookContext,
} from './types.js';
