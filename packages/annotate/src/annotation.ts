import type { AnnotationInput } from '@rgm-power-tools/core';
import type { DeployEvent } from './types.js';

/** Statuses that mean "in progress" — not worth annotating by default. */
const SKIP_STATUSES = new Set([
  'running',
  'pending',
  'queued',
  'created',
  'in_progress',
]);

/**
 * Whether an event is worth recording. Skips in-progress states so the timeline
 * only gets terminal outcomes (and anything with no status at all).
 */
export function shouldAnnotate(event: DeployEvent): boolean {
  if (!event.status) return true;
  return !SKIP_STATUSES.has(event.status);
}

/** Compose the annotation text for a deploy event. */
function composeText(event: DeployEvent): string {
  const failed = event.status === 'failed' || event.status === 'error';
  const icon = failed ? '❌' : '🚀';
  const name = event.app ?? 'deploy';
  const version = event.version ?? event.ref ?? '';
  const sha = event.sha ? ` (${event.sha.slice(0, 7)})` : '';
  const env = event.environment ? ` → ${event.environment}` : '';
  const status = event.status ? ` — ${event.status}` : '';
  const by = event.actor ? ` by ${event.actor}` : '';
  return `${icon} ${name} ${version}${sha}${env}${status}${by}`
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Build the Monitor annotation for a deploy event. A `customText` (from the
 * generic provider) is used verbatim; otherwise the standard fields are
 * composed into a one-line "what changed" message.
 */
export function deployEventToAnnotation(event: DeployEvent): AnnotationInput {
  const text = event.customText ?? composeText(event);
  const annotation: AnnotationInput = { text };
  if (event.object) annotation.object = event.object;
  if (event.actor) annotation.author = event.actor;
  if (event.timeUtc) annotation.createdUtc = event.timeUtc;
  return annotation;
}
