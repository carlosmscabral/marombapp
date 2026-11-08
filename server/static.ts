/**
 * Static PWA asset and SPA fallback handler for the MarombApp Cloud Run BFF.
 * Serves compiled Vite assets from dist/ with immutable caching for hashed bundles,
 * no-cache headers for index.html and service worker scripts, and SPA fallback for client routes.
 */

import fs from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
};

/**
 * Computes the Cache-Control header value for a relative asset path inside dist/.
 * Hashed assets under /assets/ are cached immutably while HTML and PWA worker
 * metadata always revalidate.
 */
function resolveCacheControl(relativePath: string): string {
  const normalized = relativePath.replace(/\\/g, '/').replace(/^\/+/, '');
  if (
    normalized === 'index.html' ||
    normalized === 'sw.js' ||
    normalized === 'registerSW.js' ||
    normalized === 'manifest.webmanifest' ||
    normalized.startsWith('workbox-')
  ) {
    return 'no-cache, no-store, must-revalidate';
  }
  if (normalized.startsWith('assets/')) {
    return 'public, max-age=31536000, immutable';
  }
  return 'public, max-age=3600';
}

/**
 * Checks whether a filesystem path exists and points to a regular file.
 */
async function isRegularFile(filePath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(filePath);
    return stat.isFile();
  } catch {
    return false;
  }
}

/**
 * Serves a static asset from distDir or falls back to index.html for SPA client routes.
 * Never serves index.html for /api/* paths or missing static asset extensions.
 */
export async function serveStaticOrSpaFallback(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
  distDir: string,
): Promise<void> {
  const method = req.method ?? 'GET';
  if (method !== 'GET' && method !== 'HEAD') {
    res.writeHead(405, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'method_not_allowed', message: 'Method not allowed' }));
    return;
  }

  const rootDir = path.resolve(distDir);
  let decodedPathname = pathname;
  try {
    decodedPathname = decodeURIComponent(pathname);
  } catch {
    res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'bad_request', message: 'Malformed URL path' }));
    return;
  }

  const relativeCandidate = decodedPathname === '/' ? 'index.html' : decodedPathname.replace(/^\/+/, '');
  const candidatePath = path.resolve(rootDir, relativeCandidate);

  if (candidatePath !== rootDir && !candidatePath.startsWith(`${rootDir}${path.sep}`)) {
    res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'forbidden', message: 'Path traversal is not permitted' }));
    return;
  }

  if (await isRegularFile(candidatePath)) {
    const ext = path.extname(candidatePath).toLowerCase();
    const contentType = MIME_TYPES[ext] ?? 'application/octet-stream';
    const cacheControl = resolveCacheControl(relativeCandidate);
    const content = await fs.readFile(candidatePath);
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': cacheControl,
    });
    res.end(method === 'HEAD' ? undefined : content);
    return;
  }

  const lastSegment = path.posix.basename(decodedPathname);
  if (lastSegment.includes('.')) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not Found');
    return;
  }

  const indexPath = path.join(rootDir, 'index.html');
  if (await isRegularFile(indexPath)) {
    const html = await fs.readFile(indexPath);
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    });
    res.end(method === 'HEAD' ? undefined : html);
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('SPA bundle not found');
}
