import type { AnnotationInput } from '@rgm-power-tools/core';
import { providerByName } from './providers/index.js';
import { deployEventToAnnotation, shouldAnnotate } from './annotation.js';
import {
  WebhookAuthError,
  WebhookParseError,
  type DeployEvent,
} from './types.js';

export interface WebhookRequest {
  /** Provider name from the URL path, e.g. `github`. */
  provider: string;
  rawBody: string;
  /** Header map with lowercase keys. */
  headers: Record<string, string | undefined>;
  query: URLSearchParams;
}

export interface WebhookResult {
  status: number;
  body: unknown;
}

export interface HandlerDeps {
  secret: string;
  /** Persist the annotation (injected — Monitor client in prod, spy in tests). */
  writeAnnotation: (input: AnnotationInput) => Promise<void>;
}

/**
 * Build the webhook handler: a pure-ish async function from {@link WebhookRequest}
 * to {@link WebhookResult}. It selects the provider, verifies the signature,
 * parses the payload, and — for terminal events — writes an annotation via the
 * injected writer. The HTTP server is a thin adapter over this; tests call it
 * directly with a spy writer.
 */
export function createWebhookHandler(
  deps: HandlerDeps,
): (req: WebhookRequest) => Promise<WebhookResult> {
  return async (req) => {
    const provider = providerByName(req.provider);
    if (!provider) {
      return { status: 404, body: { error: `Unknown provider "${req.provider}".` } };
    }

    // Authenticate on the raw bytes BEFORE parsing — never process an
    // unauthenticated payload. Signatures cover rawBody, not the parsed object.
    try {
      provider.verify({
        rawBody: req.rawBody,
        payload: undefined,
        headers: req.headers,
        query: req.query,
        secret: deps.secret,
      });
    } catch (err) {
      if (err instanceof WebhookAuthError) {
        return { status: 401, body: { error: err.message } };
      }
      throw err;
    }

    let payload: unknown;
    try {
      payload = req.rawBody ? JSON.parse(req.rawBody) : {};
    } catch {
      return { status: 400, body: { error: 'Invalid JSON body.' } };
    }

    const ctx = {
      rawBody: req.rawBody,
      payload,
      headers: req.headers,
      query: req.query,
      secret: deps.secret,
    };

    let event: DeployEvent;
    try {
      event = provider.parse(ctx);
    } catch (err) {
      if (err instanceof WebhookParseError) {
        return { status: 400, body: { error: err.message } };
      }
      throw err;
    }

    if (!shouldAnnotate(event)) {
      return {
        status: 200,
        body: { skipped: true, reason: 'non-terminal status', status: event.status },
      };
    }

    const annotation = deployEventToAnnotation(event);
    // A ?object= query param can target a specific Monitor object.
    const objectOverride = req.query.get('object');
    if (objectOverride && !annotation.object) annotation.object = objectOverride;

    await deps.writeAnnotation(annotation);
    return { status: 200, body: { created: true, annotation } };
  };
}
