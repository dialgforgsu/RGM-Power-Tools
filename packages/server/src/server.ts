import { createServer as createHttpServer, type Server } from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { ToolService } from './services.js';
import { createApi, type ApiRequest } from './api.js';
import { serveStatic } from './static.js';
import type { ServerConfig } from './config.js';

/** Largest JSON request body accepted on the API (defends against memory abuse). */
const MAX_BODY_BYTES = 1_000_000;

/** Where the dashboard's static assets live, relative to the built file. */
function defaultPublicDir(): string {
  // dist/server.js -> ../public
  const here = dirname(fileURLToPath(import.meta.url));
  return resolve(here, '..', 'public');
}

const SECURITY_HEADERS: Record<string, string> = {
  // The dashboard only loads its own same-origin assets and talks to its own
  // API; lock everything else down. No inline scripts/styles are used.
  'Content-Security-Policy':
    "default-src 'none'; script-src 'self'; style-src 'self'; " +
    "connect-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'none'",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
};

export interface CreateServerOptions {
  config: ServerConfig;
  /** Override the static asset directory (tests). */
  publicDir?: string;
  /** Inject a service (tests). Defaults to one bound to the config's workdir. */
  service?: ToolService;
}

/**
 * Build (but do not start) the dashboard HTTP server. The API is gated by the
 * configured bearer token; the static dashboard is open (it carries no
 * secrets). Call `.listen(config.port, config.host)` to start.
 */
export function createServer(options: CreateServerOptions): Server {
  const { config } = options;
  const publicDir = options.publicDir ?? defaultPublicDir();
  const service =
    options.service ?? new ToolService({ workdir: config.workdir });
  const api = createApi({
    service,
    token: config.token,
    authRequired: Boolean(config.token),
  });

  return createHttpServer((req, res) => {
    void handle().catch(() => {
      if (!res.headersSent) {
        writeJson(res, 500, { error: 'Internal server error.' });
      } else {
        res.end();
      }
    });

    async function handle(): Promise<void> {
      for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.setHeader(k, v);

      const method = (req.method ?? 'GET').toUpperCase();
      const url = new URL(req.url ?? '/', 'http://localhost');
      const path = url.pathname;

      if (path === '/api' || path.startsWith('/api/')) {
        res.setHeader('Cache-Control', 'no-store');
        if (method !== 'GET' && method !== 'POST') {
          writeJson(res, 405, { error: 'Method not allowed.' });
          return;
        }
        let body: unknown;
        if (method === 'POST') {
          const parsed = await readJsonBody(req);
          if (parsed.error) {
            writeJson(res, 400, { error: parsed.error });
            return;
          }
          body = parsed.value;
        }
        const apiReq: ApiRequest = {
          method,
          path,
          query: url.searchParams,
          headers: { authorization: header(req.headers.authorization) },
          body,
        };
        const result = await api(apiReq);
        writeJson(res, result.status, result.body);
        return;
      }

      // Static dashboard.
      if (method !== 'GET' && method !== 'HEAD') {
        writeJson(res, 405, { error: 'Method not allowed.' });
        return;
      }
      const file = await serveStatic(publicDir, path);
      if (!file) {
        writeJson(res, 404, { error: 'Not found.' });
        return;
      }
      res.statusCode = 200;
      res.setHeader('Content-Type', file.contentType);
      res.end(method === 'HEAD' ? undefined : file.content);
    }
  });
}

function header(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function writeJson(
  res: import('node:http').ServerResponse,
  status: number,
  body: unknown,
): void {
  const payload = JSON.stringify(body ?? {});
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(payload);
}

function readJsonBody(
  req: import('node:http').IncomingMessage,
): Promise<{ value?: unknown; error?: string }> {
  return new Promise((resolvePromise) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let aborted = false;
    req.on('data', (chunk: Buffer) => {
      if (aborted) return;
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        aborted = true;
        resolvePromise({ error: 'Request body too large.' });
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (aborted) return;
      const text = Buffer.concat(chunks).toString('utf8').trim();
      if (!text) {
        resolvePromise({ value: undefined });
        return;
      }
      try {
        resolvePromise({ value: JSON.parse(text) });
      } catch {
        resolvePromise({ error: 'Invalid JSON body.' });
      }
    });
    req.on('error', () => resolvePromise({ error: 'Request error.' }));
  });
}
