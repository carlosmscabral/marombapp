/**
 * Typed same-origin HTTP client for MarombApp BFF `/api/*` endpoints.
 * Attaches the current user's Firebase ID token as a Bearer credential and normalizes non-2xx responses into `ApiClientError`.
 */

import { getFirebaseAuth } from './firebase';

/**
 * Structured error thrown when a `/api/*` request fails authentication, validation, or returns a non-2xx HTTP status.
 */
export class ApiClientError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly body?: unknown;

  constructor(message: string, status: number, code?: string, body?: unknown) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
    this.body = body;
  }
}

export interface ApiRequestOptions extends Omit<RequestInit, 'body' | 'headers'> {
  body?: unknown;
  headers?: Record<string, string>;
  requireAuth?: boolean;
}

/**
 * Validates that the request target is a same-origin `/api` path so Bearer tokens never leave the origin.
 */
function assertSameOriginApiPath(path: string): void {
  if (!path.startsWith('/api/') && path !== '/api' && !path.startsWith('/api?')) {
    throw new ApiClientError(
      `API client only permits same-origin /api/* paths (received "${path}")`,
      400,
      'INVALID_API_PATH',
    );
  }
}

/**
 * Resolves the current Firebase ID token when a user is signed in.
 * If `requireAuth` is true and no user is signed in, the helper throws a 401 `ApiClientError`.
 */
async function resolveBearerToken(requireAuth: boolean): Promise<string | null> {
  const user = getFirebaseAuth().currentUser;
  if (!user) {
    if (requireAuth) {
      throw new ApiClientError(
        'Authentication required for API request',
        401,
        'UNAUTHENTICATED',
      );
    }
    return null;
  }
  const token = await user.getIdToken();
  if (!token && requireAuth) {
    throw new ApiClientError(
      'Unable to obtain Firebase ID token',
      401,
      'UNAUTHENTICATED',
    );
  }
  return token || null;
}

/**
 * Parses the response payload as JSON when available or falls back to plain text.
 */
async function parseResponseBody(response: Response): Promise<unknown> {
  if (response.status === 204) {
    return undefined;
  }
  const contentType = response.headers.get('content-type') ?? '';
  const rawText = await response.text();
  if (!rawText) {
    return undefined;
  }
  if (contentType.includes('application/json')) {
    try {
      return JSON.parse(rawText);
    } catch {
      throw new ApiClientError(
        `Invalid JSON response from ${response.url || 'API'}`,
        response.status,
        'INVALID_JSON',
        rawText,
      );
    }
  }
  try {
    return JSON.parse(rawText);
  } catch {
    return rawText;
  }
}

/**
 * Executes an authenticated same-origin `/api/*` request, parses JSON, and throws `ApiClientError` on non-2xx statuses.
 */
export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  assertSameOriginApiPath(path);
  const { body, headers: customHeaders, requireAuth = true, ...restInit } = options;
  const token = await resolveBearerToken(requireAuth);

  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...customHeaders,
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let serializedBody: BodyInit | undefined;
  if (body !== undefined) {
    if (typeof body === 'string') {
      serializedBody = body;
    } else {
      headers['Content-Type'] = headers['Content-Type'] ?? 'application/json';
      serializedBody = JSON.stringify(body);
    }
  }

  const response = await fetch(path, {
    ...restInit,
    headers,
    body: serializedBody,
  });

  const parsed = await parseResponseBody(response);

  if (!response.ok) {
    const record =
      parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
    const message =
      (typeof record?.message === 'string' && record.message) ||
      (typeof record?.error === 'string' && record.error) ||
      `API request failed with status ${response.status}`;
    const code = typeof record?.code === 'string' ? record.code : undefined;
    throw new ApiClientError(message, response.status, code, parsed);
  }

  return parsed as T;
}

/**
 * Performs a typed `GET` request against a same-origin `/api/*` route.
 */
export function apiGet<T>(
  path: string,
  options?: Omit<ApiRequestOptions, 'method' | 'body'>,
): Promise<T> {
  return apiRequest<T>(path, { ...options, method: 'GET' });
}

/**
 * Performs a typed `POST` request with a JSON body against a same-origin `/api/*` route.
 */
export function apiPost<T>(
  path: string,
  body?: unknown,
  options?: Omit<ApiRequestOptions, 'method' | 'body'>,
): Promise<T> {
  return apiRequest<T>(path, { ...options, method: 'POST', body });
}

export const apiClient = {
  request: apiRequest,
  get: apiGet,
  post: apiPost,
};
