/**
 * Single-UID authentication guard middleware for protected MarombApp BFF routes.
 * Enforces Firebase ID token validity and strict ALLOWED_UID matching before any
 * downstream Firestore or Vertex AI work executes.
 */

import type { IncomingMessage } from 'node:http';
import { getServerConfig } from '../config.js';
import * as firebaseVerifier from './firebaseVerifier.js';
import type { VerifiedFirebaseToken } from './firebaseVerifier.js';

export interface AuthErrorBody {
  error: 'unauthenticated' | 'forbidden';
  message: string;
}

export type AuthMiddlewareResult =
  | {
      ok: true;
      user: VerifiedFirebaseToken;
      status?: never;
      body?: never;
    }
  | {
      ok: false;
      user?: never;
      status: 401 | 403;
      body: AuthErrorBody;
    };

/**
 * Extracts the Bearer token from an HTTP Authorization header.
 * When the header is absent or malformed, returns null.
 */
function extractBearerToken(authorizationHeader: string | undefined): string | null {
  if (!authorizationHeader) {
    return null;
  }
  const match = /^Bearer\s+(\S+)$/i.exec(authorizationHeader.trim());
  return match?.[1] ?? null;
}

/**
 * Authenticates an incoming HTTP request against Firebase Auth and ALLOWED_UID.
 * Missing or invalid tokens return 401. Unset ALLOWED_UID fails closed with 403
 * before token verification. Non-matching UIDs fail closed with 403 before downstream I/O.
 */
export async function authenticateRequest(req: IncomingMessage): Promise<AuthMiddlewareResult> {
  const rawAuthHeader = req.headers.authorization;
  const headerValue = Array.isArray(rawAuthHeader) ? rawAuthHeader[0] : rawAuthHeader;
  const token = extractBearerToken(headerValue);

  if (!token) {
    return {
      ok: false,
      status: 401,
      body: {
        error: 'unauthenticated',
        message: 'Missing or malformed Authorization Bearer token',
      },
    };
  }

  const { allowedUid } = getServerConfig();
  if (!allowedUid) {
    return {
      ok: false,
      status: 403,
      body: {
        error: 'forbidden',
        message: 'ALLOWED_UID is not configured on this server',
      },
    };
  }

  let verified: VerifiedFirebaseToken;
  try {
    verified = await firebaseVerifier.verifyFirebaseIdToken(token);
  } catch {
    return {
      ok: false,
      status: 401,
      body: {
        error: 'unauthenticated',
        message: 'Invalid or expired Firebase ID token',
      },
    };
  }

  if (verified.uid !== allowedUid) {
    return {
      ok: false,
      status: 403,
      body: {
        error: 'forbidden',
        message: 'Caller UID is not authorized for this single-user instance',
      },
    };
  }

  return {
    ok: true,
    user: verified,
  };
}
