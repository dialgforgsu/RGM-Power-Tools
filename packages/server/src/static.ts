import { readFile } from 'node:fs/promises';
import { resolve, normalize, extname, sep } from 'node:path';

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
};

export interface StaticFile {
  content: Buffer;
  contentType: string;
}

/**
 * Resolve a request path to a file inside `rootDir`, safely. Returns null if the
 * file does not exist or the path escapes the root (directory traversal). `/`
 * maps to `index.html`.
 */
export async function serveStatic(
  rootDir: string,
  urlPath: string,
): Promise<StaticFile | null> {
  const rel = urlPath === '/' || urlPath === '' ? 'index.html' : urlPath;
  // Normalize and strip any leading separators so join can't be tricked, then
  // verify the resolved path is still under rootDir.
  const decoded = safeDecode(rel);
  if (decoded === null) return null;
  const normalized = normalize(decoded).replace(/^([/\\])+/, '');
  const target = resolve(rootDir, normalized);
  const rootResolved = resolve(rootDir);
  if (target !== rootResolved && !target.startsWith(rootResolved + sep)) {
    return null; // escaped the root
  }

  try {
    const content = await readFile(target);
    const contentType =
      CONTENT_TYPES[extname(target).toLowerCase()] ?? 'application/octet-stream';
    return { content, contentType };
  } catch {
    return null;
  }
}

function safeDecode(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}
