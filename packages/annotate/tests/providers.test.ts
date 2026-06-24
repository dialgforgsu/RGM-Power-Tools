import { describe, it, expect } from 'vitest';
import { hmacSha256Hex } from '../src/verify.js';
import { github, gitlab, generic } from '../src/providers/index.js';
import { WebhookAuthError, type WebhookContext } from '../src/types.js';

const SECRET = 'a-strong-webhook-secret';

function ctx(
  payload: unknown,
  headers: Record<string, string | undefined>,
  query = '',
): WebhookContext {
  return {
    rawBody: JSON.stringify(payload),
    payload,
    headers,
    query: new URLSearchParams(query),
    secret: SECRET,
  };
}

describe('github provider', () => {
  const payload = {
    repository: { full_name: 'acme/web' },
    deployment: { ref: 'main', sha: 'abcdef1234567890', environment: 'production' },
    deployment_status: { state: 'success', target_url: 'https://ci/run/1' },
    sender: { login: 'alice' },
  };

  function headers(sign = SECRET) {
    const c = ctx(payload, {});
    return {
      'x-github-event': 'deployment_status',
      'x-hub-signature-256': `sha256=${hmacSha256Hex(c.rawBody, sign)}`,
    };
  }

  it('verifies a correct signature and parses a deployment_status', () => {
    const c = ctx(payload, headers());
    expect(() => github.verify(c)).not.toThrow();
    const e = github.parse(c);
    expect(e).toMatchObject({
      provider: 'github',
      app: 'acme/web',
      environment: 'production',
      ref: 'main',
      sha: 'abcdef1234567890',
      actor: 'alice',
      status: 'success',
    });
  });

  it('rejects a bad signature', () => {
    const c = ctx(payload, headers('wrong-secret'));
    expect(() => github.verify(c)).toThrow(WebhookAuthError);
  });
});

describe('gitlab provider', () => {
  const payload = {
    object_kind: 'deployment',
    status: 'success',
    environment: 'production',
    ref: 'main',
    short_sha: 'abcdef1',
    user: { name: 'Bob' },
    project: { path_with_namespace: 'acme/api', web_url: 'https://gl/acme/api' },
  };

  it('verifies the token and parses a deployment', () => {
    const c = ctx(payload, { 'x-gitlab-token': SECRET });
    expect(() => gitlab.verify(c)).not.toThrow();
    const e = gitlab.parse(c);
    expect(e).toMatchObject({
      provider: 'gitlab',
      app: 'acme/api',
      environment: 'production',
      status: 'success',
      actor: 'Bob',
    });
  });

  it('rejects a wrong/missing token', () => {
    expect(() => gitlab.verify(ctx(payload, { 'x-gitlab-token': 'nope' }))).toThrow(
      WebhookAuthError,
    );
    expect(() => gitlab.verify(ctx(payload, {}))).toThrow(WebhookAuthError);
  });
});

describe('generic provider', () => {
  const payload = {
    app: 'billing',
    version: 'v3.4.0',
    environment: 'prod',
    status: 'success',
    actor: 'ci-bot',
    object: 'PROD-SQL-01',
  };

  function sigHeaders(field = 'x-signature-256') {
    const c = ctx(payload, {});
    return { [field]: `sha256=${hmacSha256Hex(c.rawBody, SECRET)}` };
  }

  it('verifies via x-signature-256 and parses fields', () => {
    const c = ctx(payload, sigHeaders());
    expect(() => generic.verify(c)).not.toThrow();
    const e = generic.parse(c);
    expect(e).toMatchObject({
      provider: 'generic',
      app: 'billing',
      version: 'v3.4.0',
      environment: 'prod',
      status: 'success',
      object: 'PROD-SQL-01',
    });
  });

  it('also accepts x-hub-signature-256', () => {
    const c = ctx(payload, sigHeaders('x-hub-signature-256'));
    expect(() => generic.verify(c)).not.toThrow();
  });

  it('carries a custom text message through', () => {
    const custom = { text: 'Manual rollback to v3.3.9' };
    const c = ctx(custom, {});
    expect(generic.parse({ ...c }).customText).toBe('Manual rollback to v3.3.9');
  });
});
