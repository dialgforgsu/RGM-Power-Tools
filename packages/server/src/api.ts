import { MonitorToolError } from '@rgm-power-tools/core';
import { bearerToken, tokensMatch } from './auth.js';
import type { ToolService } from './services.js';

export interface ApiRequest {
  method: string;
  /** Path without query string, e.g. `/api/diff`. */
  path: string;
  query: URLSearchParams;
  headers: Record<string, string | undefined>;
  /** Parsed JSON body, or undefined. */
  body?: unknown;
}

export interface ApiResponse {
  status: number;
  body: unknown;
}

export interface ApiDeps {
  service: ToolService;
  /** Configured bearer token (`''` when auth is disabled). */
  token: string;
  /** Whether to enforce auth. */
  authRequired: boolean;
}

function asFilters(query: URLSearchParams): string[] {
  return query.getAll('tag');
}

function bodyObject(body: unknown): Record<string, unknown> {
  return body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
}

type Handler = (req: ApiRequest, service: ToolService) => Promise<ApiResponse>;

/** Route table: `${METHOD} ${path}` -> handler. */
const routes: Record<string, Handler> = {
  'GET /api/status': async (_req, s) => ({ status: 200, body: await s.status() }),
  'GET /api/groups': async (_req, s) => ({ status: 200, body: await s.groups() }),
  'GET /api/config': async (_req, s) => ({ status: 200, body: s.configFile() }),
  'POST /api/config/validate': async (_req, s) => ({
    status: 200,
    body: s.validateConfig(),
  }),
  'GET /api/diff': async (req, s) => ({
    status: 200,
    body: await s.diff(asFilters(req.query)),
  }),
  'POST /api/apply': async (req, s) => {
    const b = bodyObject(req.body);
    return {
      status: 200,
      body: await s.apply({
        confirm: b.confirm === true,
        filters: Array.isArray(b.filters) ? (b.filters as string[]) : [],
      }),
    };
  },
  'GET /api/tags': async (_req, s) => ({ status: 200, body: s.tags() }),
  'POST /api/tags/validate': async (_req, s) => ({
    status: 200,
    body: s.validateTags(),
  }),
  'POST /api/tags/sync': async (req, s) => {
    const b = bodyObject(req.body);
    return { status: 200, body: await s.syncTags({ write: b.write === true }) };
  },
  'GET /api/doctor': async (_req, s) => ({ status: 200, body: await s.doctor() }),
  'GET /api/cost': async (req, s) => {
    const addRaw = req.query.get('add');
    const add = addRaw ? Number(addRaw) : undefined;
    return {
      status: 200,
      body: await s.cost(
        add !== undefined && Number.isInteger(add) && add > 0 ? add : undefined,
      ),
    };
  },
  'GET /api/replay': async (req, s) => ({
    status: 200,
    body: await s.replay({
      from: req.query.get('from') ?? undefined,
      to: req.query.get('to') ?? undefined,
      last: req.query.get('last') ?? undefined,
      title: req.query.get('title') ?? undefined,
    }),
  }),
};

/**
 * Build the API handler. Returns a pure async function from {@link ApiRequest}
 * to {@link ApiResponse} — the HTTP server is a thin adapter over it, and tests
 * call it directly. Enforces bearer auth on every route except `/api/health`.
 */
export function createApi(deps: ApiDeps): (req: ApiRequest) => Promise<ApiResponse> {
  return async (req) => {
    // Liveness probe is always open (no secrets, used by container healthchecks).
    if (req.method === 'GET' && req.path === '/api/health') {
      return { status: 200, body: { ok: true } };
    }

    if (deps.authRequired) {
      const presented = bearerToken(req.headers.authorization);
      if (!presented || !tokensMatch(presented, deps.token)) {
        return {
          status: 401,
          body: { error: 'Unauthorized. Provide a valid bearer token.' },
        };
      }
    }

    const handler = routes[`${req.method} ${req.path}`];
    if (!handler) {
      return { status: 404, body: { error: `No such endpoint: ${req.path}.` } };
    }

    try {
      return await handler(req, deps.service);
    } catch (err) {
      if (err instanceof MonitorToolError) {
        return { status: 400, body: { error: err.message, type: err.name } };
      }
      // Never leak internal stack/details to the client.
      return { status: 500, body: { error: 'Internal server error.' } };
    }
  };
}
