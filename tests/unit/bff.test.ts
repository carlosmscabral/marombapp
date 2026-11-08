/**
 * Unit and contract test suite for the MarombApp Cloud Run BFF server.
 * Verifies L1 healthz shape, L2 SPA fallback, API 404 JSON isolation,
 * Firebase ID token ALLOWED_UID enforcement, and dormant Vertex AI laziness.
 */

import fs from 'node:fs/promises';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as vertexAdapter from '../../server/ai/vertex.js';
import { createBffServer } from '../../server/app.js';
import * as firebaseVerifier from '../../server/auth/firebaseVerifier.js';

describe('MarombApp Cloud Run BFF (REQ-003, REQ-004, REQ-005, ADR-001)', () => {
  let tempDistDir = '';
  let baseUrl = '';
  let closeServer: (() => Promise<void>) | null = null;
  const originalEnv = { ...process.env };

  beforeEach(async () => {
    process.env = { ...originalEnv };
    delete process.env.K_REVISION;
    delete process.env.FIRESTORE_DATABASE_ID;
    delete process.env.GOOGLE_CLOUD_PROJECT;
    delete process.env.GOOGLE_CLOUD_LOCATION;
    process.env.ALLOWED_UID = 'allowed-owner-uid';

    tempDistDir = await fs.mkdtemp(path.join(os.tmpdir(), 'marombapp-bff-dist-'));
    await fs.mkdir(path.join(tempDistDir, 'assets'), { recursive: true });
    await fs.writeFile(
      path.join(tempDistDir, 'index.html'),
      '<!doctype html><html><body><div id="root">MarombApp SPA</div></body></html>',
      'utf8',
    );
    await fs.writeFile(path.join(tempDistDir, 'sw.js'), 'self.addEventListener("fetch", () => {})', 'utf8');
    await fs.writeFile(
      path.join(tempDistDir, 'manifest.webmanifest'),
      JSON.stringify({ name: 'MarombApp', short_name: 'Maromba' }),
      'utf8',
    );
    await fs.writeFile(
      path.join(tempDistDir, 'assets', 'index-hash123.js'),
      'console.log("hashed bundle")',
      'utf8',
    );

    const server = createBffServer({ distDir: tempDistDir });
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve());
    });
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
    closeServer = () =>
      new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    vertexAdapter.resetVertexClientForTesting();
    if (closeServer) {
      await closeServer();
      closeServer = null;
    }
    if (tempDistDir) {
      await fs.rm(tempDistDir, { recursive: true, force: true });
      tempDistDir = '';
    }
    process.env = { ...originalEnv };
  });

  it('returns strict JSON from GET /api/healthz without calling Vertex AI', async () => {
    const vertexSpy = vi.spyOn(vertexAdapter, 'getVertexClient');

    const defaultRes = await fetch(`${baseUrl}/api/healthz`);
    expect(defaultRes.status).toBe(200);
    expect(defaultRes.headers.get('content-type')).toContain('application/json');
    const defaultBody = (await defaultRes.json()) as Record<string, unknown>;
    expect(Object.keys(defaultBody).sort()).toEqual([
      'aiReady',
      'firestoreDatabase',
      'revision',
      'status',
    ]);
    expect(defaultBody).toEqual({
      status: 'ok',
      revision: 'local',
      firestoreDatabase: '(default)',
      aiReady: false,
    });

    process.env.K_REVISION = 'marombapp-serving-00007-xyz';
    process.env.FIRESTORE_DATABASE_ID = 'marombapp';
    process.env.GOOGLE_CLOUD_PROJECT = 'cabral-scion-hub';
    process.env.GOOGLE_CLOUD_LOCATION = 'global';

    const configuredRes = await fetch(`${baseUrl}/api/healthz`);
    expect(configuredRes.status).toBe(200);
    const configuredBody = await configuredRes.json();
    expect(configuredBody).toEqual({
      status: 'ok',
      revision: 'marombapp-serving-00007-xyz',
      firestoreDatabase: 'marombapp',
      aiReady: true,
    });
    expect(vertexSpy).not.toHaveBeenCalled();
  });

  it('serves static assets with cache headers and SPA index.html fallback for client routes', async () => {
    const assetRes = await fetch(`${baseUrl}/assets/index-hash123.js`);
    expect(assetRes.status).toBe(200);
    expect(assetRes.headers.get('cache-control')).toContain('immutable');
    expect(await assetRes.text()).toContain('hashed bundle');

    const swRes = await fetch(`${baseUrl}/sw.js`);
    expect(swRes.status).toBe(200);
    expect(swRes.headers.get('cache-control')).toContain('no-cache');

    const clientRoutes = ['/analytics', '/plan', '/library', '/in-gym', '/start', '/sessions/abc-123'];
    for (const route of clientRoutes) {
      const res = await fetch(`${baseUrl}${route}`);
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/html');
      expect(res.headers.get('cache-control')).toContain('no-cache');
      expect(await res.text()).toContain('MarombApp SPA');
    }
  });

  it('returns HTTP 404 JSON for unknown /api/* routes and never returns index.html', async () => {
    const res = await fetch(`${baseUrl}/api/nope`);
    expect(res.status).toBe(404);
    expect(res.headers.get('content-type')).toContain('application/json');
    const text = await res.text();
    expect(text).not.toContain('<!doctype html>');
    const parsed = JSON.parse(text) as { error: string; message: string };
    expect(parsed.error).toBe('not_found');
  });

  it('rejects missing and invalid Bearer tokens with HTTP 401 JSON', async () => {
    const missingRes = await fetch(`${baseUrl}/api/auth/session`);
    expect(missingRes.status).toBe(401);
    expect(missingRes.headers.get('content-type')).toContain('application/json');
    expect(await missingRes.json()).toMatchObject({ error: 'unauthenticated' });

    vi.spyOn(firebaseVerifier, 'verifyFirebaseIdToken').mockRejectedValueOnce(
      new Error('Firebase ID token has expired'),
    );

    const badTokenRes = await fetch(`${baseUrl}/api/auth/session`, {
      headers: { Authorization: 'Bearer expired-or-corrupt-token' },
    });
    expect(badTokenRes.status).toBe(401);
    expect(badTokenRes.headers.get('content-type')).toContain('application/json');
    expect(await badTokenRes.json()).toMatchObject({ error: 'unauthenticated' });
  });

  it('rejects non-ALLOWED_UID callers with HTTP 403 JSON and zero Vertex AI calls', async () => {
    const vertexSpy = vi.spyOn(vertexAdapter, 'getVertexClient');
    const verifySpy = vi.spyOn(firebaseVerifier, 'verifyFirebaseIdToken').mockResolvedValue({
      uid: 'intruder-uid-999',
      email: 'intruder@example.com',
    });

    const aiRes = await fetch(`${baseUrl}/api/ai/workout`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer valid-token-wrong-uid',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt: 'leg day' }),
    });

    expect(aiRes.status).toBe(403);
    expect(aiRes.headers.get('content-type')).toContain('application/json');
    expect(await aiRes.json()).toMatchObject({ error: 'forbidden' });
    expect(verifySpy).toHaveBeenCalledWith('valid-token-wrong-uid');
    expect(vertexSpy).not.toHaveBeenCalled();

    delete process.env.ALLOWED_UID;
    const unsetUidRes = await fetch(`${baseUrl}/api/auth/session`, {
      headers: { Authorization: 'Bearer valid-token-wrong-uid' },
    });
    expect(unsetUidRes.status).toBe(403);
    expect(vertexSpy).not.toHaveBeenCalled();
  });

  it('returns HTTP 200 session for ALLOWED_UID and mounts dormant /api/ai boundary after auth', async () => {
    const verifySpy = vi.spyOn(firebaseVerifier, 'verifyFirebaseIdToken').mockResolvedValue({
      uid: 'allowed-owner-uid',
      email: 'carlos@example.com',
    });

    const sessionRes = await fetch(`${baseUrl}/api/auth/session`, {
      headers: { Authorization: 'Bearer valid-owner-token' },
    });
    expect(sessionRes.status).toBe(200);
    expect(verifySpy).toHaveBeenCalledWith('valid-owner-token');
    expect(await sessionRes.json()).toEqual({
      uid: 'allowed-owner-uid',
      email: 'carlos@example.com',
    });

    const aiBoundaryRes = await fetch(`${baseUrl}/api/ai/generate`, {
      method: 'POST',
      headers: { Authorization: 'Bearer valid-owner-token' },
    });
    expect(aiBoundaryRes.status).toBe(501);
    expect(await aiBoundaryRes.json()).toMatchObject({ error: 'not_implemented' });
  });

  it('lazily constructs the Vertex AI client only when getVertexClient is called', () => {
    delete process.env.GOOGLE_CLOUD_PROJECT;
    expect(() => vertexAdapter.getVertexClient()).toThrow(/GOOGLE_CLOUD_PROJECT/);

    process.env.GOOGLE_CLOUD_PROJECT = 'cabral-scion-hub';
    process.env.GOOGLE_CLOUD_LOCATION = 'global';
    const client = vertexAdapter.getVertexClient();
    expect(client).toBeDefined();
    expect(vertexAdapter.getVertexClient()).toBe(client);
  });
});
