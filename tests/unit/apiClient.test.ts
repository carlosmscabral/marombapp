/**
 * Unit tests for the typed same-origin `/api/*` HTTP client.
 * Verifies Bearer Firebase ID token attachment, same-origin path guards, JSON parsing, and `ApiClientError` normalization.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const authState = vi.hoisted(() => ({
  currentUser: null as null | { getIdToken: () => Promise<string> },
}));

vi.mock('../../src/lib/firebase', () => ({
  getFirebaseAuth: () => authState,
}));

import {
  ApiClientError,
  apiClient,
  apiGet,
  apiPost,
  apiRequest,
} from '../../src/lib/apiClient';

describe('apiClient', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    authState.currentUser = {
      getIdToken: vi.fn(async () => 'firebase-id-token-123'),
    };
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('attaches Authorization Bearer token and parses JSON on 200 GET responses', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ uid: 'u1', email: 'user@example.com' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const data = await apiGet<{ uid: string; email: string }>('/api/auth/session');

    expect(data).toEqual({ uid: 'u1', email: 'user@example.com' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/auth/session');
    expect(init?.method).toBe('GET');
    expect((init?.headers as Record<string, string>).Authorization).toBe(
      'Bearer firebase-id-token-123',
    );
  });

  it('serializes JSON bodies on POST requests via apiPost and apiClient.post', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const res = await apiClient.post<{ ok: boolean }>('/api/ai/plan', { days: 4 });

    expect(res).toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/ai/plan');
    expect(init?.method).toBe('POST');
    expect(init?.body).toBe(JSON.stringify({ days: 4 }));
    expect((init?.headers as Record<string, string>)['Content-Type']).toBe(
      'application/json',
    );
  });

  it('rejects non-/api or off-origin paths before calling fetch', async () => {
    await expect(apiGet('https://evil.example.com/api/healthz')).rejects.toMatchObject({
      name: 'ApiClientError',
      status: 400,
      code: 'INVALID_API_PATH',
    });
    await expect(apiPost('/plan', {})).rejects.toMatchObject({
      name: 'ApiClientError',
      status: 400,
      code: 'INVALID_API_PATH',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('throws 401 ApiClientError when requireAuth is true and no user is signed in', async () => {
    authState.currentUser = null;

    await expect(apiGet('/api/auth/session')).rejects.toMatchObject({
      name: 'ApiClientError',
      status: 401,
      code: 'UNAUTHENTICATED',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('allows public requests with requireAuth false when no user is signed in', async () => {
    authState.currentUser = null;
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ status: 'ok' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const res = await apiGet<{ status: string }>('/api/healthz', { requireAuth: false });
    expect(res).toEqual({ status: 'ok' });
    const [, init] = fetchMock.mock.calls[0];
    expect((init?.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it('throws typed ApiClientError with status, code, and parsed body on non-2xx responses', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: 'Forbidden UID',
          code: 'FORBIDDEN_UID',
        }),
        {
          status: 403,
          headers: { 'content-type': 'application/json' },
        },
      ),
    );

    try {
      await apiRequest('/api/ai/generate', { method: 'POST', body: {} });
      expect.unreachable('Expected apiRequest to throw ApiClientError');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiClientError);
      const apiErr = err as ApiClientError;
      expect(apiErr.status).toBe(403);
      expect(apiErr.code).toBe('FORBIDDEN_UID');
      expect(apiErr.message).toBe('Forbidden UID');
      expect(apiErr.body).toEqual({
        error: 'Forbidden UID',
        code: 'FORBIDDEN_UID',
      });
    }
  });

  it('returns undefined on 204 No Content responses', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    const res = await apiRequest<undefined>('/api/auth/session', { method: 'DELETE' });
    expect(res).toBeUndefined();
  });
});
