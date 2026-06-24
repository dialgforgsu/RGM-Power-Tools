import { describe, it, expect } from 'vitest';
import type { AnnotationInput } from '@rgm-power-tools/core';
import { hmacSha256Hex } from '../src/verify.js';
import { createWebhookHandler, type WebhookRequest } from '../src/handler.js';

const SECRET = 'a-strong-webhook-secret';

function makeHandler() {
  const writes: AnnotationInput[] = [];
  const handle = createWebhookHandler({
    secret: SECRET,
    writeAnnotation: async (input) => {
      writes.push(input);
    },
  });
  return { writes, handle };
}

function githubReq(
  payload: unknown,
  event: string,
  opts: { secret?: string; query?: string } = {},
): WebhookRequest {
  const rawBody = JSON.stringify(payload);
  const sig = `sha256=${hmacSha256Hex(rawBody, opts.secret ?? SECRET)}`;
  return {
    provider: 'github',
    rawBody,
    headers: { 'x-github-event': event, 'x-hub-signature-256': sig },
    query: new URLSearchParams(opts.query ?? ''),
  };
}

const deploySuccess = {
  repository: { full_name: 'acme/web' },
  deployment: { ref: 'main', sha: 'abcdef1234567', environment: 'production' },
  deployment_status: { state: 'success' },
  sender: { login: 'alice' },
};

describe('createWebhookHandler', () => {
  it('writes an annotation for a verified terminal event', async () => {
    const { writes, handle } = makeHandler();
    const res = await handle(githubReq(deploySuccess, 'deployment_status'));
    expect(res.status).toBe(200);
    expect((res.body as { created: boolean }).created).toBe(true);
    expect(writes).toHaveLength(1);
    expect(writes[0]!.text).toContain('acme/web');
    expect(writes[0]!.text).toContain('production');
  });

  it('rejects a bad signature with 401 and writes nothing', async () => {
    const { writes, handle } = makeHandler();
    const res = await handle(githubReq(deploySuccess, 'deployment_status', { secret: 'wrong' }));
    expect(res.status).toBe(401);
    expect(writes).toHaveLength(0);
  });

  it('skips non-terminal statuses without writing', async () => {
    const { writes, handle } = makeHandler();
    const running = { ...deploySuccess, deployment_status: { state: 'in_progress' } };
    const res = await handle(githubReq(running, 'deployment_status'));
    expect(res.status).toBe(200);
    expect((res.body as { skipped: boolean }).skipped).toBe(true);
    expect(writes).toHaveLength(0);
  });

  it('404s an unknown provider', async () => {
    const { handle } = makeHandler();
    const res = await handle({
      provider: 'bitbucket',
      rawBody: '{}',
      headers: {},
      query: new URLSearchParams(),
    });
    expect(res.status).toBe(404);
  });

  it('400s invalid JSON', async () => {
    const { handle } = makeHandler();
    const rawBody = 'not json';
    const res = await handle({
      provider: 'github',
      rawBody,
      headers: { 'x-hub-signature-256': `sha256=${hmacSha256Hex(rawBody, SECRET)}` },
      query: new URLSearchParams(),
    });
    expect(res.status).toBe(400);
  });

  it('applies a ?object= override to the annotation', async () => {
    const { writes, handle } = makeHandler();
    await handle(githubReq(deploySuccess, 'deployment_status', { query: 'object=PROD-SQL-09' }));
    expect(writes[0]!.object).toBe('PROD-SQL-09');
  });
});
