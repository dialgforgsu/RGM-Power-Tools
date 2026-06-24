import { constantTimeEqual } from '../verify.js';
import {
  WebhookAuthError,
  type DeployEvent,
  type Provider,
  type WebhookContext,
} from '../types.js';

function normalizeStatus(status: string | undefined): string | undefined {
  switch ((status ?? '').toLowerCase()) {
    case 'success':
      return 'success';
    case 'failed':
      return 'failed';
    case 'running':
    case 'created':
    case 'pending':
      return 'running';
    case 'canceled':
    case 'cancelled':
      return 'canceled';
    default:
      return status ? status.toLowerCase() : undefined;
  }
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined;
}

/**
 * GitLab webhooks. Authenticated with the `X-Gitlab-Token` shared secret.
 * Understands Deployment and Pipeline hooks.
 */
export const gitlab: Provider = {
  name: 'gitlab',
  verify(ctx: WebhookContext): void {
    const token = ctx.headers['x-gitlab-token'];
    if (!token || !constantTimeEqual(token, ctx.secret)) {
      throw new WebhookAuthError('GitLab token verification failed.');
    }
  },
  parse(ctx: WebhookContext): DeployEvent {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const p = (ctx.payload ?? {}) as Record<string, any>;
    const e: DeployEvent = { provider: 'gitlab' };
    e.app = str(p.project?.path_with_namespace ?? p.project?.name);

    if (p.object_kind === 'deployment') {
      e.environment = str(p.environment);
      e.ref = str(p.ref);
      e.sha = str(p.short_sha ?? p.commit_url);
      e.actor = str(p.user?.name ?? p.user?.username);
      e.url = str(p.deployable_url ?? p.project?.web_url);
      e.status = normalizeStatus(p.status);
    } else if (p.object_kind === 'pipeline') {
      const oa = p.object_attributes ?? {};
      e.ref = str(oa.ref);
      e.sha = str(oa.sha);
      e.actor = str(p.user?.name ?? p.user?.username);
      e.status = normalizeStatus(oa.status);
    } else {
      e.ref = str(p.ref);
      e.actor = str(p.user?.name ?? p.user_name);
    }
    return e;
    /* eslint-enable @typescript-eslint/no-explicit-any */
  },
};
