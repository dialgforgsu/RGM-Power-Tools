import { verifyHmacHeader } from '../verify.js';
import {
  WebhookAuthError,
  type DeployEvent,
  type Provider,
  type WebhookContext,
} from '../types.js';

/** Map GitHub deployment/CI states to our normalized status. */
function normalizeStatus(state: string | undefined): string | undefined {
  switch ((state ?? '').toLowerCase()) {
    case 'success':
      return 'success';
    case 'failure':
    case 'error':
      return 'failed';
    case 'in_progress':
    case 'queued':
    case 'pending':
    case 'waiting':
      return 'running';
    default:
      return state ? state.toLowerCase() : undefined;
  }
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined;
}

/**
 * GitHub webhooks. Authenticated with the `X-Hub-Signature-256` HMAC of the raw
 * body. Understands `deployment_status`, `deployment`, `release`, and `push`.
 */
export const github: Provider = {
  name: 'github',
  verify(ctx: WebhookContext): void {
    if (
      !verifyHmacHeader(ctx.rawBody, ctx.secret, ctx.headers['x-hub-signature-256'])
    ) {
      throw new WebhookAuthError('GitHub signature verification failed.');
    }
  },
  parse(ctx: WebhookContext): DeployEvent {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const p = (ctx.payload ?? {}) as Record<string, any>;
    const event = ctx.headers['x-github-event'];
    const e: DeployEvent = { provider: 'github' };
    e.app = str(p.repository?.full_name);

    if (event === 'deployment_status') {
      e.environment = str(
        p.deployment?.environment ?? p.deployment_status?.environment,
      );
      e.ref = str(p.deployment?.ref);
      e.sha = str(p.deployment?.sha);
      e.actor = str(p.sender?.login);
      e.url = str(p.deployment_status?.target_url);
      e.status = normalizeStatus(p.deployment_status?.state);
    } else if (event === 'deployment') {
      e.environment = str(p.deployment?.environment);
      e.ref = str(p.deployment?.ref);
      e.sha = str(p.deployment?.sha);
      e.actor = str(p.sender?.login);
    } else if (event === 'release') {
      e.version = str(p.release?.tag_name);
      e.url = str(p.release?.html_url);
      e.actor = str(p.release?.author?.login ?? p.sender?.login);
      e.status = 'success';
    } else {
      e.ref = str(p.ref);
      e.sha = str(p.after);
      e.actor = str(p.pusher?.name ?? p.sender?.login);
    }
    return e;
    /* eslint-enable @typescript-eslint/no-explicit-any */
  },
};
