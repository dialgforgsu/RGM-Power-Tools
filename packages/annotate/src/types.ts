import { MonitorToolError } from '@rgm-power-tools/core';

/** Base error for monitor-annotate. */
export class AnnotateError extends MonitorToolError {}
/** Webhook signature/token failed verification → HTTP 401. */
export class WebhookAuthError extends AnnotateError {}
/** Webhook payload could not be parsed/understood → HTTP 400. */
export class WebhookParseError extends AnnotateError {}

/** Normalized deploy/CI event, provider-agnostic. */
export interface DeployEvent {
  provider: string;
  /** Repo/project/app name. */
  app?: string;
  environment?: string;
  /** Branch or tag. */
  ref?: string;
  sha?: string;
  /** Release/tag version. */
  version?: string;
  /** Who triggered it. */
  actor?: string;
  /** Normalized: success | failed | running | pending | unknown. */
  status?: string;
  /** Explicit Monitor object to attach to. */
  object?: string;
  url?: string;
  /** ISO-8601 event time. */
  timeUtc?: string;
  /** A caller-supplied message that overrides the composed text (generic). */
  customText?: string;
}

/** Everything a provider needs to verify and parse a webhook. */
export interface WebhookContext {
  rawBody: string;
  payload: unknown;
  headers: Record<string, string | undefined>;
  query: URLSearchParams;
  secret: string;
}

/** A webhook source adapter (GitHub, GitLab, generic, …). */
export interface Provider {
  name: string;
  /** Authenticate the request; throws {@link WebhookAuthError} if invalid. */
  verify(ctx: WebhookContext): void;
  /** Parse the payload into a {@link DeployEvent}. */
  parse(ctx: WebhookContext): DeployEvent;
}
