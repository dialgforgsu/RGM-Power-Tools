import { verifyHmacHeader } from '../verify.js';
import {
  WebhookAuthError,
  type DeployEvent,
  type Provider,
  type WebhookContext,
} from '../types.js';

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined;
}

/**
 * Generic webhook for any system that can POST JSON. Authenticated with an
 * `X-Signature-256` (or `X-Hub-Signature-256`) HMAC of the raw body.
 *
 * Accepts a flat payload:
 *   { text?, app?, version?, environment?, ref?, sha?, actor?, status?,
 *     object?, url?, time? }
 * A `text` field becomes the annotation verbatim; otherwise the standard
 * fields are composed into one.
 */
export const generic: Provider = {
  name: 'generic',
  verify(ctx: WebhookContext): void {
    const header =
      ctx.headers['x-signature-256'] ?? ctx.headers['x-hub-signature-256'];
    if (!verifyHmacHeader(ctx.rawBody, ctx.secret, header)) {
      throw new WebhookAuthError('Signature verification failed.');
    }
  },
  parse(ctx: WebhookContext): DeployEvent {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const p = (ctx.payload ?? {}) as Record<string, any>;
    const e: DeployEvent = { provider: 'generic' };
    e.customText = str(p.text ?? p.message);
    e.app = str(p.app ?? p.application ?? p.service);
    e.version = str(p.version);
    e.environment = str(p.environment ?? p.env);
    e.ref = str(p.ref ?? p.branch);
    e.sha = str(p.sha ?? p.commit);
    e.actor = str(p.actor ?? p.user);
    e.status = str(p.status)?.toLowerCase();
    e.object = str(p.object);
    e.url = str(p.url);
    e.timeUtc = str(p.time ?? p.timestamp);
    return e;
    /* eslint-enable @typescript-eslint/no-explicit-any */
  },
};
