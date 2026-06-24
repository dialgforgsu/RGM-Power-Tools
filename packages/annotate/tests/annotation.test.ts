import { describe, it, expect } from 'vitest';
import { shouldAnnotate, deployEventToAnnotation } from '../src/annotation.js';
import type { DeployEvent } from '../src/types.js';

describe('shouldAnnotate', () => {
  it('annotates terminal and unknown statuses', () => {
    expect(shouldAnnotate({ provider: 'x', status: 'success' })).toBe(true);
    expect(shouldAnnotate({ provider: 'x', status: 'failed' })).toBe(true);
    expect(shouldAnnotate({ provider: 'x' })).toBe(true);
  });
  it('skips in-progress statuses', () => {
    expect(shouldAnnotate({ provider: 'x', status: 'running' })).toBe(false);
    expect(shouldAnnotate({ provider: 'x', status: 'pending' })).toBe(false);
    expect(shouldAnnotate({ provider: 'x', status: 'queued' })).toBe(false);
  });
});

describe('deployEventToAnnotation', () => {
  it('composes a deploy message and maps actor/object/time', () => {
    const event: DeployEvent = {
      provider: 'github',
      app: 'acme/web',
      version: 'v1.2.3',
      sha: 'abcdef1234567890',
      environment: 'production',
      status: 'success',
      actor: 'alice',
      object: 'PROD-SQL-01',
      timeUtc: '2026-06-24T01:00:00Z',
    };
    const a = deployEventToAnnotation(event);
    expect(a.text).toBe('🚀 acme/web v1.2.3 (abcdef1) → production — success by alice');
    expect(a.object).toBe('PROD-SQL-01');
    expect(a.author).toBe('alice');
    expect(a.createdUtc).toBe('2026-06-24T01:00:00Z');
  });

  it('uses a failure icon for failed deploys', () => {
    const a = deployEventToAnnotation({ provider: 'x', app: 'web', status: 'failed' });
    expect(a.text.startsWith('❌')).toBe(true);
  });

  it('uses customText verbatim when present', () => {
    const a = deployEventToAnnotation({ provider: 'generic', customText: 'Rollback', actor: 'bob' });
    expect(a.text).toBe('Rollback');
    expect(a.author).toBe('bob');
  });

  it('falls back to ref when no version', () => {
    const a = deployEventToAnnotation({ provider: 'x', app: 'web', ref: 'main', status: 'success' });
    expect(a.text).toContain('web main');
  });
});
