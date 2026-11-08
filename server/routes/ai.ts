/**
 * Protected Vertex AI router boundary for the MarombApp Cloud Run BFF.
 * Mounted strictly behind the ALLOWED_UID authentication middleware and returns
 * a dormant 501 JSON stub in Wave 1 until PO-authored AI issues are scheduled.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import type { VerifiedFirebaseToken } from '../auth/firebaseVerifier.js';

/**
 * Handles authenticated requests under /api/ai and /api/ai/* in Wave 1.
 * Responds with HTTP 501 JSON so no unrequested AI features are exposed.
 */
export function handleAiRoute(
  _req: IncomingMessage,
  res: ServerResponse,
  _user: VerifiedFirebaseToken,
): void {
  const payload = JSON.stringify({
    error: 'not_implemented',
    message: 'Vertex AI endpoints are dormant in Wave 1 and await PO issue specifications',
  });
  res.writeHead(501, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(payload);
}
