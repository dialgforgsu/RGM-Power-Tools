import {
  createServer as createHttpServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from 'node:http';
import type { WebhookRequest, WebhookResult } from './handler.js';

/** Largest webhook body accepted (defends against memory abuse). */
const MAX_BODY_BYTES = 2_000_000;

const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Cache-Control': 'no-store',
};

export interface ReceiverServerOptions {
  handler: (req: WebhookRequest) => Promise<WebhookResult>;
}

/**
 * Build (but do not start) the webhook receiver HTTP server. Routes:
 *   GET  /health            → liveness
 *   POST /webhook/:provider → verify + annotate
 * Call `.listen(port, host)` to start.
 */
export function createReceiver(options: ReceiverServerOptions): Server {
  return createHttpServer((req, res) => {
    void handle(req, res, options.handler).catch(() => {
      if (!res.headersSent) writeJson(res, 500, { error: 'Internal server error.' });
      else res.end();
    });
  });
}

async function handle(
  req: IncomingMessage,
  res: ServerResponse,
  handler: (req: WebhookRequest) => Promise<WebhookResult>,
): Promise<void> {
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.setHeader(k, v);

  const method = (req.method ?? 'GET').toUpperCase();
  const url = new URL(req.url ?? '/', 'http://localhost');

  if (method === 'GET' && url.pathname === '/health') {
    writeJson(res, 200, { ok: true });
    return;
  }

  const match = /^\/webhook\/([a-z0-9_-]+)$/i.exec(url.pathname);
  if (!match || method !== 'POST') {
    writeJson(res, 404, { error: 'Not found.' });
    return;
  }

  const read = await readBody(req);
  if (read.error) {
    writeJson(res, 413, { error: read.error });
    return;
  }

  const headers: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(req.headers)) {
    headers[k.toLowerCase()] = Array.isArray(v) ? v[0] : v;
  }

  const result = await handler({
    provider: match[1]!.toLowerCase(),
    rawBody: read.body ?? '',
    headers,
    query: url.searchParams,
  });
  writeJson(res, result.status, result.body);
}

function writeJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body ?? {}));
}

function readBody(
  req: IncomingMessage,
): Promise<{ body?: string; error?: string }> {
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
      if (!aborted) resolvePromise({ body: Buffer.concat(chunks).toString('utf8') });
    });
    req.on('error', () => resolvePromise({ error: 'Request error.' }));
  });
}
