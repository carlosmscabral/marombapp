/**
 * HTTP request router and server factory for the MarombApp Cloud Run BFF.
 * Routes public /api/healthz checks, enforces ALLOWED_UID authentication on
 * protected /api/auth/session and /api/ai/* endpoints, returns JSON 404 for
 * unknown /api/* routes, and serves the static PWA bundle with SPA fallback.
 */

import http from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';
import { isVertexAiReady } from './ai/vertex.js';
import { authenticateRequest } from './auth/middleware.js';
import { getServerConfig } from './config.js';
import { handleAiRoute } from './routes/ai.js';
import { serveStaticOrSpaFallback } from './static.js';

export interface BffServerOptions {
  distDir?: string;
}

/**
 * Writes a JSON response with a no-store Cache-Control header.
 */
function sendJson(res: ServerResponse, statusCode: number, body: unknown): void {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(body));
}

/**
 * Checks whether a request pathname targets a protected /api/* route.
 */
function isProtectedApiPath(pathname: string): boolean {
  return (
    pathname === '/api/auth/session' ||
    pathname.startsWith('/api/auth/') ||
    pathname === '/api/ai' ||
    pathname.startsWith('/api/ai/')
  );
}

/**
 * Dispatches a single incoming HTTP request across API and static SPA handlers.
 */
async function handleRequest(
  req: IncomingMessage,
  res: ServerResponse,
  distDir: string,
): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const { pathname } = url;
  const method = req.method ?? 'GET';

  if (pathname === '/api/healthz') {
    if (method !== 'GET' && method !== 'HEAD') {
      sendJson(res, 405, { error: 'method_not_allowed', message: 'Method not allowed' });
      return;
    }
    const config = getServerConfig();
    sendJson(res, 200, {
      status: 'ok',
      revision: config.revision,
      firestoreDatabase: config.firestoreDatabase,
      aiReady: isVertexAiReady(),
    });
    return;
  }

  if (isProtectedApiPath(pathname)) {
    const authResult = await authenticateRequest(req);
    if (!authResult.ok) {
      sendJson(res, authResult.status, authResult.body);
      return;
    }

    if (pathname === '/api/auth/session') {
      if (method !== 'GET') {
        sendJson(res, 405, { error: 'method_not_allowed', message: 'Method not allowed' });
        return;
      }
      sendJson(res, 200, {
        uid: authResult.user.uid,
        ...(authResult.user.email ? { email: authResult.user.email } : {}),
      });
      return;
    }

    if (pathname === '/api/ai' || pathname.startsWith('/api/ai/')) {
      handleAiRoute(req, res, authResult.user);
      return;
    }

    sendJson(res, 404, { error: 'not_found', message: 'API route not found' });
    return;
  }

  if (pathname === '/api' || pathname.startsWith('/api/')) {
    sendJson(res, 404, { error: 'not_found', message: 'API route not found' });
    return;
  }

  await serveStaticOrSpaFallback(req, res, pathname, distDir);
}

/**
 * Creates a configured Node HTTP server instance for the MarombApp BFF.
 */
export function createBffServer(options: BffServerOptions = {}): http.Server {
  const distDir = options.distDir ?? path.resolve(process.cwd(), 'dist');
  return http.createServer((req, res) => {
    void handleRequest(req, res, distDir).catch(() => {
      if (!res.headersSent) {
        sendJson(res, 500, { error: 'internal_error', message: 'Internal server error' });
      } else {
        res.end();
      }
    });
  });
}
